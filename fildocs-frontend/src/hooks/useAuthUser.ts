import * as React from "react";
import { getAuthUser, AUTH_USER_KEY, type AuthUser } from "../lib/auth";

export function useAuthUser(): AuthUser | null {
  const [user, setUser] = React.useState<AuthUser | null>(() => getAuthUser());

  React.useEffect(() => {
    const onUpdate = () => setUser(getAuthUser());
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_USER_KEY) setUser(getAuthUser());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("auth_user_updated", onUpdate);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth_user_updated", onUpdate);
    };
  }, []);

  return user;
}
