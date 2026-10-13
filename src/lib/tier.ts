// Container-width tiers and interaction mode (rulings 58 to 60). compact below 640, expanded above
// 1024, medium in between (derived from compact by rule inside the composer). Mode is touch when
// the primary pointer is coarse.
import { useEffect, useState } from "react";

export type Tier = "compact" | "medium" | "expanded";
export type Mode = "touch" | "pointer";

export function tierFor(width: number): Tier {
  if (width < 640) return "compact";
  if (width > 1024) return "expanded";
  return "medium";
}

export function useTier(): Tier {
  const [tier, setTier] = useState<Tier>("compact");
  useEffect(() => {
    const el = document.documentElement;
    const apply = () => setTier(tierFor(el.clientWidth));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("orientationchange", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", apply);
    };
  }, []);
  return tier;
}

export function useMode(): Mode {
  const [mode, setMode] = useState<Mode>("pointer");
  useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)");
    const apply = () => setMode(mql.matches ? "touch" : "pointer");
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);
  return mode;
}

export type Theme = "light" | "dark";
const THEME_KEY = "dna.theme";

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* no storage */
  }
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* no storage */
  }
}

/**
 * Handoff 61-S1 (extraction 60-SETTINGS 3.5; rulings 1381, 1393): the member's appearance choice,
 * on the device. `system` is no stored choice, which is the default, and the theme is then the
 * device's scheme as `readTheme` already resolves it; `light` and `dark` are the stored choice.
 * Read once on mount, as `useTheme` reads it: a scheme change while the page is open moves nothing,
 * which is the behaviour tests/theme.cjs's member arm reads (1377).
 */
export type ThemeChoice = "system" | Theme;

export function readThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* no storage */
  }
  return "system";
}

export function applyThemeChoice(choice: ThemeChoice): Theme {
  if (choice !== "system") {
    applyTheme(choice);
    return choice;
  }
  try {
    localStorage.removeItem(THEME_KEY);
  } catch {
    /* no storage */
  }
  const t = readTheme();
  document.documentElement.setAttribute("data-theme", t);
  return t;
}

export function useThemeChoice(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    setChoice(readThemeChoice());
  }, []);
  return [
    choice,
    (c) => {
      applyThemeChoice(c);
      setChoice(c);
    },
  ];
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("theme");
    const t = q === "dark" || q === "light" ? q : readTheme();
    document.documentElement.setAttribute("data-theme", t);
    setTheme(t);
  }, []);
  return [
    theme,
    (t) => {
      applyTheme(t);
      setTheme(t);
    },
  ];
}

/** Expanded canvas breakpoint (ruling 79, corrected by 86): both rails render at 1440 and above. */
export const WIDE_MIN = 1440;

export function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const apply = () => setWide(el.clientWidth >= WIDE_MIN);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return wide;
}
