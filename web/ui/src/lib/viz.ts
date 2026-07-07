import { useEffect, useState } from "react";

// Validated data-viz palette (dataviz skill reference instance). Both modes are
// selected sets — the dark column is the 8 hues re-stepped for the dark surface,
// not an auto-flip. Order is the CVD-safety mechanism; do not reorder.
const CATEGORICAL_LIGHT = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];
const CATEGORICAL_DARK = ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767", "#d55181", "#d95926"];

// Status palette (fixed, never themed). Used for risk buckets + health scores,
// always paired with a text label (relief for the sub-3:1 light contrast).
export const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" };

// Risk bucket -> status color (traffic-light; low = safe, high = risky).
export const BUCKET_STATUS: Record<string, string> = {
  low: STATUS.good, mid: STATUS.warning, high: STATUS.critical,
};

const INK = {
  light: { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7", surface: "#fcfcfb" },
  dark: { primary: "#ffffff", secondary: "#c3c2b7", muted: "#898781", grid: "#2c2c2a", axis: "#383835", surface: "#1a1a19" },
};

function matchDark(): boolean {
  const root = document.documentElement;
  if (root.classList.contains("dark") || root.dataset.theme === "dark") return true;
  if (root.classList.contains("light") || root.dataset.theme === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Re-renders charts when the viewer's theme (class, data-theme, or OS) changes. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(matchDark);
  useEffect(() => {
    const on = () => setDark(matchDark());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", on);
    const obs = new MutationObserver(on);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => { mq.removeEventListener("change", on); obs.disconnect(); };
  }, []);
  return dark;
}

export function useViz() {
  const dark = useIsDark();
  return {
    dark,
    categorical: dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
    ink: dark ? INK.dark : INK.light,
    status: STATUS,
    bucket: BUCKET_STATUS,
  };
}

/** Health-score band color (status semantics, always beside a numeric label). */
export function scoreColor(score: number): string {
  if (score >= 70) return STATUS.good;
  if (score >= 40) return STATUS.warning;
  return STATUS.critical;
}
