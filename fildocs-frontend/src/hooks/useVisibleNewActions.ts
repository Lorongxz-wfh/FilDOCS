import { useMemo } from "react";
import { getUserRole } from "../lib/roleFilters";
import { useAdminDebugMode } from "./useAdminDebugMode";
import { newActions, type NewAction } from "../components/sidebar/navConfig";

const DOC_CREATE_ROUTES = [
  "/documents/create",
  "/document-requests",
  "/templates",
];

export function useVisibleNewActions(): NewAction[] {
  const role = getUserRole();
  const adminDebugMode = useAdminDebugMode();

  return useMemo(() => {
    return newActions.filter((a) => {
      if (!a.roles) return true;
      if (a.roles.includes(role)) return true;
      if (role === "ADMIN" && adminDebugMode && DOC_CREATE_ROUTES.includes(a.to)) {
        return true;
      }
      return false;
    });
  }, [role, adminDebugMode]);
}
