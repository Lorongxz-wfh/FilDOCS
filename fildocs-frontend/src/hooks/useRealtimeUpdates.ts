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
  // Document-specific new comment pushed from server
  onDocumentMessage?: (message: any) => void;
}

export function useRealtimeUpdates({
  onNotification,
  onAnnouncement,
  requestId,
  onRequestMessage,
  onWorkspaceChange,
  documentVersionId,
  onWorkflowUpdate,
  onDocumentMessage,
}: UseRealtimeUpdatesOptions = {}) {
  const user = getAuthUser();
  const userId = user?.id;

  // ── Stable Refs ───────────────────────────────────────────────────────────
  // We use refs to keep the active listeners stable even if the callback
  // functions provided by components are recreated on every render.
  // This prevents the "Leave -> Join" WebSocket thrashing loop.
  const onNotificationRef = React.useRef(onNotification);
  const onAnnouncementRef = React.useRef(onAnnouncement);
  const onRequestMessageRef = React.useRef(onRequestMessage);
  const onWorkspaceChangeRef = React.useRef(onWorkspaceChange);
  const onWorkflowUpdateRef = React.useRef(onWorkflowUpdate);
  const onDocumentMessageRef = React.useRef(onDocumentMessage);

  React.useEffect(() => { onNotificationRef.current = onNotification; }, [onNotification]);
  React.useEffect(() => { onAnnouncementRef.current = onAnnouncement; }, [onAnnouncement]);
  React.useEffect(() => { onRequestMessageRef.current = onRequestMessage; }, [onRequestMessage]);
  React.useEffect(() => { onWorkspaceChangeRef.current = onWorkspaceChange; }, [onWorkspaceChange]);
  React.useEffect(() => { onWorkflowUpdateRef.current = onWorkflowUpdate; }, [onWorkflowUpdate]);
  React.useEffect(() => { onDocumentMessageRef.current = onDocumentMessage; }, [onDocumentMessage]);

  // ── Buffered Event Handlers (Anti-Gravity) ─────────────────────────────
  const eventBuffer = React.useRef<{ type: string; data: any }[]>([]);
  const eventTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const processEventBuffer = React.useCallback(() => {
    if (eventBuffer.current.length === 0) return;

    const items = [...eventBuffer.current];
    eventBuffer.current = [];
    eventTimeout.current = null;

    // Staggered sequence: 25ms delay between each distinct event type processing
    items.forEach((item, index) => {
      setTimeout(() => {
        switch (item.type) {
          case "notification":
            if (onNotificationRef.current) {
              onNotificationRef.current(item.data);
              window.dispatchEvent(new Event("notifications:refresh"));
            }
            break;
          case "workflow":
            if (onWorkflowUpdateRef.current) onWorkflowUpdateRef.current(item.data);
            break;
          case "workspace":
            if (onWorkspaceChangeRef.current) onWorkspaceChangeRef.current(item.data);
            break;
          case "message":
            if (onDocumentMessageRef.current) onDocumentMessageRef.current(item.data);
            break;
          case "request-message":
            if (onRequestMessageRef.current) onRequestMessageRef.current(item.data);
            break;
        }
      }, index * 25);
    });
  }, []);

  const queueEvent = React.useCallback(
    (type: string, data: any) => {
      eventBuffer.current.push({ type, data });
      if (!eventTimeout.current) {
        eventTimeout.current = setTimeout(processEventBuffer, 150); // Small buffer window
      }
    },
    [processEventBuffer]
  );

  // ── Private user channel — notifications ──────────────────────────────
  React.useEffect(() => {
    if (!userId) return;

    const channel = echo.private(`user.${userId}`);
    channel.listen(".notification.created", (data: any) => queueEvent("notification", data));
    channel.listen(".workflow.updated", (data: any) => queueEvent("workflow", data));

    return () => {
      echo.leave(`user.${userId}`);
    };
  }, [userId, queueEvent]);

  // ── Presence announcements channel ────────────────────────────────────
  const announcementBuffer = React.useRef<Announcement[]>([]);
  const announcementTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const processAnnouncementBuffer = React.useCallback(() => {
    if (!onAnnouncementRef.current || announcementBuffer.current.length === 0) return;

    const items = [...announcementBuffer.current];
    announcementBuffer.current = [];
    announcementTimeout.current = null;

    items.forEach((ann, index) => {
      setTimeout(() => {
        if (onAnnouncementRef.current) onAnnouncementRef.current(ann);
      }, index * 40); // Slightly slower stagger for heavy UI announcements
    });
  }, []);

  React.useEffect(() => {
    if (!onAnnouncement) return;

    const timer = setTimeout(() => {
      const channel = echo.join("announcements");
      channel.listen(".announcement.created", (data: Announcement) => {
        announcementBuffer.current.push(data);
        if (announcementTimeout.current) return;
        announcementTimeout.current = setTimeout(processAnnouncementBuffer, 100);
      });
    }, 2000);

    return () => {
      clearTimeout(timer);
      if (announcementTimeout.current) clearTimeout(announcementTimeout.current);
      echo.leave("announcements");
    };
  }, [!!onAnnouncement, processAnnouncementBuffer]);

  // ── Private request channel — messages ────────────────────────────────
  React.useEffect(() => {
    if (!requestId) return;

    const channel = echo.private(`request.${requestId}`);
    channel.listen(".message.posted", (data: any) => queueEvent("request-message", data));

    return () => {
      if (requestId) echo.leave(`request.${requestId}`);
    };
  }, [requestId, queueEvent]);

  // ── Private workspace channel — stats refresh ────────────────────────
  React.useEffect(() => {
    if (!onWorkspaceChange) return;

    const timer = setTimeout(() => {
      const channel = echo.private("workspace");
      channel.listen(".workspace.changed", (data: any) => queueEvent("workspace", data));
    }, 4000);

    return () => {
      clearTimeout(timer);
      echo.leave("workspace");
    };
  }, [!!onWorkspaceChange, queueEvent]);

  // ── Private document channel — workflow updates + comment messages ───
  React.useEffect(() => {
    if (!documentVersionId) return;

    const channel = echo.private(`document.${documentVersionId}`);
    channel.listen(".workflow.updated", (data: any) => queueEvent("workflow", data));
    channel.listen(".message.posted", (data: any) => queueEvent("message", data));

    return () => {
      if (documentVersionId) echo.leave(`document.${documentVersionId}`);
    };
  }, [documentVersionId, queueEvent]);
}
