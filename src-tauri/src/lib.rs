mod achievements;
mod db;
mod enrich;
mod epic;
mod launcher;
mod models;
mod saves;
mod steam;

use chrono::Utc;
use models::{Emulator, Game, Rom, Source, Status, System};
use std::sync::Mutex;
use tauri::{Emitter, State};

/// Estado global: la conexión SQLite protegida por un Mutex.
struct AppState {
    db: Mutex<rusqlite::Connection>,
}

/// Escanea Steam + Epic, persiste lo detectado y devuelve la biblioteca entera.
#[tauri::command]
fn scan_library(state: State<AppState>) -> Result<Vec<Game>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let mut detected = Vec::new();
    detected.extend(steam::scan().map_err(|e| e.to_string())?);
    detected.extend(epic::scan().map_err(|e| e.to_string())?);

    for game in &detected {
        db::upsert_detected(&conn, game).map_err(|e| e.to_string())?;
    }

    db::all_games(&conn).map_err(|e| e.to_string())
}

/// Devuelve la biblioteca guardada sin re-escanear (arranque rápido).
#[tauri::command]
fn get_library(state: State<AppState>) -> Result<Vec<Game>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::all_games(&conn).map_err(|e| e.to_string())
}

/// Enriquece la biblioteca: descarga portadas, hero y metadata de Steam.
/// Emite un evento "game-enriched" por cada juego actualizado para que la UI
/// se vaya rellenando en vivo, y "enrich-done" al terminar.
/// Se ejecuta en un hilo aparte para no bloquear la ventana.
#[tauri::command]
fn enrich_library(app: tauri::AppHandle, state: State<AppState>) -> Result<(), String> {
    // Sacamos la lista de juegos a enriquecer dentro del lock, y soltamos.
    let pending: Vec<Game> = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db::all_games(&conn)
            .map_err(|e| e.to_string())?
            .into_iter()
            .filter(|g| {
                // Solo Steam y solo si le falta portada, hero o metadata.
                g.source == Source::Steam
                    && (g.cover_path.is_none()
                        || g.hero_path.is_none()
                        || g.genres.is_empty())
            })
            .collect()
    };

    if pending.is_empty() {
        let _ = app.emit("enrich-done", ());
        return Ok(());
    }

    let db_path_app = app.clone();
    std::thread::spawn(move || {
        // Abrimos una conexión propia para este hilo.
        let conn = match db::open() {
            Ok(c) => c,
            Err(_) => return,
        };
        for mut game in pending {
            if enrich::enrich_steam_game(&mut game).is_ok() {
                let _ = db::save_enrichment(&conn, &game);
                let _ = db_path_app.emit("game-enriched", &game);
            }
            // Respetamos el rate limit de Steam (~200 req / 5 min).
            std::thread::sleep(std::time::Duration::from_millis(350));
        }
        let _ = db_path_app.emit("enrich-done", ());
    });

    Ok(())
}

/// Lanza un juego. Devuelve el PID si es un ejecutable directo (juego manual),
/// o null si se lanzó por protocolo (Steam/Epic) o con elevación.
#[tauri::command]
fn launch_game(
    state: State<AppState>,
    id: String,
    target: String,
    admin: Option<bool>,
) -> Result<Option<u32>, String> {
    let pid = if admin.unwrap_or(false) {
        launcher::launch_as_admin(&target).map_err(|e| e.to_string())?
    } else {
        launcher::launch(&target).map_err(|e| e.to_string())?
    };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::record_session(&conn, &id, 0, Utc::now().timestamp()).map_err(|e| e.to_string())?;
    Ok(pid)
}

/// El frontend llama aquí periódicamente para saber si un juego manual sigue abierto.
#[tauri::command]
fn is_game_running(pid: u32) -> bool {
    launcher::is_running(pid)
}

