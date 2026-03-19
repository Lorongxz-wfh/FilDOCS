// ── Shared date / string formatters ─────────────────────────────────────────
// Single source of truth — import from here instead of defining locally.

/** "Mar 19, 2026" — returns "—" for null/undefined */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** "Mar 19, 2026, 2:45 PM" — returns "—" for null/undefined */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
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
