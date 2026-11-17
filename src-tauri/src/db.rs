use crate::models::{Game, Source, Status};
use anyhow::Result;
use rusqlite::{params, Connection};
use std::path::PathBuf;

/// Devuelve la ruta del fichero de base de datos, creándola si hace falta.
fn db_path() -> Result<PathBuf> {
    let dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("grimoire-launcher");
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("library.db"))
}

pub fn open() -> Result<Connection> {
    let conn = Connection::open(db_path()?)?;
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS games (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            source          TEXT NOT NULL,
            launch_target   TEXT NOT NULL,
            cover_path      TEXT,
            hero_path       TEXT,
            save_path       TEXT,
            genres          TEXT NOT NULL DEFAULT '[]',
            developer       TEXT,
            release_date    TEXT,
            description     TEXT,
            status          TEXT NOT NULL DEFAULT 'backlog',
            notes           TEXT NOT NULL DEFAULT '',
            tags            TEXT NOT NULL DEFAULT '[]',
            seconds_played  INTEGER NOT NULL DEFAULT 0,
            last_played     INTEGER,
            last_save       INTEGER
        );
        "#,
    )?;

    // Migración suave: si la BD es de una versión anterior, añade columnas
    // que falten sin perder datos. Ignoramos el error de "columna ya existe".
    let _ = conn.execute("ALTER TABLE games ADD COLUMN hero_path TEXT", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN genres TEXT NOT NULL DEFAULT '[]'", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN developer TEXT", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN release_date TEXT", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN description TEXT", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN platinum INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN ach_unlocked INTEGER", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN ach_total INTEGER", []);
    // Tabla para guardar la config de Steam (API key, steamid) y otros ajustes.
    let _ = conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
    );
    // Historial de sesiones de juego, para estadísticas (heatmap, rachas).
    let _ = conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS sessions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id     TEXT NOT NULL,
            played_at   INTEGER NOT NULL,
            seconds     INTEGER NOT NULL
         );",
    );

    // Tablas del módulo de emulación.
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS emulators (
            system    TEXT PRIMARY KEY,
            exe_path  TEXT NOT NULL,
            name      TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS roms (
            id              TEXT PRIMARY KEY,
            system          TEXT NOT NULL,
            title           TEXT NOT NULL,
            rom_path        TEXT NOT NULL,
            cover_path      TEXT,
            seconds_played  INTEGER NOT NULL DEFAULT 0,
            last_played     INTEGER,
            notes           TEXT NOT NULL DEFAULT ''
        );
        "#,
    )?;
    Ok(conn)
}

fn source_to_str(s: &Source) -> &'static str {
    match s {
        Source::Steam => "steam",
        Source::Epic => "epic",
        Source::Manual => "manual",
    }
}

fn str_to_source(s: &str) -> Source {
    match s {
        "steam" => Source::Steam,
        "epic" => Source::Epic,
        _ => Source::Manual,
    }
}

fn status_to_str(s: &Status) -> &'static str {
    match s {
        Status::Backlog => "backlog",
        Status::Playing => "playing",
        Status::Finished => "finished",
        Status::Abandoned => "abandoned",
        Status::Shelved => "shelved",
    }
}

fn str_to_status(s: &str) -> Status {
    match s {
        "playing" => Status::Playing,
        "finished" => Status::Finished,
        "abandoned" => Status::Abandoned,
        "shelved" => Status::Shelved,
        _ => Status::Backlog,
    }
}

/// Inserta o actualiza un juego detectado SIN pisar los datos del usuario.
/// Los campos editables (status, notes, tags) solo se rellenan al insertar.
pub fn upsert_detected(conn: &Connection, game: &Game) -> Result<()> {
    conn.execute(
        r#"
        INSERT INTO games (id, name, source, launch_target, cover_path, hero_path, save_path, seconds_played, last_played)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            launch_target = excluded.launch_target,
            cover_path = COALESCE(excluded.cover_path, games.cover_path),
            -- Las horas de Steam son la fuente de verdad: tomamos el máximo
            -- entre lo que reporta Steam y lo que ya teníamos.
            seconds_played = MAX(excluded.seconds_played, games.seconds_played),
            last_played = NULLIF(MAX(COALESCE(excluded.last_played, 0), COALESCE(games.last_played, 0)), 0)
        "#,
        params![
            game.id,
            game.name,
            source_to_str(&game.source),
            game.launch_target,
            game.cover_path,
            game.hero_path,
            game.save_path,
            game.seconds_played as i64,
            game.last_played,
        ],
    )?;
    Ok(())
}

