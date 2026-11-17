import { useState, useEffect } from "react";
import type { Game } from "../lib/types";
import { api, onEnrichDone } from "../lib/api";
import { GameCard } from "./GameCard";

interface Props {
  games: Game[];
  onSelect: (game: Game) => void;
  onGamesUpdate: () => void;
}

export function PlatinumsView({ games, onSelect, onGamesUpdate }: Props) {
  const [hasKey, setHasKey] = useState(false);
  const [steamId, setSteamId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [profile, setProfile] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    api.getSteamConfig().then(([has, id]) => {
      setHasKey(has);
      setSteamId(id);
      if (!has) setConfigOpen(true);
    });
  }, []);

  useEffect(() => {
    const off = onEnrichDone(() => {});
    return () => {
      off.then((f) => f());
    };
  }, []);

  const platinums = games.filter((g) => g.platinum);

  async function saveConfig() {
    setSaving(true);
    setError(null);
    try {
      const id = await api.saveSteamConfig(apiKey.trim(), profile.trim());
      setSteamId(id);
      setHasKey(true);
      setConfigOpen(false);
      setApiKey("");
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      await api.syncAchievements();
      // El backend emite eventos; damos un margen y refrescamos.
      const off = await onEnrichDone(() => {});
      off();
      setTimeout(() => {
        onGamesUpdate();
        setSyncing(false);
      }, 1500);
    } catch (e) {
      setError(String(e));
      setSyncing(false);
    }
  }

  return (
    <div className="platinum-view">
      <div className="plat-toolbar">
        <div className="plat-intro">
          <h2>Salón de Platinos</h2>
          <p>
            {platinums.length === 0
              ? "Aún no has platinado nada. Marca un juego como platino o sincroniza tus logros de Steam."
              : `${platinums.length} ${platinums.length === 1 ? "conquista" : "conquistas"} en tu haber.`}
          </p>
        </div>
        <div className="plat-actions">
          <button className="btn subtle" onClick={() => setConfigOpen(!configOpen)}>
            {hasKey ? "Ajustes Steam" : "Configurar Steam"}
          </button>
          {hasKey && (
            <button className="btn" onClick={sync} disabled={syncing}>
              {syncing ? "Sincronizando…" : "Sincronizar logros"}
            </button>
          )}
        </div>
      </div>

      {configOpen && (
        <div className="steam-config">
          <p className="steam-config-help">
            Para leer tus logros reales de Steam necesitas tu API key (gratis) y
            que tu perfil sea <strong>público</strong>. Saca tu key en{" "}
            <span className="link-like">steamcommunity.com/dev/apikey</span> y
            pega abajo tu SteamID64 o el nombre de tu URL de perfil.
          </p>
          <div className="field-group">
            <label>API Key de Steam</label>
            <input
              type="password"
              value={apiKey}
              placeholder="Tu clave de 32 caracteres"
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label>Perfil (SteamID64 o nombre de URL)</label>
            <input
              value={profile}
              placeholder="76561198… o tu nombre de perfil"
              onChange={(e) => setProfile(e.target.value)}
            />
          </div>
          {error && <p className="steam-error">{error}</p>}
          <div className="modal-actions">
            <button
              className="btn"
              onClick={saveConfig}
              disabled={saving || !apiKey.trim() || !profile.trim()}
            >
              {saving ? "Verificando…" : "Guardar y verificar"}
            </button>
          </div>
          {steamId && (
            <p className="steam-ok">✓ Perfil vinculado: {steamId}</p>
          )}
        </div>
      )}

      {error && !configOpen && <p className="steam-error toolbar-error">{error}</p>}

      {platinums.length > 0 && (
        <div className="library">
          <div className="grid">
            {platinums.map((g) => (
              <GameCard key={g.id} game={g} onClick={() => onSelect(g)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
