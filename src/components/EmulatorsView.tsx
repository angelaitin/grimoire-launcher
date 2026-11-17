import { useState, useEffect, useMemo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Emulator, Rom, EmuSystem } from "../lib/types";
import {
  SYSTEM_LABELS,
  SYSTEM_EXTENSIONS,
  SUGGESTED_EMULATORS,
} from "../lib/types";
import { api } from "../lib/api";
import { formatPlaytime, formatRelative } from "../lib/format";

const SYSTEMS: EmuSystem[] = ["gb", "gba", "ds"];

export function EmulatorsView() {
  const [active, setActive] = useState<EmuSystem>("gba");
  const [emulators, setEmulators] = useState<Emulator[]>([]);
  const [roms, setRoms] = useState<Rom[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);

  useEffect(() => {
    api.getEmulators().then(setEmulators).catch(console.error);
    api.getRoms().then(setRoms).catch(console.error);
  }, []);

  const currentEmu = emulators.find((e) => e.system === active) ?? null;
  const systemRoms = useMemo(
    () => roms.filter((r) => r.system === active),
    [roms, active],
  );

  async function pickEmulator() {
    const file = await open({
      title: `Ejecutable del emulador para ${SYSTEM_LABELS[active]}`,
      filters: [{ name: "Ejecutables", extensions: ["exe", "app", "AppImage", "*"] }],
    });
    if (typeof file === "string") {
      // Deriva un nombre legible del ejecutable.
      const base = file.split(/[/\\]/).pop() ?? "Emulador";
      const name = base.replace(/\.[^.]+$/, "");
      await api.setEmulator(active, file, name);
      setEmulators(await api.getEmulators());
    }
  }

  async function removeEmu() {
    await api.removeEmulator(active);
    setEmulators(await api.getEmulators());
  }

  async function addRom() {
    if (!currentEmu) return;
    const file = await open({
      title: `ROM de ${SYSTEM_LABELS[active]}`,
      filters: [
        { name: SYSTEM_LABELS[active], extensions: SYSTEM_EXTENSIONS[active] },
        { name: "Todos", extensions: ["*"] },
      ],
    });
    if (typeof file === "string") {
      const base = file.split(/[/\\]/).pop() ?? "ROM";
      const title = base.replace(/\.[^.]+$/, "");
      const rom = await api.addRom({ system: active, title, romPath: file });
      setRoms((prev) => [rom, ...prev]);
    }
  }

  async function play(rom: Rom) {
    setRunningId(rom.id);
    try {
      const pid = await api.launchRom(rom.id);
      // Cronometramos hasta que el emulador cierre.
      trackSessionRom(rom.id, pid, () => {
        setRunningId(null);
        api.getRoms().then(setRoms).catch(console.error);
      });
    } catch (e) {
      console.error(e);
      alert(String(e));
      setRunningId(null);
    }
  }

  async function removeRom(rom: Rom) {
    if (!window.confirm(`¿Quitar "${rom.title}" de la biblioteca de ROMs?`)) return;
    await api.deleteRom(rom.id);
    setRoms((prev) => prev.filter((r) => r.id !== rom.id));
  }

  // Busca la carátula de la ROM en la base de datos de libretro.
  async function findCover(rom: Rom) {
    try {
      const cover = await api.fetchRomCover(rom.id);
      if (cover) {
        setRoms((prev) =>
          prev.map((r) => (r.id === rom.id ? { ...r, cover_path: cover } : r)),
        );
      } else {
        alert(
          `No encontré carátula para "${rom.title}". Prueba a renombrar la ROM con el nombre exacto del juego (ej. "Pokemon - Emerald Version (USA, Europe)").`,
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="emu-view">
      {/* Submenús por consola */}
      <div className="emu-tabs">
        {SYSTEMS.map((s) => {
          const has = emulators.some((e) => e.system === s);
          const count = roms.filter((r) => r.system === s).length;
          return (
            <button
              key={s}
              className={`emu-tab ${active === s ? "active" : ""}`}
              onClick={() => setActive(s)}
            >
              <span className="emu-tab-name">{SYSTEM_LABELS[s]}</span>
              <span className="emu-tab-meta">
                {has ? `${count} ROM${count === 1 ? "" : "s"}` : "sin emulador"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Config del emulador de la consola activa */}
      <div className="emu-config">
        {currentEmu ? (
          <div className="emu-config-set">
            <div>
              <span className="emu-config-label">Emulador</span>
              <span className="emu-config-name">{currentEmu.name}</span>
              <span className="emu-config-path">{currentEmu.exe_path}</span>
            </div>
            <div className="emu-config-actions">
              <button className="btn subtle" onClick={pickEmulator}>
                Cambiar
              </button>
              <button className="btn subtle" onClick={removeEmu}>
                Quitar
              </button>
            </div>
          </div>
        ) : (
          <div className="emu-config-empty">
            <p>
              No hay emulador asignado a {SYSTEM_LABELS[active]}. Sugerencia:{" "}
              <strong>{SUGGESTED_EMULATORS[active]}</strong>.
            </p>
            <button className="btn" onClick={pickEmulator}>
              Asignar emulador
            </button>
          </div>
        )}
      </div>

      {/* ROMs de la consola activa */}
      {currentEmu && (
        <div className="emu-roms">
          <div className="emu-roms-head">
            <h3>{SYSTEM_LABELS[active]} · ROMs</h3>
            <button className="btn" onClick={addRom}>
              + Añadir ROM
            </button>
          </div>

          {systemRoms.length === 0 ? (
            <p className="emu-roms-empty">
              Aún no has añadido ninguna ROM de {SYSTEM_LABELS[active]}.
            </p>
          ) : (
            <div className="rom-list">
              {systemRoms.map((rom) => {
                const cover = rom.cover_path ? convertFileSrc(rom.cover_path) : null;
                return (
                  <div className="rom-row" key={rom.id}>
                    <div className="rom-thumb">
                      {cover ? (
                        <img src={cover} alt="" />
                      ) : (
                        <span>{rom.title.charAt(0)}</span>
                      )}
                    </div>
                    <div className="rom-info">
                      <span className="rom-title">{rom.title}</span>
                      <span className="rom-meta">
                        {formatPlaytime(rom.seconds_played)} ·{" "}
                        {formatRelative(rom.last_played)}
                      </span>
                    </div>
                    <div className="rom-actions">
                      <button
                        className="btn"
                        onClick={() => play(rom)}
                        disabled={runningId === rom.id}
                      >
                        {runningId === rom.id ? "En marcha…" : "▶ Jugar"}
                      </button>
                      {!rom.cover_path && (
                        <button
                          className="btn subtle"
                          onClick={() => findCover(rom)}
                          title="Buscar carátula automáticamente"
                        >
                          ⬇ Carátula
                        </button>
                      )}
                      <button
                        className="rom-del"
                        onClick={() => removeRom(rom)}
                        aria-label="Quitar ROM"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Cronómetro de ROM (igual que el de juegos, pero registra en la tabla de roms).
function trackSessionRom(romId: string, pid: number, onEnd: () => void) {
  const start = Date.now();
  const timer = setInterval(async () => {
    const alive = await api.isGameRunning(pid);
    if (!alive) {
      clearInterval(timer);
      const seconds = Math.round((Date.now() - start) / 1000);
      await api.recordRomPlay(romId, seconds);
      onEnd();
    }
  }, 5000);
}
