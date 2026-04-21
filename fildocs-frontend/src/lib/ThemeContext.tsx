import React from "react";
import { type ThemePreference, type FontSize } from "./theme";

interface ThemeCtx {
  theme: ThemePreference;
  toggle: () => void;
  setTheme: (theme: ThemePreference) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const ThemeContext = React.createContext<ThemeCtx>({
  theme: "system",
  toggle: () => {},
  setTheme: () => {},
  fontSize: "default",
  setFontSize: () => {},
});

import { useTheme } from "../hooks/useTheme";
import { getAuthUser } from "./auth";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, toggle, setTheme, fontSize, setFontSize } = useTheme();

  // Listen for user state changes (login/sync) to force theme updates
  React.useEffect(() => {
    const syncTheme = () => {
      const user = getAuthUser();
      if (user?.theme_preference) {
        setTheme(user.theme_preference);
      }
      if (user?.font_size_preference) {
        setFontSize(user.font_size_preference);
      }
    };

    window.addEventListener("auth_user_updated", syncTheme);
    syncTheme(); // Initial check

    return () => window.removeEventListener("auth_user_updated", syncTheme);
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  return React.useContext(ThemeContext);
}
