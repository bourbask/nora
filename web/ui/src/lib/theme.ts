// Aesthetic settings: 3 accent themes × light/dark/auto mode. Pure presentation,
// persisted in localStorage. Accent drives the UI chrome (buttons, active tab,
// primary marks) + corner radius; the chart categorical/status palettes stay the
// validated set regardless (see viz.ts) so color-blind safety never depends on
// the accent choice. Mode 'auto' defers to the OS via prefers-color-scheme.

export type Accent = "ocean" | "forest" | "sunset";
export type Mode = "auto" | "light" | "dark";

export interface Settings { accent: Accent; mode: Mode }

export const THEMES: Record<Accent, { label: string; swatch: string; primary: string; ring: string; radius: string }> = {
  ocean:  { label: "Océan",  swatch: "#2a78d6", primary: "221 83% 53%", ring: "221 83% 53%", radius: "0.75rem" },
  forest: { label: "Forêt",  swatch: "#1baf7a", primary: "160 74% 39%", ring: "160 74% 39%", radius: "0.5rem" },
  sunset: { label: "Sunset", swatch: "#7c5cff", primary: "262 83% 62%", ring: "262 83% 62%", radius: "1rem" },
};

const KEY = "nora.settings";
const DEFAULT: Settings = { accent: "ocean", mode: "auto" };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT;
}

export function applySettings(s: Settings) {
  const root = document.documentElement;
  // mode: 'auto' removes the override so the prefers-color-scheme @media wins.
  if (s.mode === "auto") delete root.dataset.theme;
  else root.dataset.theme = s.mode;

  const t = THEMES[s.accent];
  root.dataset.accent = s.accent;
  root.style.setProperty("--primary", t.primary);
  root.style.setProperty("--ring", t.ring);
  root.style.setProperty("--radius", t.radius);

  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
