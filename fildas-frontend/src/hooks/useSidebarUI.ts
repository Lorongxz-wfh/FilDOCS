import React from "react";
import { useAuthUser } from "./useAuthUser";

export function useSidebarUI() {
  const user = useAuthUser();
  const [newOpen, setNewOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);

  const initials = (user?.full_name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join("");

  const newRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newRef.current && !newRef.current.contains(e.target as Node)) {
        setNewOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return {
    user,
    newOpen,
    setNewOpen,
    profileOpen,
    setProfileOpen,
    imgError,
    setImgError,
    initials,
    newRef,
    profileRef,
  };
}