/// Registra una sesión terminada (segundos jugados).
#[tauri::command]
fn record_play_session(
    state: State<AppState>,
    id: String,
    seconds: u64,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::record_session(&conn, &id, seconds, Utc::now().timestamp()).map_err(|e| e.to_string())
}

/// Añade un juego manual (Kenshi, una ROM de Pokémon, lo que sea).
#[tauri::command]
fn add_manual_game(
    state: State<AppState>,
    name: String,
    exe_path: String,
    cover_path: Option<String>,
    save_path: Option<String>,
) -> Result<Game, String> {
    let id = format!("manual:{}", Utc::now().timestamp_millis());
    let mut game = Game::new(id, name, Source::Manual, exe_path);
    game.cover_path = cover_path;
    game.save_path = save_path;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::insert_manual(&conn, &game).map_err(|e| e.to_string())?;
    Ok(game)
}

/// Actualiza estado, notas, tags y carpeta de saves de un juego.
#[tauri::command]
fn update_game(
    state: State<AppState>,
    id: String,
    status: Status,
    notes: String,
    tags: Vec<String>,
    save_path: Option<String>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::update_user_fields(&conn, &id, &status, &notes, &tags, save_path.as_deref())
        .map_err(|e| e.to_string())
}

/// Refresca el timestamp del save más reciente de un juego.
#[tauri::command]
fn refresh_save_time(state: State<AppState>, id: String) -> Result<Option<i64>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    // Buscamos su save_path.
    let games = db::all_games(&conn).map_err(|e| e.to_string())?;
    let game = games.into_iter().find(|g| g.id == id);
    let Some(game) = game else {
        return Ok(None);
    };
    let Some(save_path) = game.save_path else {
        return Ok(None);
    };
    let ts = saves::latest_save_timestamp(&save_path).map_err(|e| e.to_string())?;
    if let Some(ts) = ts {
        db::update_last_save(&conn, &id, ts).map_err(|e| e.to_string())?;
    }
    Ok(ts)
}

/// Elimina un juego de la biblioteca.
#[tauri::command]
fn delete_game(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_game(&conn, &id).map_err(|e| e.to_string())
}

/// Asigna una portada personalizada a un juego.
#[tauri::command]
fn set_custom_cover(state: State<AppState>, id: String, cover_path: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::set_cover(&conn, &id, &cover_path).map_err(|e| e.to_string())
}

/// Devuelve los IDs de juegos de Steam que parecen "restos": están en la
/// biblioteca pero su carpeta de instalación ya no existe o está vacía.
/// No los toca; solo los señala para que el usuario decida apartarlos.
#[tauri::command]
fn detect_ghost_games(state: State<AppState>) -> Result<Vec<String>, String> {
    let installed = steam::installed_appids();
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let games = db::all_games(&conn).map_err(|e| e.to_string())?;

    // Si no detectamos NINGÚN juego instalado, probablemente Steam no está
    // accesible: no marcamos nada como fantasma para no dar un falso positivo.
    if installed.is_empty() {
        return Ok(Vec::new());
    }

    let ghosts = games
        .into_iter()
        .filter(|g| g.source == Source::Steam && g.status != Status::Shelved)
        .filter_map(|g| {
            let appid = g.id.strip_prefix("steam:")?.to_string();
            if installed.contains(&appid) {
                None
            } else {
                Some(g.id)
            }
        })
        .collect();
    Ok(ghosts)
}

/// Aparta en bloque una lista de juegos (los marca como shelved).
#[tauri::command]
fn shelve_games(state: State<AppState>, ids: Vec<String>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    for id in ids {
        // Leemos el juego para conservar sus notas/tags al cambiar el estado.
        if let Ok(games) = db::all_games(&conn) {
            if let Some(g) = games.into_iter().find(|x| x.id == id) {
                let _ = db::update_user_fields(
                    &conn,
                    &id,
                    &Status::Shelved,
                    &g.notes,
                    &g.tags,
                    g.save_path.as_deref(),
                );
            }
        }
    }
    Ok(())
}

