import { useState, useEffect, useMemo, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { Game, Status } from "./lib/types";
import { STATUS_LABELS } from "./lib/types";
import { api, onGameEnriched, onEnrichDone } from "./lib/api";
import { sortGames, formatPlaytime, type SortMode } from "./lib/format";
import { GameCard } from "./components/GameCard";
import { GameDrawer } from "./components/GameDrawer";
import { AddGameModal } from "./components/AddGameModal";
import { StatsBar } from "./components/StatsBar";
import { EmulatorsView } from "./components/EmulatorsView";
import { PlatinumsView } from "./components/PlatinumsView";
import { StatsView } from "./components/StatsView";
import { GrowingVines } from "./components/GrowingVines";
import { isMuted, setMuted, playWhoosh, playTick, playPlatinum } from "./lib/sound";
import { THEMES, applyTheme, getTheme, type Theme } from "./lib/theme";
import crest from "./assets/crest.png";

type Filter = "all" | Status;
type MainTab = "library" | "platinums" | "stats" | "emulators";

export default function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [tab, setTab] = useState<MainTab>("library");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [selected, setSelected] = useState<Game | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [query, setQuery] = useState("");
  const [muted, setMutedState] = useState(isMuted());
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [themeOpen, setThemeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vines, setVines] = useState(false);
  const [ghosts, setGhosts] = useState<string[]>([]);
  const [ghostDismissed, setGhostDismissed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const enrichingIds = useRef<Set<string>>(new Set());

  // Eventos de enriquecimiento en vivo.
  useEffect(() => {
    const unsubs: Array<Promise<() => void>> = [];
    unsubs.push(
      onGameEnriched((updated) => {
        enrichingIds.current.delete(updated.id);
        setGames((prev) =>
          prev.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)),
        );
        setSelected((sel) =>
          sel && sel.id === updated.id ? { ...sel, ...updated } : sel,
        );
      }),
    );
    unsubs.push(onEnrichDone(() => setEnriching(false)));
    return () => {
      unsubs.forEach((p) => p.then((off) => off()));
    };
  }, []);

  // Arranque.
  useEffect(() => {
    api
      .getLibrary()
      .then((g) => {
        setGames(g);
        setLoading(false);
        if (g.length === 0) handleScan();
        else {
          startEnrich(g);
          // Detecta restos en segundo plano.
          api.detectGhostGames().then(setGhosts).catch(console.error);
        }
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  // Atajos de teclado globales.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ctrl/Cmd + K enfoca la búsqueda.
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setTab("library");
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      // Escape cierra el panel.
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Aplica el tema guardado al montar (lo lee de la BD).
  useEffect(() => {
    api
      .getAppSetting("theme")
      .then((saved) => {
        if (saved && saved in THEMES) {
          applyTheme(saved as Theme);
          setThemeState(saved as Theme);
        } else {
          applyTheme(theme);
        }
      })
      .catch(() => applyTheme(theme));
  }, []);

  function changeTheme(t: Theme) {
    applyTheme(t);
    setThemeState(t);
    setThemeOpen(false);
    api.setAppSetting("theme", t).catch(console.error);
  }

  function startEnrich(list: Game[]) {
    const pending = list.filter(
      (g) =>
        g.source === "steam" &&
        (!g.cover_path || !g.hero_path || g.genres.length === 0),
    );
    if (pending.length === 0) return;
    pending.forEach((g) => enrichingIds.current.add(g.id));
    setEnriching(true);
    api.enrichLibrary().catch(console.error);
  }

  async function handleScan() {
    setScanning(true);
    try {
      const g = await api.scanLibrary();
      setGames(g);
      startEnrich(g);
      api.detectGhostGames().then(setGhosts).catch(console.error);
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  }

  function patchGame(updated: Game) {
    setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    if (selected?.id === updated.id) setSelected(updated);
  }

  function openGame(g: Game) {
    playTick();
    // Las zarzas crecen primero; el panel "nace" de ellas a media animación.
    setSelected(null);
    setVines(false);
    requestAnimationFrame(() => setVines(true));
    // El panel aparece cuando los tallos ya han subido (~440ms).
    setTimeout(() => setSelected(g), 440);
    // Las zarzas se desvanecen tras florecer.
    setTimeout(() => setVines(false), 1000);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  async function shelveGhosts() {
    await api.shelveGames(ghosts);
    setGames((prev) =>
      prev.map((g) =>
        ghosts.includes(g.id) ? { ...g, status: "shelved" as Status } : g,
      ),
    );
    setGhosts([]);
  }

  // Exporta la biblioteca a un archivo JSON.
  async function exportBackup() {
    try {
      const json = await api.exportLibrary();
      const path = await saveDialog({
        title: "Guardar backup de Grimoire",
        defaultPath: "grimoire-backup.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (path) {
        await writeTextFile(path, json);
      }
    } catch (e) {
      console.error(e);
      alert("No pude exportar: " + String(e));
    }
  }

  // Importa un backup desde un archivo JSON.
  async function importBackup() {
    try {
      const path = await openDialog({
        title: "Elegir backup de Grimoire",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (typeof path === "string") {
        const json = await readTextFile(path);
        const restored = await api.importLibrary(json);
        const fresh = await api.getLibrary();
        setGames(fresh);
        alert(`Backup restaurado: ${restored} juegos actualizados.`);
      }
    } catch (e) {
      console.error(e);
      alert("No pude importar: " + String(e));
    }
  }

  const filtered = useMemo(() => {
    const base = games.filter((g) => {
      if (filter === "shelved") {
        if (g.status !== "shelved") return false;
      } else {
        if (g.status === "shelved") return false;
        if (filter !== "all" && g.status !== filter) return false;
      }
      // Filtro por género o tag (un mismo selector para ambos).
      if (genreFilter) {
        const inGenres = g.genres.includes(genreFilter);
        const inTags = g.tags.includes(genreFilter);
        if (!inGenres && !inTags) return false;
      }
      const matchQuery =
        !query || g.name.toLowerCase().includes(query.toLowerCase());
      return matchQuery;
    });
    return sortGames(base, sort);
  }, [games, filter, genreFilter, query, sort]);

  // Géneros y tags únicos presentes en la biblioteca, para el selector.
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => {
      if (g.status !== "shelved") {
        g.genres.forEach((x) => set.add(x));
        g.tags.forEach((x) => set.add(x));
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [games]);

  // "Continuar jugando": los 4 más recientes con horas.
  const continuePlaying = useMemo(() => {
    return games
      .filter((g) => g.status !== "shelved" && g.last_played)
      .sort((a, b) => (b.last_played ?? 0) - (a.last_played ?? 0))
      .slice(0, 4);
  }, [games]);

  const filters: Filter[] = ["all", "playing", "backlog", "finished", "abandoned", "shelved"];
  const shelvedCount = useMemo(
    () => games.filter((g) => g.status === "shelved").length,
    [games],
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="crest" src={crest} alt="Grimoire" />
          <h1>Grimoire</h1>
        </div>

        <nav className="main-nav">
          <button className={`main-nav-tab ${tab === "library" ? "active" : ""}`} onClick={() => setTab("library")}>Biblioteca</button>
          <button className={`main-nav-tab ${tab === "platinums" ? "active" : ""}`} onClick={() => setTab("platinums")}>Platinos</button>
          <button className={`main-nav-tab ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>Estadísticas</button>
          <button className={`main-nav-tab ${tab === "emulators" ? "active" : ""}`} onClick={() => setTab("emulators")}>Emuladores</button>
        </nav>

        <div className="topbar-spacer" />

        <div className="theme-picker">
          <button
            className="icon-btn"
            onClick={() => setThemeOpen(!themeOpen)}
            title="Ambiente"
          >
            ✦
          </button>
          {themeOpen && (
            <div className="theme-menu">
              <span className="theme-menu-title">Ambiente</span>
              {(Object.values(THEMES)).map((t) => (
                <button
                  key={t.id}
                  className={`theme-option ${theme === t.id ? "active" : ""}`}
                  onClick={() => changeTheme(t.id)}
                >
                  <span
                    className="theme-swatch"
                    style={{
                      background: t.auraColor.replace(/[\d.]+\)$/, "0.9)"),
                      filter: t.thornFilter,
                    }}
                  />
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="icon-btn" onClick={toggleMute} title={muted ? "Activar sonido" : "Silenciar"}>
          {muted ? "🔇" : "🔊"}
        </button>

        <div className="theme-picker">
          <button className="icon-btn" onClick={() => setSettingsOpen(!settingsOpen)} title="Ajustes y backup">
            ⚙
          </button>
          {settingsOpen && (
            <div className="theme-menu">
              <span className="theme-menu-title">Backup</span>
              <button className="theme-option" onClick={() => { setSettingsOpen(false); exportBackup(); }}>
                ⭳ Exportar biblioteca
              </button>
              <button className="theme-option" onClick={() => { setSettingsOpen(false); importBackup(); }}>
                ⭱ Importar biblioteca
              </button>
            </div>
          )}
        </div>

        {tab === "library" && (
          <>
            <input
              ref={searchRef}
              className="search-field"
              placeholder="Buscar… (Ctrl+K)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn subtle" onClick={() => setAdding(true)} title="Añade cualquier .exe o ROM fuera de Steam/Epic">
              + Juego externo
            </button>
            <button className="btn" onClick={handleScan} disabled={scanning}>
              {scanning ? "Escaneando…" : "Escanear"}
            </button>
          </>
        )}
      </header>

      {tab === "emulators" ? (
        <EmulatorsView />
      ) : tab === "platinums" ? (
        <PlatinumsView
          games={games}
          onSelect={openGame}
          onGamesUpdate={() => api.getLibrary().then(setGames).catch(console.error)}
        />
      ) : tab === "stats" ? (
        <StatsView games={games} />
      ) : (
      <>
      {!loading && games.length > 0 && <StatsBar games={games} />}

      {/* Banner de detección de restos */}
      {ghosts.length > 0 && !ghostDismissed && (
        <div className="ghost-banner">
          <span className="ghost-text">
            Detecté <strong>{ghosts.length}</strong>{" "}
            {ghosts.length === 1 ? "juego que ya no parece instalado" : "juegos que ya no parecen instalados"}{" "}
            (restos de archivos).
          </span>
          <div className="ghost-actions">
            <button className="btn" onClick={shelveGhosts}>
              Apartar {ghosts.length === 1 ? "ese" : "todos"}
            </button>
            <button className="btn subtle" onClick={() => setGhostDismissed(true)}>
              Ahora no
            </button>
          </div>
        </div>
      )}

      {/* Continuar jugando */}
      {!loading && continuePlaying.length > 0 && filter === "all" && !query && (
        <div className="continue-section">
          <h2 className="continue-title">Continuar jugando</h2>
          <div className="continue-row">
            {continuePlaying.map((g) => (
              <button key={g.id} className="continue-card" onClick={() => openGame(g)}>
                <div
                  className="continue-bg"
                  style={
                    g.hero_path
                      ? { backgroundImage: `url(${convertHero(g.hero_path)})` }
                      : g.cover_path
                      ? { backgroundImage: `url(${convertHero(g.cover_path)})` }
                      : undefined
                  }
                />
                <div className="continue-info">
                  <span className="continue-name">{g.name}</span>
                  <span className="continue-meta">{formatPlaytime(g.seconds_played)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="controls">
        {filters.map((f) => (
          <button
            key={f}
            className={`filter-chip ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Todos" : STATUS_LABELS[f]}
            {f === "shelved" && shelvedCount > 0 ? ` (${shelvedCount})` : ""}
          </button>
        ))}
        <div className="spacer" />
        {availableTags.length > 0 && (
          <select
            className="sort-select"
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            aria-label="Filtrar por género o etiqueta"
          >
            <option value="">Todos los géneros</option>
            {availableTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          aria-label="Ordenar"
        >
          <option value="recent">Recién jugado</option>
          <option value="playtime">Más horas</option>
          <option value="alpha">Alfabético</option>
        </select>
      </nav>

      <main className="library">
        {loading ? (
          <div className="loading">
            <div className="ring" />
            <p>Abriendo el grimorio</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <img className="crest-big" src={crest} alt="" />
            <h2>El grimorio está vacío</h2>
            <p>
              {games.length === 0
                ? "Escanea para invocar tus juegos de Steam y Epic, o añade uno a mano."
                : "Ningún juego encaja con este filtro."}
            </p>
            {games.length === 0 && (
              <button className="btn" onClick={handleScan} disabled={scanning}>
                {scanning ? "Escaneando…" : "Escanear ahora"}
              </button>
            )}
          </div>
        ) : (
          <div className="grid">
            {filtered.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                enriching={enrichingIds.current.has(game.id)}
                onClick={() => openGame(game)}
              />
            ))}
          </div>
        )}
      </main>

      {enriching && (
        <div className="enrich-toast">
          <span className="mini-ring" />
          Conjurando portadas…
        </div>
      )}
      </>
      )}

      <GrowingVines show={vines} />

      {selected && (
        <GameDrawer
          game={selected}
          onClose={() => setSelected(null)}
          onChange={patchGame}
          onDelete={(id) => setGames((prev) => prev.filter((g) => g.id !== id))}
          onPlay={() => playWhoosh()}
          onPlatinum={() => playPlatinum()}
        />
      )}

      {adding && (
        <AddGameModal
          onClose={() => setAdding(false)}
          onAdded={(g) => setGames((prev) => [g, ...prev])}
        />
      )}
    </div>
  );
}

// convertFileSrc para los fondos de "continuar jugando".
function convertHero(path: string): string {
  return convertFileSrc(path);
}
