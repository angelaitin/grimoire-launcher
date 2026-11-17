import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import type { Game } from "../lib/types";

interface Props {
  onClose: () => void;
  onAdded: (game: Game) => void;
}

export function AddGameModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState("");
  const [exePath, setExePath] = useState("");
  const [coverPath, setCoverPath] = useState("");
  const [savePath, setSavePath] = useState("");
  const [busy, setBusy] = useState(false);

  async function pickExe() {
    const file = await open({
      title: "Ejecutable o ROM del juego",
      filters: [
        { name: "Juegos", extensions: ["exe", "gba", "nds", "gb", "gbc", "iso", "sh", "app"] },
        { name: "Todos", extensions: ["*"] },
      ],
    });
    if (typeof file === "string") {
      setExePath(file);
      // Autocompleta el nombre con el del fichero si está vacío.
      if (!name) {
        const base = file.split(/[/\\]/).pop() ?? "";
        setName(base.replace(/\.[^.]+$/, ""));
      }
    }
  }

  async function pickCover() {
    const file = await open({
      title: "Imagen de portada",
      filters: [{ name: "Imágenes", extensions: ["jpg", "jpeg", "png", "webp"] }],
    });
    if (typeof file === "string") setCoverPath(file);
  }

  async function pickSave() {
    const dir = await open({ directory: true, title: "Carpeta de guardado" });
    if (typeof dir === "string") setSavePath(dir);
  }

  async function submit() {
    if (!name.trim() || !exePath.trim()) return;
    setBusy(true);
    try {
      const game = await api.addManualGame({
        name: name.trim(),
        exePath,
        coverPath: coverPath || null,
        savePath: savePath || null,
      });
      onAdded(game);
      onClose();
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Añadir juego externo</h2>
        <p style={{ color: "var(--parchment-dim)", fontSize: 13, marginTop: -8, marginBottom: 4, fontStyle: "italic" }}>
          Cualquier ejecutable o ROM fuera de Steam y Epic: emuladores, juegos
          portables, instalados a mano, lo que sea.
        </p>

        <div className="field-group">
          <label>Nombre</label>
          <input
            value={name}
            placeholder="Kenshi, Pokémon Esmeralda…"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="field-group">
          <label>Ejecutable o ROM</label>
          <div className="path-picker">
            <input value={exePath} placeholder="Obligatorio" readOnly />
            <button className="btn subtle" onClick={pickExe}>
              Elegir
            </button>
          </div>
        </div>

        <div className="field-group">
          <label>Portada (opcional)</label>
          <div className="path-picker">
            <input value={coverPath} placeholder="Imagen vertical" readOnly />
            <button className="btn subtle" onClick={pickCover}>
              Elegir
            </button>
          </div>
        </div>

        <div className="field-group">
          <label>Carpeta de guardado (opcional)</label>
          <div className="path-picker">
            <input value={savePath} placeholder="Para vigilar el último save" readOnly />
            <button className="btn subtle" onClick={pickSave}>
              Elegir
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn subtle" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn"
            onClick={submit}
            disabled={busy || !name.trim() || !exePath.trim()}
          >
            {busy ? "Guardando…" : "Añadir"}
          </button>
        </div>
      </div>
    </div>
  );
}
