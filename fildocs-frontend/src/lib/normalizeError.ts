/**
 * Converts any caught error into a clean, user-friendly message.
 * Never exposes SQL, stack traces, or HTTP codes to the user.
 */
export function normalizeError(err: unknown): string {
  if (!err) return "Something went wrong. Please try again.";

  // Axios / fetch response errors
  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, any>;

    // Laravel validation — show first field message
    if (e.response?.data?.errors) {
      const firstField = Object.values(e.response.data.errors as Record<string, string[]>)[0];
      if (Array.isArray(firstField) && firstField.length > 0) return firstField[0];
    }

    // Laravel `message` field
    if (e.response?.data?.message) {
      const msg: string = e.response.data.message;
      // Block raw technical messages
      if (!isTechnical(msg)) return msg;
    }

    // HTTP status fallbacks
    const status: number = e.response?.status ?? 0;
    if (status === 401) return "Your session has expired. Please log in again.";
    if (status === 403) return "You don't have permission to do that.";
    if (status === 404) return "The item you're looking for could not be found.";
    if (status === 409) return "This action conflicts with existing data. Please refresh and try again.";
    if (status === 413) return "The file you uploaded is too large.";
    if (status === 422) return "Some of the information provided is invalid. Please check and try again.";
    if (status >= 500) return "A server error occurred. Please try again in a moment.";

    // Network / timeout
    if (e.code === "ERR_NETWORK" || e.message === "Network Error")
      return "Unable to reach the server. Check your connection and try again.";

    // Generic Error object
    if (typeof e.message === "string" && !isTechnical(e.message)) return e.message;
  }

  if (typeof err === "string" && !isTechnical(err)) return err;

  return "Something went wrong. Please try again.";
}

function isTechnical(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("sqlstate") ||
    lower.includes("exception") ||
    lower.includes("stack trace") ||
    lower.includes("undefined") ||
    lower.includes("null") ||
    /error code \d+/.test(lower) ||
    lower.startsWith("call to")
  );
}
