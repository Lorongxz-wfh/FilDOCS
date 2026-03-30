import { getAuthUser } from "./auth";

export type UserRole =
  | "QA"
  | "OFFICE_STAFF"
  | "OFFICE_HEAD"
  | "VPAA"
  | "VPAD"
  | "VPF"
  | "VPR"
  | "PRESIDENT"
  | "SYSADMIN"
  | "ADMIN"
  | "AUDITOR";

export const getUserRole = (): UserRole => {
  const user = getAuthUser();
  const raw = String(user?.role ?? "").toUpperCase();

  if (raw === "QA") return "QA";
  if (raw === "AUDITOR") return "AUDITOR";
  if (raw === "OFFICE_STAFF" || raw === "OFFICESTAFF" || raw === "OFFICE STAFF")
    return "OFFICE_STAFF";
  if (raw === "OFFICE_HEAD" || raw === "OFFICEHEAD" || raw === "OFFICE HEAD")
    return "OFFICE_HEAD";
  if (raw === "VPAA") return "VPAA";
  if (
    raw === "VPAD" ||
    raw === "VP_ADMIN" ||
    raw === "VPADMIN" ||
    raw === "VP ADMIN"
  )
    return "VPAD";
  if (
    raw === "VPF" ||
    raw === "VP_FINANCE" ||
    raw === "VPFINANCE" ||
    raw === "VP FINANCE"
  )
    return "VPF";
  if (
    raw === "VPR" ||
    raw === "VP_RESEARCH" ||
    raw === "VPRESEARCH" ||
    raw === "VP RESEARCH"
  )
    return "VPR";
  if (raw === "PRESIDENT") return "PRESIDENT";

  if (raw === "ADMIN") return "ADMIN";

  if (raw === "SYSADMIN" || raw === "SYSTEMADMIN" || raw === "SYSTEM ADMIN")
    return "SYSADMIN";

  // fallback: treat unknown/missing role as OFFICE_STAFF (least privilege UI)
  // (RequireRole will still block protected pages)
  return "OFFICE_STAFF";
};

export const isSysAdmin = (role: UserRole): boolean => role === "SYSADMIN";

export const isPendingForRole = (_status: string, _role: UserRole): boolean => {
  // For now, do NOT drive “pending” by status strings.
  // Pending items come from /work-queue (open tasks).
  // Keep this only for optional UI filtering later.
  return false;
};

export const isQA = (role: UserRole): boolean => role === "QA";
export const isAuditor = (role: UserRole): boolean => role === "AUDITOR";
export const isOfficeStaff = (role: UserRole): boolean =>
  role === "OFFICE_STAFF";
export const isOfficeHead = (role: UserRole): boolean => role === "OFFICE_HEAD";
