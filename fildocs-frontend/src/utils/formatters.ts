// ── Shared date / string formatters ─────────────────────────────────────────
// Single source of truth — import from here instead of defining locally.

/** "Mar 19, 2026" — returns "—" for null/undefined */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "2:45 PM" — returns "" on parse error */
export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Full weekday+date for calendar headers: "Wednesday, March 19, 2026"
 * Appends T00:00:00 so the date is interpreted in local time, not UTC.
 * Returns the raw string on parse error.
 */
export function formatCalendarDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/** "just now", "5m ago", "3h ago", "2d ago" */
export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** "JD" from "John" + "Doe" */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}


/** 
 * Truncates in the middle: "Faculty Accompli...e.pdf" 
 * default max: 40 chars
 */
export function truncateMiddle(str: string | null | undefined, max = 40): string {
  if (!str) return "—";
  if (str.length <= max) return str;
  const chars = max - 3; // for "..."
  const startNum = Math.ceil(chars / 2);
  const endNum = Math.floor(chars / 2);
  return str.substring(0, startNum) + "..." + str.substring(str.length - endNum);
}

/** 
 * Resolves a profile photo path/url to a full URL.
 * Handles both absolute URLs and relative storage paths (Laravel).
 */
export function getAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  
  // Prepend backend storage URL if it's a relative path
  const apiUrl = (import.meta.env.VITE_API_BASE_URL as string) || "";
  const base = apiUrl.startsWith("http") 
    ? apiUrl.replace(/\/api\/?$/, "") 
    : window.location.origin; // Same host production deployment
    
  return `${base}/storage/${path.replace(/^storage\//, "")}`;
}

