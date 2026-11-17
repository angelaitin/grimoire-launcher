import { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Game, Status } from "../lib/types";
import { STATUS_LABELS, SOURCE_LABELS } from "../lib/types";
import { formatPlaytime, formatRelative } from "../lib/format";
import { api, trackSession } from "../lib/api";

interface Props {
  game: Game;
  onClose: () => void;
  onChange: (updated: Game) => void;
  onDelete: (id: string) => void;
  onPlay?: () => void;
  onPlatinum?: () => void;
}

export function GameDrawer({ game, onClose, onChange, onDelete, onPlay, onPlatinum }: Props) {
  const [status, setStatus] = useState<Status>(game.status);
  const [notes, setNotes] = useState(game.notes);
  const [tags, setTags] = useState<string[]>(game.tags);
  const [tagDraft, setTagDraft] = useState("");
  const [savePath, setSavePath] = useState<string | null>(game.save_path);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setStatus(game.status);
    setNotes(game.notes);
    setTags(game.tags);
    setSavePath(game.save_path);
  }, [game.id]);

  // Persiste cambios con debounce.
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .updateGame({ id: game.id, status, notes, tags, savePath })
        .then(() => onChange({ ...game, status, notes, tags, save_path: savePath }))
        .catch(console.error);
    }, 400);
    return () => clearTimeout(t);
  }, [status, notes, tags, savePath]);

  async function handlePlay(asAdmin = false) {
    setRunning(true);
    onPlay?.();
    try {
      const pid = await api.launchGame(game.id, game.launch_target, asAdmin);
      onChange({ ...game, last_played: Date.now() / 1000 });
      if (pid != null) {
        trackSession(game.id, pid, (secs) => {
          setRunning(false);
          onChange({
            ...game,
            seconds_played: game.seconds_played + secs,
            last_played: Date.now() / 1000,
          });
        });
      } else {
        setTimeout(() => setRunning(false), 4000);
      }
    } catch (e) {
      console.error(e);
      setRunning(false);
    }
  }

  async function pickSaveFolder() {
    const dir = await open({ directory: true, title: "Carpeta de guardado" });
    if (typeof dir === "string") {
      setSavePath(dir);
      setTimeout(() => api.refreshSaveTime(game.id).catch(console.error), 600);
    }
  }

  function addTag() {
    const t = tagDraft.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagDraft("");
  }

  // Elegir una portada personalizada.
  async function pickCover() {
    const file = await open({
      title: "Imagen de portada",
      filters: [{ name: "Imágenes", extensions: ["jpg", "jpeg", "png", "webp"] }],
    });
    if (typeof file === "string") {
      await api.setCustomCover(game.id, file);
      onChange({ ...game, cover_path: file });
    }
  }

  // Alternar platino manual.
  function togglePlatinum() {
    const next = !game.platinum;
    if (next) onPlatinum?.();
    api
      .setPlatinum(game.id, next)
      .then(() => onChange({ ...game, platinum: next }))
      .catch(console.error);
  }

  // Apartar: marca como apartado y cierra (desaparece de la biblioteca).
  function handleShelve() {    const newStatus: Status = status === "shelved" ? "backlog" : "shelved";
    setStatus(newStatus);
    api
      .updateGame({ id: game.id, status: newStatus, notes, tags, savePath })
      .then(() => {
        onChange({ ...game, status: newStatus });
        onClose();
      })
      .catch(console.error);
  }

  // Eliminar del todo, con confirmación.
  function handleDelete() {
    const ok = window.confirm(
      `¿Eliminar "${game.name}" del grimorio?\n\nNo borra el juego de tu disco, solo lo quita de Grimoire. Si vuelves a escanear y sigue instalado, reaparecerá.`,
    );
    if (!ok) return;
    api
      .deleteGame(game.id)
      .then(() => {
        onDelete(game.id);
        onClose();
      })
      .catch(console.error);
  }

  const hero = game.hero_path ? convertFileSrc(game.hero_path) : null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label={game.name}>
        <button className="drawer-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>

        {hero ? (
          <div
            className="drawer-hero"
            style={{ backgroundImage: `url(${hero})` }}
          />
        ) : (
          <div className="drawer-hero-fallback" />
        )}

        <div className="drawer-body">
          <h2>{game.name}</h2>
          <div className="drawer-sub">
            {SOURCE_LABELS[game.source]} · {STATUS_LABELS[status]}
            {game.developer ? ` · ${game.developer}` : ""}
            {game.release_date ? ` · ${game.release_date}` : ""}
          </div>

          {game.genres.length > 0 && (
            <div className="genre-row">
              {game.genres.map((g) => (
                <span className="genre" key={g}>
                  {g}
                </span>
              ))}
            </div>
          )}

          {game.description && <p className="desc">{game.description}</p>}

          <button className="play-btn" onClick={() => handlePlay(false)} disabled={running}>
            {running ? "En marcha…" : "▶ Invocar"}
          </button>

          {game.source === "manual" && (
            <button
              className="play-btn-admin"
              onClick={() => handlePlay(true)}
              disabled={running}
              title="Lanza el juego con permisos de administrador (UAC)"
            >
              ⛨ Invocar como administrador
            </button>
          )}

          <div className="stat-row">
            <span className="label">Tiempo jugado</span>
            <span className="value">{formatPlaytime(game.seconds_played)}</span>
          </div>
          <div className="stat-row">
            <span className="label">Última partida</span>
            <span className="value">{formatRelative(game.last_played)}</span>
          </div>
          <div className="stat-row">
            <span className="label">Último guardado</span>
            <span className="value">{formatRelative(game.last_save)}</span>
          </div>

          {/* Logros de Steam, si se han sincronizado */}
          {game.ach_total != null && game.ach_total > 0 && (
            <div className="ach-block">
              <div className="ach-head">
                <span className="label">Logros</span>
                <span className="ach-count">
                  {game.ach_unlocked ?? 0} / {game.ach_total}
                </span>
              </div>
              <div className="ach-bar">
                <div
                  className="ach-fill"
                  style={{
                    width: `${((game.ach_unlocked ?? 0) / game.ach_total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Platino */}
          <button
            className={`platinum-toggle ${game.platinum ? "on" : ""}`}
            onClick={togglePlatinum}
          >
            <span className="plat-icon">✦</span>
            {game.platinum ? "Platinado" : "Marcar platino"}
          </button>

          <div className="field-group">
            <label>Portada</label>
            <button className="btn subtle cover-btn" onClick={pickCover}>
              {game.cover_path ? "Cambiar portada" : "Poner portada"}
            </button>
          </div>

          <div className="field-group">
            <label htmlFor="status-sel">Estado</label>
            <select
              id="status-sel"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="notes-area">Notas</label>
            <textarea
              id="notes-area"
              value={notes}
              placeholder="Builds, dónde lo dejaste, recordatorios…"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label>Etiquetas</label>
            <div className="tag-input-row">
              <input
                value={tagDraft}
                placeholder="rpg, coop, pendiente…"
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
              />
              <button className="btn subtle" onClick={addTag}>
                Añadir
              </button>
            </div>
            <div className="tags">
              {tags.map((t) => (
                <span className="tag" key={t}>
                  {t}
                  <button
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    aria-label={`Quitar ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="field-group">
            <label>Carpeta de guardado</label>
            <div className="path-picker">
              <input value={savePath ?? ""} placeholder="Sin definir" readOnly />
              <button className="btn subtle" onClick={pickSaveFolder}>
                Elegir
              </button>
            </div>
          </div>

          <div className="danger-zone">
            <button className="btn-shelve" onClick={handleShelve}>
              {status === "shelved" ? "↩ Devolver a la biblioteca" : "⊘ Apartar"}
            </button>
            <button className="btn-delete" onClick={handleDelete}>
              🗑 Eliminar del grimorio
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
