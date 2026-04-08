import React from "react";
import { type ThemePreference } from "./theme";

interface ThemeCtx {
  theme: ThemePreference;
  toggle: () => void;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = React.createContext<ThemeCtx>({
  theme: "system",
  toggle: () => {},
  setTheme: () => {},
});

import { useTheme } from "../hooks/useTheme";
import { getAuthUser } from "./auth";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, toggle, setTheme } = useTheme();

  // Listen for user state changes (login/sync) to force theme updates
  React.useEffect(() => {
    const syncTheme = () => {
      const user = getAuthUser();
      if (user?.theme_preference) {
        setTheme(user.theme_preference);
      }
    };

    window.addEventListener("auth_user_updated", syncTheme);
    syncTheme(); // Initial check

    return () => window.removeEventListener("auth_user_updated", syncTheme);
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  return React.useContext(ThemeContext);
}