/// Devuelve el historial de sesiones para las estadísticas.
#[tauri::command]
fn get_session_history(state: State<AppState>) -> Result<Vec<(i64, u64)>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::session_history(&conn).map_err(|e| e.to_string())
}

/// Lee un ajuste genérico (ej. el tema).
#[tauri::command]
fn get_app_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_setting(&conn, &key).map_err(|e| e.to_string())
}

/// Guarda un ajuste genérico.
#[tauri::command]
fn set_app_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

/// Exporta los datos del usuario (estados, notas, tags, platinos, portadas
/// custom) a un JSON. NO incluye los juegos detectados en sí (esos se
/// re-escanean), solo lo que el usuario ha añadido encima.
#[tauri::command]
fn export_library(state: State<AppState>) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let games = db::all_games(&conn).map_err(|e| e.to_string())?;
    let roms = db::all_roms(&conn).map_err(|e| e.to_string())?;
    let emus = db::all_emulators(&conn).map_err(|e| e.to_string())?;

    let backup = serde_json::json!({
        "version": 1,
        "exported_at": Utc::now().timestamp(),
        "games": games,
        "roms": roms,
        "emulators": emus,
    });
    serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())
}

/// Importa un backup: restaura estados, notas, tags, platinos de los juegos
/// que existan, y re-crea ROMs y emuladores. No duplica.
#[tauri::command]
fn import_library(state: State<AppState>, json: String) -> Result<u32, String> {
    let data: serde_json::Value =
        serde_json::from_str(&json).map_err(|_| "El archivo no es un backup válido")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut restored = 0u32;

    // Restaura los campos editables de cada juego que aún exista en la BD.
    if let Some(games) = data.get("games").and_then(|g| g.as_array()) {
        let existing = db::all_games(&conn).map_err(|e| e.to_string())?;
        let existing_ids: std::collections::HashSet<String> =
            existing.iter().map(|g| g.id.clone()).collect();

        for gv in games {
            if let Ok(g) = serde_json::from_value::<Game>(gv.clone()) {
                if existing_ids.contains(&g.id) {
                    let _ = db::update_user_fields(
                        &conn, &g.id, &g.status, &g.notes, &g.tags, g.save_path.as_deref(),
                    );
                    let _ = db::set_platinum(&conn, &g.id, g.platinum);
                    if let Some(cover) = &g.cover_path {
                        let _ = db::set_cover(&conn, &g.id, cover);
                    }
                    restored += 1;
                }
            }
        }
    }

    // Re-crea emuladores y ROMs (que no dependen de escaneo).
    if let Some(emus) = data.get("emulators").and_then(|e| e.as_array()) {
        for ev in emus {
            if let Ok(emu) = serde_json::from_value::<Emulator>(ev.clone()) {
                let _ = db::set_emulator(&conn, &emu);
            }
        }
    }
    if let Some(roms) = data.get("roms").and_then(|r| r.as_array()) {
        let existing_roms = db::all_roms(&conn).map_err(|e| e.to_string())?;
        let existing_paths: std::collections::HashSet<String> =
            existing_roms.iter().map(|r| r.rom_path.clone()).collect();
        for rv in roms {
            if let Ok(rom) = serde_json::from_value::<Rom>(rv.clone()) {
                // Evitamos duplicar ROMs por ruta.
                if !existing_paths.contains(&rom.rom_path) {
                    let _ = db::insert_rom(&conn, &rom);
                }
            }
        }
    }

    Ok(restored)
}

/// Marca o desmarca el platino manual de un juego.
#[tauri::command]
fn set_platinum(state: State<AppState>, id: String, platinum: bool) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::set_platinum(&conn, &id, platinum).map_err(|e| e.to_string())
}

