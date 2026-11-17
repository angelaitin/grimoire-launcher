use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
use std::time::Duration;

/// Resultado de consultar logros: obtenidos y totales.
pub struct AchievementProgress {
    pub unlocked: u32,
    pub total: u32,
}

#[derive(Debug, Deserialize)]
struct PlayerAchievementsResponse {
    playerstats: PlayerStats,
}

#[derive(Debug, Deserialize)]
struct PlayerStats {
    #[serde(default)]
    success: bool,
    #[serde(default)]
    achievements: Vec<AchievementEntry>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AchievementEntry {
    /// 1 si está desbloqueado, 0 si no.
    achieved: u8,
}

fn client() -> Result<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("GrimoireLauncher/0.1")
        .build()
        .context("No pude crear el cliente HTTP")
}

/// Resuelve un SteamID de 64 bits a partir de una vanity URL (nombre de perfil).
/// Si el usuario ya da un steamid numérico de 17 dígitos, lo devuelve tal cual.
pub fn resolve_steamid(api_key: &str, input: &str) -> Result<String> {
    let trimmed = input.trim();
    // Si ya es un steamid64 (17 dígitos numéricos), lo usamos directamente.
    if trimmed.len() == 17 && trimmed.chars().all(|c| c.is_ascii_digit()) {
        return Ok(trimmed.to_string());
    }

    // Si pegaron una URL completa, extraemos la última parte.
    let vanity = trimmed
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or(trimmed);

    let url = format!(
        "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key={api_key}&vanityurl={vanity}"
    );
    let client = client()?;
    let resp = client.get(&url).send().context("Fallo al resolver vanity URL")?;
    let text = resp.text()?;

    #[derive(Deserialize)]
    struct ResolveResp {
        response: ResolveInner,
    }
    #[derive(Deserialize)]
    struct ResolveInner {
        #[serde(default)]
        success: u8,
        #[serde(default)]
        steamid: Option<String>,
    }

    let parsed: ResolveResp = serde_json::from_str(&text).context("Respuesta de vanity inválida")?;
    if parsed.response.success == 1 {
        parsed
            .response
            .steamid
            .ok_or_else(|| anyhow!("Sin steamid en la respuesta"))
    } else {
        Err(anyhow!(
            "No pude resolver el perfil '{vanity}'. Usa tu SteamID64 de 17 dígitos o el nombre exacto de tu URL personalizada."
        ))
    }
}

/// Consulta los logros de un juego para un usuario.
/// Devuelve None si el juego no tiene logros (herramientas, etc.).
pub fn fetch_achievements(
    api_key: &str,
    steamid: &str,
    appid: &str,
) -> Result<Option<AchievementProgress>> {
    let url = format!(
        "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid={appid}&key={api_key}&steamid={steamid}"
    );
    let client = client()?;
    let resp = client.get(&url).send()?;

    // Steam devuelve 400/500 para juegos sin logros o perfiles privados.
    if !resp.status().is_success() {
        return Ok(None);
    }

    let text = resp.text()?;
    let parsed: PlayerAchievementsResponse = match serde_json::from_str(&text) {
        Ok(p) => p,
        Err(_) => return Ok(None),
    };

    if !parsed.playerstats.success {
        // Perfil privado o sin logros: lo tratamos como "sin datos".
        if let Some(err) = parsed.playerstats.error {
            if err.contains("not public") || err.contains("Profile") {
                return Err(anyhow!("Tu perfil de Steam debe ser público para leer logros."));
            }
        }
        return Ok(None);
    }

    let total = parsed.playerstats.achievements.len() as u32;
    if total == 0 {
        return Ok(None); // Juego sin logros.
    }
    let unlocked = parsed
        .playerstats
        .achievements
        .iter()
        .filter(|a| a.achieved == 1)
        .count() as u32;

    Ok(Some(AchievementProgress { unlocked, total }))
}
