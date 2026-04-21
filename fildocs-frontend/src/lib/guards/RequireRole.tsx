import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getUserRole } from "../roleFilters";
import { getAuthUser } from "../auth";

type Props = {
  allow: string[];
  redirectTo?: string;
};

export default function RequireRole({
  allow,
  redirectTo = "/dashboard",
}: Props) {
  const loc = useLocation();

  const rawUser = getAuthUser();
  const role = String(getUserRole() ?? "")
    .trim()
    .toUpperCase();
  const ok =
    role === "ADMIN" || allow.map((r) => r.toUpperCase()).includes(role);

  if (!ok) {
    console.log("[RequireRole blocked]", {
      path: loc.pathname,
      role,
      allow,
      rawUserRole: rawUser?.role,
      hasUser: !!rawUser,
    });
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
