import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVisibilityPolling } from "./useVisibilityPolling";
import { getAuthUser } from "../lib/auth";
import {
  listWorkflowTasks,
  getAvailableActions,
  submitWorkflowAction,
  listDocumentMessages,
  listActivityLogs,
  type WorkflowTask,
  type WorkflowActionCode,
  type DocumentMessage,
  type ActivityLogItem,
} from "../services/documents";
import { useRealtimeUpdates } from "./useRealtimeUpdates";

type Options = {
  versionId: number;
  isTerminal?: boolean;
  onChanged?: () => Promise<void> | void;
  onAfterActionClose?: () => void;
  myOfficeId: number | null;
  qaOfficeId: number | null;
  adminDebugMode?: boolean;
};

// Polling intervals
const IDLE_POLL_MS = 10_000; // 10s idle
const BURST_POLL_MS = 5_000; // 5s burst after action
const BURST_EXPIRE_MS = 15_000; // revert after 15s
const MSG_POLL_MS = 10_000; // 10s message poll

export function useDocumentWorkflow({
  versionId,
  isTerminal = false,
  onChanged,
  onAfterActionClose,
  myOfficeId,
  qaOfficeId,
  adminDebugMode = false,
}: Options) {
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [availableActions, setAvailableActions] = useState<
    WorkflowActionCode[]
  >([]);
  const [isTasksReady, setIsTasksReady] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const [messages, setMessages] = useState<DocumentMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [isLoadingActivityLogs, setIsLoadingActivityLogs] = useState(false);

  const [isBurstPolling, setIsBurstPolling] = useState(false);
  const burstPollRef = useRef<number | null>(null);
  const burstTimeoutRef = useRef<number | null>(null);
  const idlePollRef = useRef<number | null>(null);
  const msgPollRef = useRef<number | null>(null);

  // Change detection refs
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [taskChanged, setTaskChanged] = useState(false);
  const prevMessageCountRef = useRef<number>(0);
  const prevOpenTaskOfficeRef = useRef<number | null>(null);
  const prevActionsRef = useRef<string>("");
  const isFirstTaskLoadRef = useRef(true);
  const isFirstMessageLoadRef = useRef(true);
  const myUserIdRef = useRef<number | null>(null);
  const hasLoadedMessagesRef = useRef(false);
  const hasLoadedLogsRef = useRef(false);

  useEffect(() => {
    myUserIdRef.current = getAuthUser()?.id ?? null;
  }, []);

  // ── Stop all polling ────────────────────────────────────────────────────
  const stopAllPolling = useCallback(() => {
    setIsBurstPolling(false);
    if (burstPollRef.current) window.clearInterval(burstPollRef.current);
    if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
    if (idlePollRef.current) window.clearInterval(idlePollRef.current);
    if (msgPollRef.current) window.clearInterval(msgPollRef.current);
    burstPollRef.current =
      burstTimeoutRef.current =
      idlePollRef.current =
      msgPollRef.current =
        null;
  }, []);

  const stopBurstPolling = stopAllPolling;

  // ── Core: fetch tasks + actions together in one round-trip-pair ─────────
  const refreshTasksAndActions = useCallback(
    async (id: number, opts?: { isPolling?: boolean }) => {
      try {
        const [t, actions] = await Promise.all([
          listWorkflowTasks(id),
          getAvailableActions(id, adminDebugMode),
        ]);

        if (!isFirstTaskLoadRef.current) {
          const openTask = t.find((tk) => tk.status === "open") ?? null;
          const newOffice = openTask?.assigned_office_id ?? null;
          const newActionsKey = actions.join(",");
          const changed =
            newOffice !== prevOpenTaskOfficeRef.current ||
            newActionsKey !== prevActionsRef.current;

          if (changed) {
            setTaskChanged(true);
            setTasks(t);
            setAvailableActions(actions);
          } else if (!opts?.isPolling) {
            setTasks(t);
            setAvailableActions(actions);
          }
        } else {
          isFirstTaskLoadRef.current = false;
          setTasks(t);
          setAvailableActions(actions);
        }

        const openTask = t.find((tk) => tk.status === "open") ?? null;
        prevOpenTaskOfficeRef.current = openTask?.assigned_office_id ?? null;
        prevActionsRef.current = actions.join(",");
      } catch {
        if (!opts?.isPolling) {
          setTasks([]);
          setAvailableActions([]);
        }
        // Always mark ready even on error — prevents infinite loading skeleton
        setIsTasksReady(true);
      } finally {
        setIsTasksReady(true);
      }
    },
    [adminDebugMode],
  );

  // ── Message polling helper ───────────────────────────────────────────────
  const pollMessages = useCallback((id: number) => {
    listDocumentMessages(id)
      .then((m) => {
        setMessages(m);
        if (!isFirstMessageLoadRef.current) {
          const incoming = m.filter(
            (msg) => Number(msg.sender_user_id) !== Number(myUserIdRef.current),
          );
          const newCount = incoming.length - prevMessageCountRef.current;
          if (newCount > 0) setNewMessageCount((prev) => prev + newCount);
          prevMessageCountRef.current = incoming.length;
        } else {
          isFirstMessageLoadRef.current = false;
          const incoming = m.filter(
            (msg) => Number(msg.sender_user_id) !== Number(myUserIdRef.current),
          );
          prevMessageCountRef.current = incoming.length;
        }
      })
      .catch(() => {});
  }, []);

  // ── Activity logs: silent background refresh (used by polling) ────────────
  const silentRefreshLogs = useCallback(
    (id: number) => {
      listActivityLogs({ scope: "document", document_version_id: id, per_page: 50 })
        .then((p) => setActivityLogs(p.data))
        .catch(() => {});
    },
    [],
  );

  // ── Idle polling ────────────────────────────────────────────────────────
  const startIdlePolling = useCallback(
    (id: number) => {
      if (idlePollRef.current) window.clearInterval(idlePollRef.current);
      idlePollRef.current = window.setInterval(() => {
        refreshTasksAndActions(id, { isPolling: true }).catch(() => {});
        silentRefreshLogs(id);
      }, IDLE_POLL_MS);
    },
    [refreshTasksAndActions, silentRefreshLogs],
  );

  // ── Visibility-aware catch-up ────────────────────────────────────────────
  useVisibilityPolling(
    useCallback(() => {
      if (!versionId || versionId === 0) return;
      refreshTasksAndActions(versionId, { isPolling: true }).catch(() => {});
    }, [versionId, refreshTasksAndActions]),
    IDLE_POLL_MS,
  );

  // ── Burst polling after action ───────────────────────────────────────────
  const startBurstPolling = useCallback(
    (id: number) => {
      if (idlePollRef.current) window.clearInterval(idlePollRef.current);
      idlePollRef.current = null;
      if (burstPollRef.current) window.clearInterval(burstPollRef.current);

      setIsBurstPolling(true);
      burstPollRef.current = window.setInterval(() => {
        refreshTasksAndActions(id, { isPolling: true }).catch(() => {});
        silentRefreshLogs(id);
      }, BURST_POLL_MS);

      if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
      burstTimeoutRef.current = window.setTimeout(() => {
        if (burstPollRef.current) window.clearInterval(burstPollRef.current);
        burstPollRef.current = null;
        setIsBurstPolling(false);
        startIdlePolling(id);
      }, BURST_EXPIRE_MS);
    },
    [refreshTasksAndActions, startIdlePolling, silentRefreshLogs],
  );

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!versionId || versionId === 0) {
      setIsTasksReady(true);
      return;
    }
    if (isTerminal) {
      // Terminal: mark ready immediately, skip task/action fetch
      setIsTasksReady(true);
      setAvailableActions([]);
      return;
    }
    let alive = true;
    setIsTasksReady(false);
    setAvailableActions([]);

    (async () => {
      try {
        const [t, actions] = await Promise.all([
          listWorkflowTasks(versionId),
          getAvailableActions(versionId, adminDebugMode),
        ]);
        if (!alive) return;
        setTasks(t);
        setAvailableActions(actions);
      } catch {
        if (!alive) return;
        setTasks([]);
        setAvailableActions([]);
      } finally {
        if (alive) setIsTasksReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [versionId, isTerminal, adminDebugMode]);

  // ── Start idle + message polling on mount ────────────────────────────────
  useEffect(() => {
    if (!versionId || versionId === 0) return;
    if (isTerminal) return; // no polling for terminal statuses

    startIdlePolling(versionId);

    // Message poll — separate interval, slower cadence
    if (msgPollRef.current) window.clearInterval(msgPollRef.current);
    msgPollRef.current = window.setInterval(() => {
      pollMessages(versionId);
    }, MSG_POLL_MS);

    return () => stopAllPolling();
  }, [versionId, isTerminal, startIdlePolling, stopAllPolling, pollMessages]);

  // ── Real-time Integration ──────────────────────────────────────────────
  useRealtimeUpdates({
    documentVersionId: versionId,
    onWorkflowUpdate: () => {
      // Trigger instant refresh of tasks/actions, and background refresh of logs/messages
      refreshTasksAndActions(versionId, { isPolling: true }).catch(() => {});
      silentRefreshLogs(versionId);
      pollMessages(versionId);

      // Notify parent if needed
      if (onChanged) void Promise.resolve(onChanged()).catch(() => {});
    },
    requestId: null, // Workflow messages handled by pollMessages or existing logic
  });

  // ── Reset load guards when versionId changes ────────────────────────────
  useEffect(() => {
    hasLoadedMessagesRef.current = false;
    hasLoadedLogsRef.current = false;
    isFirstTaskLoadRef.current = true;
    isFirstMessageLoadRef.current = true;
  }, [versionId]);

  // ── Messages: load once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!versionId || versionId === 0) return;
    let alive = true;
    if (hasLoadedMessagesRef.current) return;
    setIsLoadingMessages(true);
    listDocumentMessages(versionId)
      .then((m) => {
        if (!alive) return;
        setMessages(m);
        hasLoadedMessagesRef.current = true;
        const incoming = m.filter(
          (msg) => Number(msg.sender_user_id) !== Number(myUserIdRef.current),
        );
        prevMessageCountRef.current = incoming.length;
        isFirstMessageLoadRef.current = false;
      })
      .catch(() => {
        if (alive) setMessages([]);
      })
      .finally(() => {
        if (alive) setIsLoadingMessages(false);
      });
    return () => {
      alive = false;
    };
  }, [versionId]);

  // ── Activity logs: load once ─────────────────────────────────────────────
  useEffect(() => {
    if (!versionId || versionId === 0) return;
    let alive = true;
    if (hasLoadedLogsRef.current) return;
    setIsLoadingActivityLogs(true);
    listActivityLogs({
      scope: "document",
      document_version_id: versionId,
      per_page: 50,
    })
      .then((p) => {
        if (!alive) return;
        setActivityLogs(p.data);
        hasLoadedLogsRef.current = true;
      })
      .catch(() => {
        if (alive) setActivityLogs([]);
      })
      .finally(() => {
        if (alive) setIsLoadingActivityLogs(false);
      });
    return () => {
      alive = false;
    };
  }, [versionId]);

  // ── Submit action ────────────────────────────────────────────────────────
  const submitAction = useCallback(
    async (code: WorkflowActionCode, note?: string) => {
      setIsChangingStatus(true);
      try {
        const res = await submitWorkflowAction(versionId, code, note, adminDebugMode);
        window.dispatchEvent(new Event("notifications:refresh"));

        // Refresh tasks immediately
        await refreshTasksAndActions(res.version.id);
        startBurstPolling(res.version.id);

        // Refresh messages + logs in background (non-blocking)
        Promise.all([
          listDocumentMessages(res.version.id),
          listActivityLogs({
            scope: "document",
            document_version_id: res.version.id,
            per_page: 50,
          }),
        ])
          .then(([msgs, logs]) => {
            setMessages(msgs);
            setActivityLogs(logs.data);
          })
          .catch(() => {});

        if (onChanged) void Promise.resolve(onChanged()).catch(() => {});

        if (qaOfficeId && myOfficeId !== qaOfficeId) {
          onAfterActionClose?.();
        }

        return res;
      } finally {
        setIsChangingStatus(false);
      }
    },
    [
      versionId,
      adminDebugMode,
      refreshTasksAndActions,
      startBurstPolling,
      onChanged,
      onAfterActionClose,
      myOfficeId,
      qaOfficeId,
    ],
  );

  const refreshMessages = useCallback(async () => {
    if (!versionId || versionId === 0) return;
    const m = await listDocumentMessages(versionId);
    setMessages(m);
  }, [versionId]);

  const clearNewMessageCount = useCallback(() => setNewMessageCount(0), []);
  const clearTaskChanged = useCallback(() => setTaskChanged(false), []);

  return useMemo(() => ({
    tasks,
    setTasks,
    availableActions,
    isTasksReady,
    isChangingStatus,
    messages,
    setMessages,
    isLoadingMessages,
    activityLogs,
    isLoadingActivityLogs,
    isBurstPolling,
    stopBurstPolling,
    submitAction,
    refreshMessages,
    refreshTasksAndActions,
    newMessageCount,
    clearNewMessageCount,
    taskChanged,
    clearTaskChanged,
  }), [
     tasks,
     availableActions,
     isTasksReady,
     isChangingStatus,
     messages,
     isLoadingMessages,
     activityLogs,
     isLoadingActivityLogs,
     isBurstPolling,
     stopBurstPolling,
     submitAction,
     refreshMessages,
     refreshTasksAndActions,
     newMessageCount,
     clearNewMessageCount,
     taskChanged,
     clearTaskChanged,
  ]);
}
