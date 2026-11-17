import type { Game } from "./types";

// Una sesión es [timestamp en segundos epoch, segundos jugados].
export type Session = [number, number];

/** Clave YYYY-MM-DD local de un timestamp epoch (segundos). */
function dayKey(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Mapa día -> segundos jugados ese día. */
export function dailyTotals(sessions: Session[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const [ts, secs] of sessions) {
    const k = dayKey(ts);
    map.set(k, (map.get(k) ?? 0) + secs);
  }
  return map;
}

/**
 * Genera los datos del heatmap para los últimos `weeks` semanas.
 * Devuelve una matriz [semana][díaSemana] con segundos jugados.
 */
export function heatmapData(sessions: Session[], weeks = 26) {
  const totals = dailyTotals(sessions);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Empezamos en el lunes de hace `weeks` semanas.
  const days: { key: string; secs: number; date: Date }[] = [];
  const totalDays = weeks * 7;
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const k = dayKey(Math.floor(d.getTime() / 1000));
    days.push({ key: k, secs: totals.get(k) ?? 0, date: d });
  }

  // Agrupamos en columnas de 7 (semanas).
  const grid: { key: string; secs: number; date: Date }[][] = [];
  for (let w = 0; w < weeks; w++) {
    grid.push(days.slice(w * 7, w * 7 + 7));
  }
  return grid;
}

/** Racha actual de días seguidos jugando (terminando hoy o ayer). */
export function currentStreak(sessions: Session[]): number {
  const totals = dailyTotals(sessions);
  if (totals.size === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // Permitimos que la racha siga viva si jugó hoy o ayer.
  const todayKey = dayKey(Math.floor(cursor.getTime() / 1000));
  if (!totals.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
    const yKey = dayKey(Math.floor(cursor.getTime() / 1000));
    if (!totals.has(yKey)) return 0;
  }

  while (true) {
    const k = dayKey(Math.floor(cursor.getTime() / 1000));
    if (totals.has(k)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/** Segundos jugados en los últimos 7 días. */
export function secondsThisWeek(sessions: Session[]): number {
  const cutoff = Date.now() / 1000 - 7 * 86400;
  return sessions.filter(([ts]) => ts >= cutoff).reduce((s, [, secs]) => s + secs, 0);
}

/** Estadísticas de platinos y logros sobre la biblioteca. */
export function achievementStats(games: Game[]) {
  const platinums = games.filter((g) => g.platinum).length;
  const withAch = games.filter((g) => g.ach_total != null && g.ach_total > 0);
  const totalAch = withAch.reduce((s, g) => s + (g.ach_total ?? 0), 0);
  const unlockedAch = withAch.reduce((s, g) => s + (g.ach_unlocked ?? 0), 0);
  const pct = totalAch > 0 ? Math.round((unlockedAch / totalAch) * 100) : 0;
  return { platinums, totalAch, unlockedAch, pct, gamesWithAch: withAch.length };
}

/** Top N juegos por horas jugadas, para el gráfico de barras. */
export function topGamesByPlaytime(games: Game[], n = 8) {
  return games
    .filter((g) => g.seconds_played > 0 && g.status !== "shelved")
    .sort((a, b) => b.seconds_played - a.seconds_played)
    .slice(0, n)
    .map((g) => ({
      name: g.name.length > 18 ? g.name.slice(0, 17) + "…" : g.name,
      fullName: g.name,
      horas: Math.round((g.seconds_played / 3600) * 10) / 10,
    }));
}

/** Distribución de juego por día de la semana (lun-dom). */
export function playByWeekday(sessions: Session[]) {
  const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const buckets = new Array(7).fill(0);
  for (const [ts, secs] of sessions) {
    const d = new Date(ts * 1000);
    // getDay(): 0=domingo. Lo reordenamos a lun=0.
    const idx = (d.getDay() + 6) % 7;
    buckets[idx] += secs;
  }
  return labels.map((dia, i) => ({
    dia,
    horas: Math.round((buckets[i] / 3600) * 10) / 10,
  }));
}

/** Distribución de juego por franja horaria del día. */
export function playByHour(sessions: Session[]) {
  const buckets = new Array(24).fill(0);
  for (const [ts, secs] of sessions) {
    const h = new Date(ts * 1000).getHours();
    buckets[h] += secs;
  }
  return buckets.map((secs, h) => ({
    hora: `${String(h).padStart(2, "0")}h`,
    minutos: Math.round(secs / 60),
  }));
}

/** Reparto de horas por género (para un gráfico de tarta/dona). */
export function playByGenre(games: Game[], n = 6) {
  const totals = new Map<string, number>();
  for (const g of games) {
    if (g.status === "shelved" || g.seconds_played === 0) continue;
    // Si no tiene géneros, lo metemos en "Otros".
    const gs = g.genres.length > 0 ? g.genres : ["Otros"];
    // Repartimos las horas del juego entre sus géneros.
    const share = g.seconds_played / gs.length;
    for (const genre of gs) {
      totals.set(genre, (totals.get(genre) ?? 0) + share);
    }
  }
  const sorted = Array.from(totals.entries())
    .map(([name, secs]) => ({ name, horas: Math.round((secs / 3600) * 10) / 10 }))
    .sort((a, b) => b.horas - a.horas);
  // Agrupamos la cola en "Otros".
  if (sorted.length > n) {
    const top = sorted.slice(0, n);
    const rest = sorted.slice(n).reduce((s, x) => s + x.horas, 0);
    if (rest > 0) top.push({ name: "Otros", horas: Math.round(rest * 10) / 10 });
    return top;
  }
  return sorted;
}
