import type { Game } from "../lib/types";
import { globalStats, formatPlaytime } from "../lib/format";

interface Props {
  games: Game[];
}

export function StatsBar({ games }: Props) {
  const { total, totalSeconds, mostPlayed } = globalStats(games);

  // Horas totales redondeadas para el titular.
  const totalHours = Math.round(totalSeconds / 3600);

  return (
    <div className="stats-bar">
      <div className="stat-block">
        <span className="num">{total}</span>
        <span className="cap">Juegos invocados</span>
      </div>
      <div className="stat-block">
        <span className="num">{totalHours > 0 ? `${totalHours} h` : "—"}</span>
        <span className="cap">Tiempo total</span>
      </div>
      <div className="stat-block">
        <span className="num arcane" title={mostPlayed?.name}>
          {mostPlayed ? mostPlayed.name : "—"}
        </span>
        <span className="cap">
          {mostPlayed
            ? `Más jugado · ${formatPlaytime(mostPlayed.seconds_played)}`
            : "Más jugado"}
        </span>
      </div>
    </div>
  );
}
