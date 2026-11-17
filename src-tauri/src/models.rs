use serde::{Deserialize, Serialize};

/// Plataforma de origen de un juego.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Steam,
    Epic,
    Manual,
}

/// Estado en el que el usuario tiene el juego.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Backlog,
    Playing,
    Finished,
    Abandoned,
    Shelved,
}

impl Default for Status {
    fn default() -> Self {
        Status::Backlog
    }
}

/// Un juego en la biblioteca. Mezcla datos detectados (source, exe, portada)
/// con datos que el usuario añade (notas, tags, estado, horas jugadas).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    /// ID estable. Para Steam: "steam:APPID". Para Epic: "epic:APPNAME".
    /// Para manuales: "manual:<uuid>".
    pub id: String,
    pub name: String,
    pub source: Source,

    /// Cómo se lanza. Para Steam/Epic es un URI de protocolo,
    /// para manuales es la ruta absoluta al ejecutable o ROM.
    pub launch_target: String,

    /// Ruta a la portada local cacheada, si la hay.
    pub cover_path: Option<String>,

    /// Ruta al banner hero cacheado (imagen ancha para el detalle).
    pub hero_path: Option<String>,

    /// Carpeta de saves a vigilar (opcional, la define el usuario).
    pub save_path: Option<String>,

    // --- Metadata enriquecida desde Steam ---
    #[serde(default)]
    pub genres: Vec<String>,
    pub developer: Option<String>,
    pub release_date: Option<String>,
    pub description: Option<String>,

    // --- Logros y platino ---
    /// Platino manual marcado por el usuario (para externos, ROMs, etc.).
    #[serde(default)]
    pub platinum: bool,
    /// Logros obtenidos (de Steam). None si no se han consultado.
    pub ach_unlocked: Option<u32>,
    /// Logros totales (de Steam).
    pub ach_total: Option<u32>,

    // --- Campos editables por el usuario ---
    #[serde(default)]
    pub status: Status,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub tags: Vec<String>,

    // --- Métricas ---
    /// Segundos jugados totales (los contamos nosotros, vale para no-Steam).
    #[serde(default)]
    pub seconds_played: u64,
    /// Timestamp epoch del último lanzamiento.
    pub last_played: Option<i64>,
    /// Timestamp epoch del fichero de guardado más reciente.
    pub last_save: Option<i64>,
}

impl Game {
    pub fn new(id: String, name: String, source: Source, launch_target: String) -> Self {
        Game {
            id,
            name,
            source,
            launch_target,
            cover_path: None,
            hero_path: None,
            save_path: None,
            genres: Vec::new(),
            developer: None,
            release_date: None,
            description: None,
            platinum: false,
            ach_unlocked: None,
            ach_total: None,
            status: Status::default(),
            notes: String::new(),
            tags: Vec::new(),
            seconds_played: 0,
            last_played: None,
            last_save: None,
        }
    }
}

/// Una consola/sistema soportado por el módulo de emulación.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum System {
    Gb,   // Game Boy / Game Boy Color
    Gba,  // Game Boy Advance
    Ds,   // Nintendo DS
}

impl System {
    pub fn as_str(&self) -> &'static str {
        match self {
            System::Gb => "gb",
            System::Gba => "gba",
            System::Ds => "ds",
        }
    }
    pub fn from_str(s: &str) -> Option<System> {
        match s {
            "gb" => Some(System::Gb),
            "gba" => Some(System::Gba),
            "ds" => Some(System::Ds),
            _ => None,
        }
    }
}

/// Configuración del emulador asignado a una consola.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Emulator {
    pub system: System,
    /// Ruta al ejecutable del emulador (ej. visualboyadvance-m.exe).
    pub exe_path: String,
    /// Nombre legible del emulador (ej. "VisualBoyAdvance-M").
    pub name: String,
}

/// Una ROM gestionada dentro del módulo de emulación.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rom {
    /// ID estable: "rom:<uuid>".
    pub id: String,
    pub system: System,
    pub title: String,
    /// Ruta absoluta al archivo de la ROM.
    pub rom_path: String,
    /// Portada opcional elegida por el usuario.
    pub cover_path: Option<String>,
    #[serde(default)]
    pub seconds_played: u64,
    pub last_played: Option<i64>,
    #[serde(default)]
    pub notes: String,
}
