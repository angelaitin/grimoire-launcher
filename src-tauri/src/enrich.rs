use crate::models::Game;
use anyhow::{Context, Result};
use serde::Deserialize;
use std::path::PathBuf;
use std::time::Duration;

/// Carpeta donde cacheamos las imágenes descargadas.
fn cache_dir() -> Result<PathBuf> {
    let dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("grimoire-launcher")
        .join("covers");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Extrae el appid de un id "steam:APPID".
fn steam_appid(id: &str) -> Option<&str> {
    id.strip_prefix("steam:")
}

/// Cliente HTTP con timeout y user-agent decente.
fn client() -> Result<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("GrimoireLauncher/0.1")
        .build()
        .context("No pude crear el cliente HTTP")
}

/// Descarga una imagen a la caché si no existe ya. Devuelve la ruta local.
/// Prueba varias URLs en orden hasta que una responda 200.
fn download_image(
    client: &reqwest::blocking::Client,
    urls: &[String],
    filename: &str,
) -> Option<String> {
    let dir = cache_dir().ok()?;
    let dest = dir.join(filename);

    // Si ya está cacheada y pesa algo, la reutilizamos.
    if dest.exists() {
        if let Ok(meta) = std::fs::metadata(&dest) {
            if meta.len() > 1024 {
                return Some(dest.to_string_lossy().into_owned());
            }
        }
    }

    for url in urls {
        let Ok(resp) = client.get(url).send() else {
            continue;
        };
        if !resp.status().is_success() {
            continue;
        }
        let Ok(bytes) = resp.bytes() else { continue };
        // Steam devuelve a veces un placeholder diminuto; lo descartamos.
        if bytes.len() < 1024 {
            continue;
        }
        if std::fs::write(&dest, &bytes).is_ok() {
            return Some(dest.to_string_lossy().into_owned());
        }
    }
    None
}

// --- Metadata desde la API store de Steam ---

#[derive(Debug, Deserialize)]
struct AppDetailsResponse {
    success: bool,
    data: Option<AppData>,
}

#[derive(Debug, Deserialize)]
struct AppData {
    #[serde(default)]
    developers: Vec<String>,
    #[serde(default)]
    genres: Vec<GenreEntry>,
    release_date: Option<ReleaseDate>,
    short_description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GenreEntry {
    description: String,
}

#[derive(Debug, Deserialize)]
struct ReleaseDate {
    date: Option<String>,
}

/// Llama a la API de Steam para un appid y rellena metadata del juego.
fn fetch_metadata(client: &reqwest::blocking::Client, appid: &str, game: &mut Game) {
    // cc=es para fechas/idioma en español cuando sea posible.
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={appid}&cc=es&l=spanish"
    );
    let Ok(resp) = client.get(&url).send() else {
        return;
    };
    let Ok(text) = resp.text() else { return };

    // La respuesta es { "APPID": { "success": bool, "data": {...} } }
    let Ok(map) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&text) else {
        return;
    };
    let Some(entry) = map.get(appid) else { return };
    let Ok(details) = serde_json::from_value::<AppDetailsResponse>(entry.clone()) else {
        return;
    };
    if !details.success {
        return;
    }
    let Some(data) = details.data else { return };

    game.genres = data.genres.into_iter().map(|g| g.description).collect();
    game.developer = data.developers.into_iter().next();
    game.release_date = data.release_date.and_then(|r| r.date);
    game.description = data.short_description;
}

/// Enriquece un juego de Steam: descarga portada + hero + metadata.
/// Solo toca campos vacíos para no machacar lo que ya hubiera.
pub fn enrich_steam_game(game: &mut Game) -> Result<()> {    let Some(appid) = steam_appid(&game.id).map(|s| s.to_string()) else {
        return Ok(());
    };
    let client = client()?;

    // Portada vertical (si no tiene una local de la caché de Steam).
    if game.cover_path.is_none() {
        let urls = vec![
            format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/library_600x900_2x.jpg"),
            format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/library_600x900.jpg"),
            format!("https://steamcdn-a.akamaihd.net/steam/apps/{appid}/library_600x900.jpg"),
        ];
        game.cover_path = download_image(&client, &urls, &format!("steam_{appid}_cover.jpg"));
    }

    // Banner hero (imagen ancha para el panel de detalle).
    if game.hero_path.is_none() {
        let urls = vec![
            format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/library_hero.jpg"),
            format!("https://steamcdn-a.akamaihd.net/steam/apps/{appid}/library_hero.jpg"),
        ];
        game.hero_path = download_image(&client, &urls, &format!("steam_{appid}_hero.jpg"));
    }

    // Metadata (solo si aún no la tenemos).
    if game.genres.is_empty() && game.developer.is_none() {
        fetch_metadata(&client, &appid, game);
    }

    Ok(())
}

/// Nombre de carpeta de libretro para cada sistema.
fn libretro_system(system: &str) -> Option<&'static str> {
    match system {
        "gb" => Some("Nintendo - Game Boy"),
        "gba" => Some("Nintendo - Game Boy Advance"),
        "ds" => Some("Nintendo - Nintendo DS"),
        _ => None,
    }
}

/// Limpia el nombre de una ROM para que coincida con el formato de libretro:
/// quita extensión, y reemplaza caracteres inválidos por '_'.
fn clean_rom_name(title: &str) -> String {
    // libretro reemplaza & * / : ` < > ? \ | " por _
    let invalid = ['&', '*', '/', ':', '`', '<', '>', '?', '\\', '|', '"'];
    title
        .chars()
        .map(|c| if invalid.contains(&c) { '_' } else { c })
        .collect()
}

/// Descarga la carátula de una ROM desde la CDN de libretro-thumbnails.
/// Devuelve la ruta local cacheada, o None si no se encontró.
pub fn fetch_rom_cover(system: &str, title: &str, rom_id: &str) -> Option<String> {
    let folder = libretro_system(system)?;
    let clean = clean_rom_name(title);
    let client = client().ok()?;

    // URL-encode del nombre de carpeta y del fichero (espacios -> %20, etc.)
    let enc_folder = urlencode(folder);
    let enc_name = urlencode(&clean);

    let urls = vec![format!(
        "https://thumbnails.libretro.com/{enc_folder}/Named_Boxarts/{enc_name}.png"
    )];

    let safe_id = rom_id.replace(':', "_");
    download_image(&client, &urls, &format!("{safe_id}_cover.png"))
}

/// URL-encode mínimo para rutas (espacios y caracteres comunes en nombres).
fn urlencode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                out.push(b as char)
            }
            b' ' => out.push_str("%20"),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}
