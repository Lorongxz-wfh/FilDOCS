import React from "react";
import {
  listActiveAnnouncements,
  type Announcement,
} from "../services/documents";
import { useRealtimeUpdates } from "./useRealtimeUpdates";

interface UseAnnouncementsReturn {
  announcements: Announcement[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const POLL_INTERVAL = 30_000;

export function useAnnouncements(): UseAnnouncementsReturn {
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listActiveAnnouncements();
      // Pinned first, then newest first — cap at 3 for dashboard
      const sorted = [...data].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
      setAnnouncements(sorted.slice(0, 1));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    load();
  }, [load]);

  // Burst poll every 30s
  React.useEffect(() => {
    const id = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  // ── Realtime: instant announcement updates via Pusher ──────────────────
  useRealtimeUpdates({
    onAnnouncement: React.useCallback((ann: Announcement) => {
      setAnnouncements((prev) => {
        if (prev.find((a) => a.id === ann.id)) return prev;
        const next = ann.is_pinned ? [ann, ...prev] : [...prev, ann];
        return next;
      });
    }, []),
  });

  return { announcements, loading, error, reload: load };
}
