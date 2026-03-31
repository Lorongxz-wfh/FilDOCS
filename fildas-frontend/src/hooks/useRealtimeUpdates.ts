import React from "react";
import echo from "../lib/echo";
import { getAuthUser } from "../lib/auth";
import type { Announcement } from "../services/announcementsApi";

interface UseRealtimeUpdatesOptions {
  onNotification?: (notification: any) => void;
  onAnnouncement?: (announcement: Announcement) => void;
  requestId?: number | null;
  onRequestMessage?: (message: any) => void;
  // Workspace-wide refresh (stats/charts)
  onWorkspaceChange?: (data: { source: string }) => void;
  // Document-specific workflow update
  documentVersionId?: number | null;
  onWorkflowUpdate?: (data: any) => void;
}

export function useRealtimeUpdates({
  onNotification,
  onAnnouncement,
  requestId,
  onRequestMessage,
  onWorkspaceChange,
  documentVersionId,
  onWorkflowUpdate,
}: UseRealtimeUpdatesOptions = {}) {
  const user = getAuthUser();
  const userId = user?.id;

  // ── Private user channel — notifications ──────────────────────────────
  React.useEffect(() => {
    if (!userId) return;

    const channel = echo.private(`user.${userId}`);
    
    if (onNotification) {
      channel.listen(".notification.created", (data: any) => {
        onNotification(data);
        // Also fire the existing polling event so NotificationBell updates
        window.dispatchEvent(new Event("notifications:refresh"));
      });
    }

    if (onWorkflowUpdate) {
      // Listen for task assignments on the user channel as well
      channel.listen(".workflow.updated", (data: any) => {
        onWorkflowUpdate(data);
      });
    }

    return () => {
      echo.leave(`user.${userId}`);
    };
  }, [userId, onNotification, onWorkflowUpdate]);

  // ── Presence announcements channel ────────────────────────────────────
  React.useEffect(() => {
    if (!onAnnouncement) return;

    const channel = echo.join("announcements");
    channel.listen(".announcement.created", (data: Announcement) => {
      onAnnouncement(data);
    });

    return () => {
      echo.leave("announcements");
    };
  }, [onAnnouncement]);

  // ── Private request channel — messages ────────────────────────────────
  React.useEffect(() => {
    if (!requestId || !onRequestMessage) return;

    const channel = echo.private(`request.${requestId}`);
    channel.listen(".message.posted", (data: any) => {
      onRequestMessage(data);
    });

    return () => {
      if (requestId) echo.leave(`request.${requestId}`);
    };
  }, [requestId, onRequestMessage]);

  // ── Private workspace channel — stats refresh ────────────────────────
  React.useEffect(() => {
    if (!onWorkspaceChange) return;

    const channel = echo.private("workspace");
    channel.listen(".workspace.changed", (data: any) => {
      onWorkspaceChange(data);
    });

    return () => {
      echo.leave("workspace");
    };
  }, [onWorkspaceChange]);

  // ── Private document channel — workflow flow ─────────────────────────
  React.useEffect(() => {
    if (!documentVersionId || !onWorkflowUpdate) return;

    const channel = echo.private(`document.${documentVersionId}`);
    channel.listen(".workflow.updated", (data: any) => {
      onWorkflowUpdate(data);
    });

    return () => {
      if (documentVersionId) echo.leave(`document.${documentVersionId}`);
    };
  }, [documentVersionId, onWorkflowUpdate]);
}
