// Utilidades de formato para la UI.

/** Convierte segundos jugados a un texto legible: "12 h 30 min". */
export function formatPlaytime(seconds: number): string {
  if (seconds <= 0) return "Sin jugar";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

/** Formatea un timestamp epoch (segundos) como fecha relativa en español. */
export function formatRelative(ts: number | null): string {
  if (!ts) return "Nunca";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "Hace un momento";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} d`;
  return new Date(ts * 1000).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

import type { Game } from "./types";

/** Calcula estadísticas globales de la biblioteca. */
export function globalStats(games: Game[]) {
  const total = games.length;
  const totalSeconds = games.reduce((s, g) => s + g.seconds_played, 0);
  const mostPlayed = games.reduce<Game | null>((best, g) => {
    if (!best || g.seconds_played > best.seconds_played) return g;
    return best;
  }, null);
  return {
    total,
    totalSeconds,
    mostPlayed: mostPlayed && mostPlayed.seconds_played > 0 ? mostPlayed : null,
  };
}

export type SortMode = "recent" | "playtime" | "alpha";

/** Ordena una lista de juegos según el modo elegido. */
export function sortGames(games: Game[], mode: SortMode): Game[] {
  const copy = [...games];
  switch (mode) {
    case "playtime":
      return copy.sort((a, b) => b.seconds_played - a.seconds_played);
    case "alpha":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "es"));
    case "recent":
    default:
      return copy.sort((a, b) => (b.last_played ?? 0) - (a.last_played ?? 0));
  }
}