/// Guarda los datos enriquecidos (imágenes + metadata) de un juego.
pub fn save_enrichment(conn: &Connection, game: &Game) -> Result<()> {
    conn.execute(
        r#"
        UPDATE games SET
            cover_path = COALESCE(?2, cover_path),
            hero_path = COALESCE(?3, hero_path),
            genres = ?4,
            developer = COALESCE(?5, developer),
            release_date = COALESCE(?6, release_date),
            description = COALESCE(?7, description)
        WHERE id = ?1
        "#,
        params![
            game.id,
            game.cover_path,
            game.hero_path,
            serde_json::to_string(&game.genres)?,
            game.developer,
            game.release_date,
            game.description,
        ],
    )?;
    Ok(())
}

/// Inserta un juego manual completo.
pub fn insert_manual(conn: &Connection, game: &Game) -> Result<()> {
    conn.execute(
        r#"
        INSERT INTO games (id, name, source, launch_target, cover_path, hero_path, save_path, status, notes, tags)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        "#,
        params![
            game.id,
            game.name,
            source_to_str(&game.source),
            game.launch_target,
            game.cover_path,
            game.hero_path,
            game.save_path,
            status_to_str(&game.status),
            game.notes,
            serde_json::to_string(&game.tags)?,
        ],
    )?;
    Ok(())
}

/// Devuelve todos los juegos ordenados por última vez jugado.
pub fn all_games(conn: &Connection) -> Result<Vec<Game>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, name, source, launch_target, cover_path, hero_path, save_path,
               genres, developer, release_date, description,
               status, notes, tags, seconds_played, last_played, last_save,
               platinum, ach_unlocked, ach_total
        FROM games
        ORDER BY last_played DESC NULLS LAST, name ASC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        let genres_json: String = row.get(7)?;
        let genres: Vec<String> = serde_json::from_str(&genres_json).unwrap_or_default();
        let tags_json: String = row.get(13)?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        Ok(Game {
            id: row.get(0)?,
            name: row.get(1)?,
            source: str_to_source(&row.get::<_, String>(2)?),
            launch_target: row.get(3)?,
            cover_path: row.get(4)?,
            hero_path: row.get(5)?,
            save_path: row.get(6)?,
            genres,
            developer: row.get(8)?,
            release_date: row.get(9)?,
            description: row.get(10)?,
            status: str_to_status(&row.get::<_, String>(11)?),
            notes: row.get(12)?,
            tags,
            seconds_played: row.get::<_, i64>(14)? as u64,
            last_played: row.get(15)?,
            last_save: row.get(16)?,
            platinum: row.get::<_, i64>(17)? != 0,
            ach_unlocked: row.get(18)?,
            ach_total: row.get(19)?,
        })
    })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Actualiza los campos editables por el usuario.
pub fn update_user_fields(
    conn: &Connection,
    id: &str,
    status: &Status,
    notes: &str,
    tags: &[String],
    save_path: Option<&str>,
) -> Result<()> {
    conn.execute(
        r#"
        UPDATE games SET status = ?2, notes = ?3, tags = ?4, save_path = ?5
        WHERE id = ?1
        "#,
        params![
            id,
            status_to_str(status),
            notes,
            serde_json::to_string(tags)?,
            save_path,
        ],
    )?;
    Ok(())
}

/// Registra una sesión de juego: suma segundos y actualiza last_played.
pub fn record_session(conn: &Connection, id: &str, seconds: u64, played_at: i64) -> Result<()> {
    conn.execute(
        r#"
        UPDATE games
        SET seconds_played = seconds_played + ?2, last_played = ?3
        WHERE id = ?1
        "#,
        params![id, seconds as i64, played_at],
    )?;
    // Guardamos también en el historial para las estadísticas (solo si hubo
    // tiempo real jugado; el lanzamiento inicial registra 0 y no cuenta).
    if seconds > 0 {
        conn.execute(
            "INSERT INTO sessions (game_id, played_at, seconds) VALUES (?1, ?2, ?3)",
            params![id, played_at, seconds as i64],
        )?;
    }
    Ok(())
}