/// Guarda la configuración de Steam (API key + perfil) y resuelve el SteamID.
#[tauri::command]
fn save_steam_config(
    state: State<AppState>,
    api_key: String,
    profile: String,
) -> Result<String, String> {
    // Resolvemos el steamid (acepta vanity URL, URL completa o steamid64).
    let steamid = achievements::resolve_steamid(&api_key, &profile).map_err(|e| e.to_string())?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::set_setting(&conn, "steam_api_key", &api_key).map_err(|e| e.to_string())?;
    db::set_setting(&conn, "steam_id", &steamid).map_err(|e| e.to_string())?;
    Ok(steamid)
}

/// Devuelve la config de Steam guardada (api_key presente?, steamid).
#[tauri::command]
fn get_steam_config(state: State<AppState>) -> Result<(bool, Option<String>), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let key = db::get_setting(&conn, "steam_api_key").map_err(|e| e.to_string())?;
    let id = db::get_setting(&conn, "steam_id").map_err(|e| e.to_string())?;
    Ok((key.is_some(), id))
}

/// Sincroniza los logros de todos los juegos de Steam. Emite eventos de progreso.
#[tauri::command]
fn sync_achievements(app: tauri::AppHandle, state: State<AppState>) -> Result<(), String> {
    let (api_key, steamid, steam_games): (String, String, Vec<Game>) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let key = db::get_setting(&conn, "steam_api_key")
            .map_err(|e| e.to_string())?
            .ok_or("No has configurado tu API key de Steam.")?;
        let id = db::get_setting(&conn, "steam_id")
            .map_err(|e| e.to_string())?
            .ok_or("No has configurado tu perfil de Steam.")?;
        let games = db::all_games(&conn)
            .map_err(|e| e.to_string())?
            .into_iter()
            .filter(|g| g.source == Source::Steam)
            .collect();
        (key, id, games)
    };

    std::thread::spawn(move || {
        let conn = match db::open() {
            Ok(c) => c,
            Err(_) => return,
        };
        for game in steam_games {
            let Some(appid) = game.id.strip_prefix("steam:") else {
                continue;
            };
            match achievements::fetch_achievements(&api_key, &steamid, appid) {
                Ok(Some(prog)) => {
                    let _ = db::set_achievements(&conn, &game.id, prog.unlocked, prog.total);
                    // Si tiene todos los logros, lo marcamos platino automáticamente.
                    if prog.total > 0 && prog.unlocked == prog.total {
                        let _ = db::set_platinum(&conn, &game.id, true);
                    }
                    let mut updated = game.clone();
                    updated.ach_unlocked = Some(prog.unlocked);
                    updated.ach_total = Some(prog.total);
                    updated.platinum = prog.unlocked == prog.total;
                    let _ = app.emit("game-enriched", &updated);
                }
                _ => {}
            }
            std::thread::sleep(std::time::Duration::from_millis(250));
        }
        let _ = app.emit("achievements-done", ());
    });

    Ok(())
}

// ====================== EMULADORES Y ROMS ======================

/// Asigna el emulador de una consola.
#[tauri::command]
fn set_emulator(
    state: State<AppState>,
    system: String,
    exe_path: String,
    name: String,
) -> Result<(), String> {
    let sys = System::from_str(&system).ok_or("Consola desconocida")?;
    let emu = Emulator { system: sys, exe_path, name };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::set_emulator(&conn, &emu).map_err(|e| e.to_string())
}

/// Devuelve los emuladores configurados.
#[tauri::command]
fn get_emulators(state: State<AppState>) -> Result<Vec<Emulator>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::all_emulators(&conn).map_err(|e| e.to_string())
}

/// Quita el emulador de una consola.
#[tauri::command]
fn remove_emulator(state: State<AppState>, system: String) -> Result<(), String> {
    let sys = System::from_str(&system).ok_or("Consola desconocida")?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_emulator(&conn, &sys).map_err(|e| e.to_string())
}

