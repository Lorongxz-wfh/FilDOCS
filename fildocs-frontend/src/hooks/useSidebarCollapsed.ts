import { useState, useEffect } from "react";

const KEY = "fildocs_sidebar_collapsed";

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, String(collapsed));
    } catch {}
  }, [collapsed]);

  const toggle = () => setCollapsed((v) => !v);

  return { collapsed, toggle };
}
