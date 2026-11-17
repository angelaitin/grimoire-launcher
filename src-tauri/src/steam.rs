use crate::models::{Game, Source};
use anyhow::{Context, Result};
use keyvalues_parser::Vdf;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Localiza la carpeta raíz de Steam según el SO.
fn steam_root() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        // Lo más fiable en Windows es el registro.
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey("Software\\Valve\\Steam") {
            if let Ok(path) = key.get_value::<String, _>("SteamPath") {
                let p = PathBuf::from(path);
                if p.exists() {
                    return Some(p);
                }
            }
        }
        // Fallback a la ruta por defecto.
        let default = PathBuf::from("C:\\Program Files (x86)\\Steam");
        if default.exists() {
            return Some(default);
        }
        None
    }

    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir()?;
        let p = home.join("Library/Application Support/Steam");
        if p.exists() {
            return Some(p);
        }
        None
    }

    #[cfg(target_os = "linux")]
    {
        let home = dirs::home_dir()?;
        // Ruta clásica y ruta de Flatpak.
        let candidates = [
            home.join(".steam/steam"),
            home.join(".local/share/Steam"),
            home.join(".var/app/com.valvesoftware.Steam/data/Steam"),
        ];
        candidates.into_iter().find(|p| p.exists())
    }
}

/// Lee libraryfolders.vdf y devuelve todas las carpetas que contienen juegos.
/// Steam puede tener bibliotecas repartidas en varios discos.
fn library_folders(steam_root: &Path) -> Result<Vec<PathBuf>> {
    let vdf_path = steam_root
        .join("steamapps")
        .join("libraryfolders.vdf");

    let content = std::fs::read_to_string(&vdf_path)
        .with_context(|| format!("No pude leer {vdf_path:?}"))?;

    let vdf = Vdf::parse(&content).context("VDF de libraryfolders mal formado")?;
    let mut folders = Vec::new();

    // La estructura es { "libraryfolders": { "0": { "path": "..." }, "1": {...} } }
    if let Some(obj) = vdf.value.get_obj() {
        for (_key, values) in obj.iter() {
            for value in values {
                if let Some(inner) = value.get_obj() {
                    if let Some(path_vals) = inner.get("path") {
                        if let Some(path_str) = path_vals.first().and_then(|v| v.get_str()) {
                            let steamapps = PathBuf::from(path_str).join("steamapps");
                            if steamapps.exists() {
                                folders.push(steamapps);
                            }
                        }
                    }
                }
            }
        }
    }

    // Si el VDF estaba vacío o raro, al menos probamos la carpeta principal.
    if folders.is_empty() {
        let main = steam_root.join("steamapps");
        if main.exists() {
            folders.push(main);
        }
    }

    Ok(folders)
}

/// Parsea un appmanifest_APPID.acf y construye un Game.
fn parse_manifest(acf_path: &Path) -> Option<Game> {
    let content = std::fs::read_to_string(acf_path).ok()?;
    let vdf = Vdf::parse(&content).ok()?;
    let app_state = vdf.value.get_obj()?;

    let appid = app_state.get("appid")?.first()?.get_str()?.to_string();
    let name = app_state.get("name")?.first()?.get_str()?.to_string();

    let id = format!("steam:{appid}");
    // Steam se lanza por protocolo, así no dependemos de la ruta del exe.
    let launch_target = format!("steam://rungameid/{appid}");

    let mut game = Game::new(id, name, Source::Steam, launch_target);

    // Portada: Steam guarda library art en appcache/librarycache.
    // El fichero típico es <appid>_library_600x900.jpg
    game.cover_path = find_steam_cover(acf_path, &appid);

    Some(game)
}

/// Busca la portada vertical cacheada por Steam para un appid.
fn find_steam_cover(acf_path: &Path, appid: &str) -> Option<String> {
    // steamapps/.. -> raíz de steam -> appcache/librarycache
    let steam_root = acf_path.parent()?.parent()?;
    let cache = steam_root.join("appcache").join("librarycache");

    let candidates = [
        format!("{appid}_library_600x900.jpg"),
        format!("{appid}_library_600x900_2x.jpg"),
        format!("{appid}_library_hero.jpg"),
    ];

    for name in candidates {
        let p = cache.join(&name);
        if p.exists() {
            return Some(p.to_string_lossy().into_owned());
        }
    }
    None
}

/// Escanea todas las bibliotecas de Steam y devuelve los juegos instalados,
/// rellenando las horas jugadas reales que Steam ya tiene guardadas.
pub fn scan() -> Result<Vec<Game>> {
    let root = match steam_root() {
        Some(r) => r,
        None => return Ok(Vec::new()), // Steam no instalado, no es un error fatal.
    };

    // Leemos el playtime una sola vez y lo aplicamos a cada juego.
    let playtime = read_playtime();

    let mut games = Vec::new();
    for folder in library_folders(&root)? {
        for entry in WalkDir::new(&folder)
            .max_depth(1)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            let is_manifest = path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("appmanifest_") && n.ends_with(".acf"))
                .unwrap_or(false);

            if is_manifest {
                if let Some(mut game) = parse_manifest(path) {
                    if !is_runtime_app(&game.name) {
                        // Aplicamos horas y última partida de Steam.
                        if let Some(appid) = game.id.strip_prefix("steam:") {
                            if let Some((secs, last)) = playtime.by_appid.get(appid) {
                                game.seconds_played = *secs;
                                game.last_played = *last;
                            }
                        }
                        games.push(game);
                    }
                }
            }
        }
    }

    Ok(games)
}