/// Devuelve el historial de sesiones como pares (timestamp, segundos).
pub fn session_history(conn: &Connection) -> Result<Vec<(i64, u64)>> {
    let mut stmt = conn.prepare("SELECT played_at, seconds FROM sessions ORDER BY played_at ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)? as u64))
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Actualiza el timestamp del save más reciente.
pub fn update_last_save(conn: &Connection, id: &str, ts: i64) -> Result<()> {
    conn.execute(
        "UPDATE games SET last_save = ?2 WHERE id = ?1",
        params![id, ts],
    )?;
    Ok(())
}

/// Elimina un juego de la biblioteca por completo.
pub fn delete_game(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM games WHERE id = ?1", params![id])?;
    Ok(())
}

/// Cambia la portada de un juego (imagen personalizada del usuario).
pub fn set_cover(conn: &Connection, id: &str, cover_path: &str) -> Result<()> {
    conn.execute(
        "UPDATE games SET cover_path = ?2 WHERE id = ?1",
        params![id, cover_path],
    )?;
    Ok(())
}

/// Marca o desmarca el platino manual de un juego.
pub fn set_platinum(conn: &Connection, id: &str, platinum: bool) -> Result<()> {
    conn.execute(
        "UPDATE games SET platinum = ?2 WHERE id = ?1",
        params![id, platinum as i64],
    )?;
    Ok(())
}

/// Guarda el progreso de logros de un juego (obtenidos / totales).
pub fn set_achievements(conn: &Connection, id: &str, unlocked: u32, total: u32) -> Result<()> {
    conn.execute(
        "UPDATE games SET ach_unlocked = ?2, ach_total = ?3 WHERE id = ?1",
        params![id, unlocked as i64, total as i64],
    )?;
    Ok(())
}

/// Lee un ajuste de la tabla settings.
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

/// Guarda un ajuste en la tabla settings.
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

// ====================== EMULADORES ======================

use crate::models::{Emulator, Rom, System};

/// Asigna (o actualiza) el emulador de una consola.
pub fn set_emulator(conn: &Connection, emu: &Emulator) -> Result<()> {
    conn.execute(
        r#"
        INSERT INTO emulators (system, exe_path, name)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(system) DO UPDATE SET
            exe_path = excluded.exe_path,
            name = excluded.name
        "#,
        params![emu.system.as_str(), emu.exe_path, emu.name],
    )?;
    Ok(())
}

/// Devuelve todos los emuladores configurados.
pub fn all_emulators(conn: &Connection) -> Result<Vec<Emulator>> {
    let mut stmt = conn.prepare("SELECT system, exe_path, name FROM emulators")?;
    let rows = stmt.query_map([], |row| {
        let sys_str: String = row.get(0)?;
        Ok(Emulator {
            system: System::from_str(&sys_str).unwrap_or(System::Gba),
            exe_path: row.get(1)?,
            name: row.get(2)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Quita el emulador asignado a una consola.
pub fn delete_emulator(conn: &Connection, system: &System) -> Result<()> {
    conn.execute("DELETE FROM emulators WHERE system = ?1", params![system.as_str()])?;
    Ok(())
}

// ====================== ROMS ======================

/// Inserta una ROM.
pub fn insert_rom(conn: &Connection, rom: &Rom) -> Result<()> {
    conn.execute(
        r#"
        INSERT INTO roms (id, system, title, rom_path, cover_path, seconds_played, last_played, notes)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
        params![
            rom.id,
            rom.system.as_str(),
            rom.title,
            rom.rom_path,
            rom.cover_path,
            rom.seconds_played as i64,
            rom.last_played,
            rom.notes,
        ],
    )?;
    Ok(())
}

/// Devuelve todas las ROMs, opcionalmente filtradas por consola.
pub fn all_roms(conn: &Connection) -> Result<Vec<Rom>> {
    let mut stmt = conn.prepare(
        "SELECT id, system, title, rom_path, cover_path, seconds_played, last_played, notes
         FROM roms ORDER BY last_played DESC NULLS LAST, title ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        let sys_str: String = row.get(1)?;
        Ok(Rom {
            id: row.get(0)?,
            system: System::from_str(&sys_str).unwrap_or(System::Gba),
            title: row.get(2)?,
            rom_path: row.get(3)?,
            cover_path: row.get(4)?,
            seconds_played: row.get::<_, i64>(5)? as u64,
            last_played: row.get(6)?,
            notes: row.get(7)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Registra una sesión de juego de una ROM.
pub fn record_rom_session(conn: &Connection, id: &str, seconds: u64, played_at: i64) -> Result<()> {
    conn.execute(
        "UPDATE roms SET seconds_played = seconds_played + ?2, last_played = ?3 WHERE id = ?1",
        params![id, seconds as i64, played_at],
    )?;
    Ok(())
}

/// Actualiza notas y portada de una ROM.
pub fn update_rom(conn: &Connection, id: &str, notes: &str, cover_path: Option<&str>) -> Result<()> {
    conn.execute(
        "UPDATE roms SET notes = ?2, cover_path = COALESCE(?3, cover_path) WHERE id = ?1",
        params![id, notes, cover_path],
    )?;
    Ok(())
}

/// Elimina una ROM.
pub fn delete_rom(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM roms WHERE id = ?1", params![id])?;
    Ok(())
}
