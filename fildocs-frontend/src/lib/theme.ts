const THEME_KEY = "fildocs-theme";

export type ThemePreference = "light" | "dark" | "system";
export type FontSize = "small" | "default" | "large";

export function getStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(THEMES_KEY_PERSISTENT) || localStorage.getItem(THEME_KEY);
    if (v === "dark" || v === "light" || v === "system") return v as ThemePreference;
  } catch {}
  return "system";
}

const THEMES_KEY_PERSISTENT = "fildocs-pref-theme";
const FONT_SIZE_KEY = "fildocs-pref-font-size";

export function getStoredFontSize(): FontSize {
  try {
    const v = localStorage.getItem(FONT_SIZE_KEY);
    if (v === "small" || v === "default" || v === "large") return v as FontSize;
  } catch {}
  return "default";
}

export function resolveTheme(theme: ThemePreference): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);

  // Atomic class swap
  root.classList.add("theme-switching");
  
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(THEMES_KEY_PERSISTENT, theme);
  } catch {}

  // Cleanup switching state
  setTimeout(() => {
    root.classList.remove("theme-switching");
  }, 50);
}

export function applyFontSize(size: FontSize) {
  const root = document.documentElement;
  
  // Remove existing font-size classes
  root.classList.remove("font-size-small", "font-size-default", "font-size-large");
  
  // Add new one
  root.classList.add(`font-size-${size}`);
  
  try {
    localStorage.setItem(FONT_SIZE_KEY, size);
  } catch {}
}
