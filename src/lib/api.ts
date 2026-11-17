import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Game, Status, Emulator, Rom } from "./types";

// --- Comandos directos al backend Rust ---

export const api = {
  /** Escanea Steam + Epic y devuelve la biblioteca completa. */
  scanLibrary: () => invoke<Game[]>("scan_library"),

  /** Lee la biblioteca guardada sin re-escanear (arranque rápido). */
  getLibrary: () => invoke<Game[]>("get_library"),

  /** Dispara la descarga de portadas/hero/metadata en background. */
  enrichLibrary: () => invoke<void>("enrich_library"),

  /** Lanza un juego; devuelve PID si es ejecutable directo, null si es protocolo. */
  launchGame: (id: string, target: string, admin = false) =>
    invoke<number | null>("launch_game", { id, target, admin }),

  /** Comprueba si un PID sigue vivo (cronómetro de juegos manuales). */
  isGameRunning: (pid: number) => invoke<boolean>("is_game_running", { pid }),

  /** Registra los segundos jugados de una sesión cerrada. */
  recordPlaySession: (id: string, seconds: number) =>
    invoke<void>("record_play_session", { id, seconds }),

  /** Añade un juego manual. */
  addManualGame: (args: {
    name: string;
    exePath: string;
    coverPath?: string | null;
    savePath?: string | null;
  }) =>
    invoke<Game>("add_manual_game", {
      name: args.name,
      exePath: args.exePath,
      coverPath: args.coverPath ?? null,
      savePath: args.savePath ?? null,
    }),

  /** Actualiza estado, notas, tags y carpeta de saves. */
  updateGame: (args: {
    id: string;
    status: Status;
    notes: string;
    tags: string[];
    savePath?: string | null;
  }) =>
    invoke<void>("update_game", {
      id: args.id,
      status: args.status,
      notes: args.notes,
      tags: args.tags,
      savePath: args.savePath ?? null,
    }),

  /** Refresca el timestamp del save más reciente. */
  refreshSaveTime: (id: string) =>
    invoke<number | null>("refresh_save_time", { id }),

  /** Elimina un juego de la biblioteca. */
  deleteGame: (id: string) => invoke<void>("delete_game", { id }),

  /** Asigna una portada personalizada. */
  setCustomCover: (id: string, coverPath: string) =>
    invoke<void>("set_custom_cover", { id, coverPath }),

  /** Detecta juegos de Steam con restos (no instalados). */
  detectGhostGames: () => invoke<string[]>("detect_ghost_games"),

  /** Aparta varios juegos en bloque. */
  shelveGames: (ids: string[]) => invoke<void>("shelve_games", { ids }),

  /** Historial de sesiones [timestamp, segundos]. */
  getSessionHistory: () => invoke<[number, number][]>("get_session_history"),

  /** Lee un ajuste genérico. */
  getAppSetting: (key: string) => invoke<string | null>("get_app_setting", { key }),
  /** Guarda un ajuste genérico. */
  setAppSetting: (key: string, value: string) =>
    invoke<void>("set_app_setting", { key, value }),

  /** Exporta la biblioteca (datos de usuario) a JSON. */
  exportLibrary: () => invoke<string>("export_library"),
  /** Importa un backup JSON. Devuelve nº de juegos restaurados. */
  importLibrary: (json: string) => invoke<number>("import_library", { json }),

  /** Busca y descarga la carátula de una ROM. */
  fetchRomCover: (id: string) => invoke<string | null>("fetch_rom_cover", { id }),

  /** Marca/desmarca platino manual. */
  setPlatinum: (id: string, platinum: boolean) =>
    invoke<void>("set_platinum", { id, platinum }),

  /** Guarda config de Steam y devuelve el SteamID resuelto. */
  saveSteamConfig: (apiKey: string, profile: string) =>
    invoke<string>("save_steam_config", { apiKey, profile }),

  /** Devuelve [tiene_key, steamid]. */
  getSteamConfig: () => invoke<[boolean, string | null]>("get_steam_config"),

  /** Sincroniza logros de Steam (background). */
  syncAchievements: () => invoke<void>("sync_achievements"),

  // --- Emuladores y ROMs ---

  setEmulator: (system: string, exePath: string, name: string) =>
    invoke<void>("set_emulator", { system, exePath, name }),
  getEmulators: () => invoke<Emulator[]>("get_emulators"),
  removeEmulator: (system: string) => invoke<void>("remove_emulator", { system }),

  addRom: (args: { system: string; title: string; romPath: string; coverPath?: string | null }) =>
    invoke<Rom>("add_rom", {
      system: args.system,
      title: args.title,
      romPath: args.romPath,
      coverPath: args.coverPath ?? null,
    }),
  getRoms: () => invoke<Rom[]>("get_roms"),
  launchRom: (id: string) => invoke<number>("launch_rom", { id }),
  recordRomPlay: (id: string, seconds: number) =>
    invoke<void>("record_rom_play", { id, seconds }),
  updateRom: (id: string, notes: string, coverPath?: string | null) =>
    invoke<void>("update_rom", { id, notes, coverPath: coverPath ?? null }),
  deleteRom: (id: string) => invoke<void>("delete_rom", { id }),
};

/**
 * Cronómetro de sesión para juegos manuales.
 * Hace polling del PID cada pollMs hasta que el proceso muere,
 * entonces registra los segundos transcurridos.
 */
export function trackSession(
  gameId: string,
  pid: number,
  onEnd?: (seconds: number) => void,
  pollMs = 5000,
) {
  const start = Date.now();
  const timer = setInterval(async () => {
    const alive = await api.isGameRunning(pid);
    if (!alive) {
      clearInterval(timer);
      const seconds = Math.round((Date.now() - start) / 1000);
      await api.recordPlaySession(gameId, seconds);
      onEnd?.(seconds);
    }
  }, pollMs);
  return () => clearInterval(timer);
}

/** Escucha cuando un juego se enriquece (portada/metadata lista). */
export function onGameEnriched(cb: (game: Game) => void) {
  return listen<Game>("game-enriched", (e) => cb(e.payload));
}

/** Escucha cuando termina todo el proceso de enriquecimiento. */
export function onEnrichDone(cb: () => void) {
  return listen("enrich-done", () => cb());
}

/** Convierte una ruta del sistema a una URL que el webview puede mostrar. */
export function coverUrl(path: string | null): string | null {
  if (!path) return null;
  // Tauri expone los ficheros locales via el protocolo asset.
  // convertFileSrc se importa donde se use para evitar acoplar aquí.
  return path;
}
