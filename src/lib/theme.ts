// Temas de ambiente: cambian el tono de las espinas de fondo y el aura.
// El filtro se aplica al SVG de espinas; las variables tiñen el aura.

export type Theme = "ember" | "intense" | "ash" | "coldblood" | "golden";

export interface ThemeDef {
  id: Theme;
  label: string;
  // Filtro CSS aplicado a la capa de espinas (recolorea el SVG rojo base).
  thornFilter: string;
  // Opacidad de las espinas.
  thornOpacity: number;
  // Gradiente del aura de fondo (la brasa que late).
  auraColor: string;
}

export const THEMES: Record<Theme, ThemeDef> = {
  ember: {
    id: "ember",
    label: "Brasa",
    thornFilter: "none",
    thornOpacity: 0.4,
    auraColor: "rgba(168, 49, 63, 0.08)",
  },
  intense: {
    id: "intense",
    label: "Intenso",
    // Más saturado y brillante: rojo encendido.
    thornFilter: "saturate(1.6) brightness(1.5)",
    thornOpacity: 0.62,
    auraColor: "rgba(204, 68, 80, 0.16)",
  },
  ash: {
    id: "ash",
    label: "Ceniza",
    // Desaturado y oscurecido: espinas casi negras, sobrio.
    thornFilter: "saturate(0.2) brightness(0.7)",
    thornOpacity: 0.32,
    auraColor: "rgba(80, 70, 66, 0.06)",
  },
  coldblood: {
    id: "coldblood",
    label: "Sangre fría",
    // Hacia el púrpura, más oscuro y siniestro.
    thornFilter: "hue-rotate(-25deg) saturate(1.1) brightness(0.85)",
    thornOpacity: 0.42,
    auraColor: "rgba(120, 40, 90, 0.1)",
  },
  golden: {
    id: "golden",
    label: "Áureo",
    // Guiño al oro viejo: gira el rojo hacia ámbar.
    thornFilter: "hue-rotate(35deg) saturate(0.9) brightness(1.2)",
    thornOpacity: 0.38,
    auraColor: "rgba(201, 162, 90, 0.1)",
  },
};

// Preferencia en memoria (el entorno no permite localStorage en artifacts,
// pero en la app de escritorio Tauri sí persiste vía backend si se desea).
let current: Theme = "ember";

export function getTheme(): Theme {
  return current;
}

export function applyTheme(theme: Theme) {
  current = theme;
  const def = THEMES[theme];
  const root = document.documentElement;
  root.style.setProperty("--thorn-filter", def.thornFilter);
  root.style.setProperty("--thorn-opacity", String(def.thornOpacity));
  root.style.setProperty("--aura-color", def.auraColor);
}