/// Steam instala runtimes y SDKs como si fueran apps. Los descartamos.
fn is_runtime_app(name: &str) -> bool {
    let n = name.to_lowercase();
    n.contains("steamworks")
        || n.contains("redistributable")
        || n.contains("steam linux runtime")
        || n.contains("proton")
}

/// Horas jugadas y última partida que Steam ya tiene guardadas localmente.
pub struct SteamPlaytime {    /// appid -> (segundos jugados, timestamp última partida)
    pub by_appid: std::collections::HashMap<String, (u64, Option<i64>)>,
}

/// Lee localconfig.vdf de cada usuario y extrae playtime + last played.
/// Steam guarda Playtime en MINUTOS bajo Software/Valve/Steam/apps/<appid>.
pub fn read_playtime() -> SteamPlaytime {
    let mut by_appid = std::collections::HashMap::new();

    let Some(root) = steam_root() else {
        return SteamPlaytime { by_appid };
    };
    let userdata = root.join("userdata");
    if !userdata.exists() {
        return SteamPlaytime { by_appid };
    }

    // Puede haber varias cuentas; recorremos todas.
    let Ok(entries) = std::fs::read_dir(&userdata) else {
        return SteamPlaytime { by_appid };
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let cfg = entry.path().join("config").join("localconfig.vdf");
        if !cfg.exists() {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&cfg) else {
            continue;
        };
        let Ok(vdf) = Vdf::parse(&content) else { continue };

        // Navegamos UserLocalConfigStore > Software > Valve > Steam > apps
        // Las claves pueden venir con distinta capitalización; probamos variantes.
        if let Some(apps) = navigate_to_apps(&vdf) {
            for (appid, values) in apps.iter() {
                let Some(app_obj) = values.first().and_then(|v| v.get_obj()) else {
                    continue;
                };
                let playtime_min = app_obj
                    .get("Playtime")
                    .and_then(|v| v.first())
                    .and_then(|v| v.get_str())
                    .and_then(|s| s.parse::<u64>().ok());
                let last_played = app_obj
                    .get("LastPlayed")
                    .and_then(|v| v.first())
                    .and_then(|v| v.get_str())
                    .and_then(|s| s.parse::<i64>().ok());

                if let Some(min) = playtime_min {
                    let seconds = min * 60;
                    by_appid
                        .entry(appid.to_string())
                        .and_modify(|e: &mut (u64, Option<i64>)| {
                            // Si hay varias cuentas, nos quedamos con el mayor.
                            if seconds > e.0 {
                                e.0 = seconds;
                            }
                            if last_played > e.1 {
                                e.1 = last_played;
                            }
                        })
                        .or_insert((seconds, last_played));
                }
            }
        }
    }

    SteamPlaytime { by_appid }
}

/// Navega el árbol del VDF hasta el nodo "apps", tolerando capitalización.
fn navigate_to_apps<'a>(
    vdf: &'a Vdf<'a>,
) -> Option<&'a keyvalues_parser::Obj<'a>> {
    fn get_child<'a>(
        obj: &'a keyvalues_parser::Obj<'a>,
        key: &str,
    ) -> Option<&'a keyvalues_parser::Obj<'a>> {
        // Busca la clave ignorando mayúsculas/minúsculas.
        for (k, vals) in obj.iter() {
            if k.eq_ignore_ascii_case(key) {
                return vals.first().and_then(|v| v.get_obj());
            }
        }
        None
    }

    let root = vdf.value.get_obj()?;
    let software = get_child(root, "Software")?;
    let valve = get_child(software, "Valve")?;
    let steam = get_child(valve, "Steam")?;
    get_child(steam, "apps")
}

/// Comprueba qué appids de Steam están REALMENTE instalados (su carpeta
/// de instalación existe y no está vacía). Devuelve el set de appids vivos.
/// Sirve para detectar "restos": juegos que salen en la BD pero cuya carpeta
/// ya no está (quedó solo el appmanifest o entradas sueltas).
pub fn installed_appids() -> std::collections::HashSet<String> {
    let mut alive = std::collections::HashSet::new();
    let Some(root) = steam_root() else {
        return alive;
    };
    let Ok(folders) = library_folders(&root) else {
        return alive;
    };

    for steamapps in folders {
        for entry in WalkDir::new(&steamapps)
            .max_depth(1)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            let is_manifest = path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("appmanifest_") && n.ends_with(".acf"))
                .unwrap_or(false);
            if !is_manifest {
                continue;
            }
            let Ok(content) = std::fs::read_to_string(path) else {
                continue;
            };
            let Ok(vdf) = Vdf::parse(&content) else { continue };
            let Some(app) = vdf.value.get_obj() else { continue };
            let appid = app
                .get("appid")
                .and_then(|v| v.first())
                .and_then(|v| v.get_str());
            let installdir = app
                .get("installdir")
                .and_then(|v| v.first())
                .and_then(|v| v.get_str());

            if let (Some(appid), Some(installdir)) = (appid, installdir) {
                let game_dir = steamapps.join("common").join(installdir);
                // Vivo si la carpeta existe y tiene al menos un fichero dentro.
                let has_content = game_dir.exists()
                    && std::fs::read_dir(&game_dir)
                        .map(|mut d| d.next().is_some())
                        .unwrap_or(false);
                if has_content {
                    alive.insert(appid.to_string());
                }
            }
        }
    }
    alive
}
