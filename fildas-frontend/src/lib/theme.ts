const THEME_KEY = "fildas-theme";

export type ThemePreference = "light" | "dark" | "system";

export function getStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(THEMES_KEY_PERSISTENT) || localStorage.getItem(THEME_KEY);
    if (v === "dark" || v === "light" || v === "system") return v as ThemePreference;
  } catch {}
  return "system";
}

const THEMES_KEY_PERSISTENT = "fildas-pref-theme";

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
