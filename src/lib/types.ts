// Estos tipos reflejan los structs de Rust (serde los serializa en lowercase).

export type Source = "steam" | "epic" | "manual";

export type Status = "backlog" | "playing" | "finished" | "abandoned" | "shelved";

export interface Game {
  id: string;
  name: string;
  source: Source;
  launch_target: string;
  cover_path: string | null;
  hero_path: string | null;
  save_path: string | null;
  genres: string[];
  developer: string | null;
  release_date: string | null;
  description: string | null;
  platinum: boolean;
  ach_unlocked: number | null;
  ach_total: number | null;
  status: Status;
  notes: string;
  tags: string[];
  seconds_played: number;
  last_played: number | null;
  last_save: number | null;
}

export const STATUS_LABELS: Record<Status, string> = {
  backlog: "En la cola",
  playing: "Jugando",
  finished: "Completado",
  abandoned: "Abandonado",
  shelved: "Apartado",
};

export const SOURCE_LABELS: Record<Source, string> = {
  steam: "Steam",
  epic: "Epic",
  manual: "Manual",
};

// --- Módulo de emulación ---

export type EmuSystem = "gb" | "gba" | "ds";

export interface Emulator {
  system: EmuSystem;
  exe_path: string;
  name: string;
}

export interface Rom {
  id: string;
  system: EmuSystem;
  title: string;
  rom_path: string;
  cover_path: string | null;
  seconds_played: number;
  last_played: number | null;
  notes: string;
}

export const SYSTEM_LABELS: Record<EmuSystem, string> = {
  gb: "Game Boy",
  gba: "Game Boy Advance",
  ds: "Nintendo DS",
};

// Extensiones típicas de ROM por consola, para el diálogo de archivo.
export const SYSTEM_EXTENSIONS: Record<EmuSystem, string[]> = {
  gb: ["gb", "gbc", "sgb", "zip"],
  gba: ["gba", "agb", "zip"],
  ds: ["nds", "dsi", "ids", "zip"],
};

// Emuladores sugeridos por consola (solo informativo en la UI).
export const SUGGESTED_EMULATORS: Record<EmuSystem, string> = {
  gb: "VisualBoyAdvance-M",
  gba: "VisualBoyAdvance-M",
  ds: "melonDS o DeSmuME",
};
