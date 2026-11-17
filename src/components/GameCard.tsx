import { convertFileSrc } from "@tauri-apps/api/core";
import type { Game } from "../lib/types";
import { SOURCE_LABELS, STATUS_LABELS } from "../lib/types";
import { formatPlaytime } from "../lib/format";

interface Props {
  game: Game;
  onClick: () => void;
  enriching?: boolean;
}

export function GameCard({ game, onClick, enriching }: Props) {
  const cover = game.cover_path ? convertFileSrc(game.cover_path) : null;
  const showLoading = !cover && enriching;

  // Línea de contexto: origen · género principal (si lo hay)
  const context = [
    SOURCE_LABELS[game.source],
    game.genres[0] ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button className="card" onClick={onClick} aria-label={`Abrir ${game.name}`}>
      {game.platinum && (
        <span className="card-platinum" title="Platinado">✦</span>
      )}

      {showLoading && <div className="card-loading" />}

      {cover ? (
        <img className="card-cover" src={cover} alt="" loading="lazy" />
      ) : (
        !showLoading && <div className="card-fallback">{game.name.charAt(0)}</div>
      )}

      <div className="card-veil">
        <div className="card-title">{game.name}</div>
        <div className="card-context">{context}</div>
        <div className="card-meta">
          <span className={`status-dot ${game.status}`} />
          {game.status === "backlog"
            ? formatPlaytime(game.seconds_played)
            : `${STATUS_LABELS[game.status]} · ${formatPlaytime(game.seconds_played)}`}
        </div>
      </div>
    </button>
  );
}
