use crate::models::{Game, Source};
use anyhow::Result;
use serde::Deserialize;
use std::path::PathBuf;

/// Subconjunto de los campos que nos interesan del manifiesto de Epic.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct EpicManifest {
    display_name: String,
    /// Nombre interno de la app, lo usamos para el launch URI.
    app_name: String,
    /// Carpeta de instalación.
    #[serde(default)]
    install_location: String,
    /// Si está realmente instalado.
    #[serde(default)]
    b_is_incomplete_install: bool,
}

/// Carpeta donde Epic guarda los manifiestos.
fn manifests_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let p = PathBuf::from("C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests");
        if p.exists() {
            return Some(p);
        }
        None
    }
    #[cfg(not(windows))]
    {
        // Epic solo es oficial en Windows; en otros SO no escaneamos.
        None
    }
}

/// Escanea los manifiestos de Epic y devuelve los juegos instalados.
pub fn scan() -> Result<Vec<Game>> {
    let dir = match manifests_dir() {
        Some(d) => d,
        None => return Ok(Vec::new()),
    };

    let mut games = Vec::new();
    for entry in std::fs::read_dir(&dir)?.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("item") {
            continue;
        }
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let manifest: EpicManifest = match serde_json::from_str(&content) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if manifest.b_is_incomplete_install {
            continue;
        }

        let id = format!("epic:{}", manifest.app_name);
        // Epic se lanza con su URI de protocolo.
        let launch_target = format!(
            "com.epicgames.launcher://apps/{}?action=launch&silent=true",
            manifest.app_name
        );
        let mut game = Game::new(id, manifest.display_name, Source::Epic, launch_target);
        if !manifest.install_location.is_empty() {
            game.save_path = None; // El usuario lo define luego si quiere.
        }
        games.push(game);
    }

    Ok(games)
}