/// Añade una ROM a una consola.
#[tauri::command]
fn add_rom(
    state: State<AppState>,
    system: String,
    title: String,
    rom_path: String,
    cover_path: Option<String>,
) -> Result<Rom, String> {
    let sys = System::from_str(&system).ok_or("Consola desconocida")?;
    let rom = Rom {
        id: format!("rom:{}", Utc::now().timestamp_millis()),
        system: sys,
        title,
        rom_path,
        cover_path,
        seconds_played: 0,
        last_played: None,
        notes: String::new(),
    };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::insert_rom(&conn, &rom).map_err(|e| e.to_string())?;
    Ok(rom)
}

/// Devuelve todas las ROMs.
#[tauri::command]
fn get_roms(state: State<AppState>) -> Result<Vec<Rom>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::all_roms(&conn).map_err(|e| e.to_string())
}

/// Lanza una ROM con el emulador de su consola. Devuelve el PID del emulador.
#[tauri::command]
fn launch_rom(state: State<AppState>, id: String) -> Result<u32, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let roms = db::all_roms(&conn).map_err(|e| e.to_string())?;
    let rom = roms.into_iter().find(|r| r.id == id).ok_or("ROM no encontrada")?;

    let emus = db::all_emulators(&conn).map_err(|e| e.to_string())?;
    let emu = emus
        .into_iter()
        .find(|e| e.system == rom.system)
        .ok_or("No hay emulador asignado a esta consola. Configúralo primero.")?;

    let pid = launcher::launch_rom(&emu.exe_path, &rom.rom_path).map_err(|e| e.to_string())?;
    db::record_rom_session(&conn, &id, 0, Utc::now().timestamp()).map_err(|e| e.to_string())?;
    Ok(pid)
}

/// Registra los segundos jugados de una ROM.
#[tauri::command]
fn record_rom_play(state: State<AppState>, id: String, seconds: u64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::record_rom_session(&conn, &id, seconds, Utc::now().timestamp()).map_err(|e| e.to_string())
}

/// Actualiza notas/portada de una ROM.
#[tauri::command]
fn update_rom(
    state: State<AppState>,
    id: String,
    notes: String,
    cover_path: Option<String>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::update_rom(&conn, &id, &notes, cover_path.as_deref()).map_err(|e| e.to_string())
}

/// Elimina una ROM.
#[tauri::command]
fn delete_rom(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_rom(&conn, &id).map_err(|e| e.to_string())
}

/// Busca y descarga la carátula de una ROM desde libretro. Devuelve la ruta.
#[tauri::command]
fn fetch_rom_cover(state: State<AppState>, id: String) -> Result<Option<String>, String> {
    let rom = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db::all_roms(&conn)
            .map_err(|e| e.to_string())?
            .into_iter()
            .find(|r| r.id == id)
            .ok_or("ROM no encontrada")?
    };

    let cover = enrich::fetch_rom_cover(rom.system.as_str(), &rom.title, &rom.id);
    if let Some(ref path) = cover {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db::update_rom(&conn, &id, &rom.notes, Some(path)).map_err(|e| e.to_string())?;
    }
    Ok(cover)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = db::open().expect("No pude abrir la base de datos");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            db: Mutex::new(conn),
        })
        .invoke_handler(tauri::generate_handler![
            scan_library,
            get_library,
            enrich_library,
            launch_game,
            is_game_running,
            record_play_session,
            add_manual_game,
            update_game,
            refresh_save_time,
            delete_game,
            set_custom_cover,
            detect_ghost_games,
            shelve_games,
            get_session_history,
            get_app_setting,
            set_app_setting,
            export_library,
            import_library,
            set_platinum,
            save_steam_config,
            get_steam_config,
            sync_achievements,
            set_emulator,
            get_emulators,
            remove_emulator,
            add_rom,
            get_roms,
            launch_rom,
            record_rom_play,
            update_rom,
            delete_rom,
            fetch_rom_cover,
        ])
        .run(tauri::generate_context!())
        .expect("error al arrancar Grimoire Launcher");
}
