import { useCallback, useEffect, useRef, useState } from "react";
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

type Options = {
  versionId: number;
  activeSideTab: "comments" | "logs";
  onChanged?: () => Promise<void> | void;
  onAfterActionClose?: () => void;
  myOfficeId: number | null;
  qaOfficeId: number | null;
};

export function useDocumentWorkflow({
  versionId,
  activeSideTab,
  onChanged,
  onAfterActionClose,
  myOfficeId,
  qaOfficeId,
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

  // Change detection
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [taskChanged, setTaskChanged] = useState(false);
  const prevMessageCountRef = useRef<number>(0);
  const prevOpenTaskOfficeRef = useRef<number | null>(null);
  const prevActionsRef = useRef<string>("");
  const isFirstTaskLoadRef = useRef(true);
  const isFirstMessageLoadRef = useRef(true);
  const myUserIdRef = useRef<number | null>(null);

  // Keep myUserId in a ref for use inside intervals
  useEffect(() => {
    myUserIdRef.current = getAuthUser()?.id ?? null;
  }, []);

  const idlePollRef = useRef<number | null>(null);

  const stopAllPolling = useCallback(() => {
    setIsBurstPolling(false);
    if (burstPollRef.current) window.clearInterval(burstPollRef.current);
    burstPollRef.current = null;
    if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
    burstTimeoutRef.current = null;
    if (idlePollRef.current) window.clearInterval(idlePollRef.current);
    idlePollRef.current = null;
  }, []);

  // Keep old name as alias so existing call sites don't break
  const stopBurstPolling = stopAllPolling;

  const refreshTasksAndActions = useCallback(
    async (id: number, opts?: { isPolling?: boolean }) => {
      try {
        const [t, actions] = await Promise.all([
          listWorkflowTasks(id),
          getAvailableActions(id),
        ]);

        // Change detection — skip on first load
        if (!isFirstTaskLoadRef.current) {
          const openTask = t.find((tk) => tk.status === "open") ?? null;
          const newOffice = openTask?.assigned_office_id ?? null;
          const newActionsKey = actions.join(",");
          if (
            newOffice !== prevOpenTaskOfficeRef.current ||
            newActionsKey !== prevActionsRef.current
          ) {
            setTaskChanged(true);
            // Only update state if something actually changed during polling
            setTasks(t);
            setAvailableActions(actions);
          } else if (!opts?.isPolling) {
            // Always update state on explicit (non-poll) refreshes
            setTasks(t);
            setAvailableActions(actions);
          }
        } else {
          isFirstTaskLoadRef.current = false;
          setTasks(t);
          setAvailableActions(actions);
        }

        // Update refs
        const openTask = t.find((tk) => tk.status === "open") ?? null;
        prevOpenTaskOfficeRef.current = openTask?.assigned_office_id ?? null;
        prevActionsRef.current = actions.join(",");
      } catch {
        if (!opts?.isPolling) {
          setTasks([]);
          setAvailableActions([]);
        }
      } finally {
        setIsTasksReady(true);
      }
    },
    [],
  );

  const startIdlePolling = useCallback(
    (id: number) => {
      if (idlePollRef.current) window.clearInterval(idlePollRef.current);
      idlePollRef.current = window.setInterval(() => {
        refreshTasksAndActions(id, { isPolling: true }).catch(() => {});
      }, 10_000);
    },
    [refreshTasksAndActions],
  );

  // Visibility-aware catch-up: fire immediately when tab becomes visible
  useVisibilityPolling(
    useCallback(() => {
      refreshTasksAndActions(versionId, { isPolling: true }).catch(() => {});
    }, [versionId, refreshTasksAndActions]),
    10_000,
  );

  const startBurstPolling = useCallback(
    (id: number) => {
      // Stop idle, start burst
      if (idlePollRef.current) window.clearInterval(idlePollRef.current);
      idlePollRef.current = null;
      if (burstPollRef.current) window.clearInterval(burstPollRef.current);

      setIsBurstPolling(true);
      burstPollRef.current = window.setInterval(() => {
        refreshTasksAndActions(id, { isPolling: true }).catch(() => {});
      }, 5_000);

      // After 15s revert to idle
      if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
      burstTimeoutRef.current = window.setTimeout(() => {
        if (burstPollRef.current) window.clearInterval(burstPollRef.current);
        burstPollRef.current = null;
        setIsBurstPolling(false);
        startIdlePolling(id);
      }, 15_000);
    },
    [refreshTasksAndActions, startIdlePolling],
  );

  // Initial load
  useEffect(() => {
    if (!versionId || versionId === 0) return;
    let alive = true;
    setIsTasksReady(false);
    setAvailableActions([]);

    (async () => {
      try {
        const [t, actions] = await Promise.all([
          listWorkflowTasks(versionId),
          getAvailableActions(versionId),
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
  }, [versionId]);

  // Start idle polling on mount, stop on unmount
  useEffect(() => {
    if (!versionId || versionId === 0) return;
    startIdlePolling(versionId);
    return () => stopAllPolling();
  }, [versionId, startIdlePolling, stopAllPolling]);

  // Poll messages every 10s regardless of active tab
  useEffect(() => {
    if (!versionId || versionId === 0) return;
    const interval = window.setInterval(() => {
      listDocumentMessages(versionId)
        .then((m) => {
          setMessages(m);
          if (!isFirstMessageLoadRef.current) {
            const incoming = m.filter(
              (msg) =>
                Number(msg.sender_user_id) !== Number(myUserIdRef.current),
            );
            const newCount = incoming.length - prevMessageCountRef.current;
            if (newCount > 0) {
              setNewMessageCount((prev) => prev + newCount);
            }
            prevMessageCountRef.current = incoming.length;
          } else {
            isFirstMessageLoadRef.current = false;
            const incoming = m.filter(
              (msg) =>
                Number(msg.sender_user_id) !== Number(myUserIdRef.current),
            );
            prevMessageCountRef.current = incoming.length;
          }
        })
        .catch(() => {});
    }, 10_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [versionId]);

  // Messages — load once on mount, polling handles updates
  const hasLoadedMessagesRef = useRef(false);

  useEffect(() => {
    if (!versionId || versionId === 0) return;
    let alive = true;
    if (hasLoadedMessagesRef.current) return; // already loaded, skip
    setIsLoadingMessages(true);
    listDocumentMessages(versionId)
      .then((m) => {
        if (alive) {
          setMessages(m);
          hasLoadedMessagesRef.current = true;
          const incoming = m.filter(
            (msg) => Number(msg.sender_user_id) !== Number(myUserIdRef.current),
          );
          prevMessageCountRef.current = incoming.length;
          isFirstMessageLoadRef.current = false;
        }
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

  // Activity logs — load once on mount, don't clear on tab switch
  const hasLoadedLogsRef = useRef(false);

  // Reset load guards when versionId changes
  useEffect(() => {
    hasLoadedMessagesRef.current = false;
    hasLoadedLogsRef.current = false;
    isFirstTaskLoadRef.current = true;
    isFirstMessageLoadRef.current = true;
  }, [versionId]);

  useEffect(() => {
    if (!versionId || versionId === 0) return;
    let alive = true;
    if (hasLoadedLogsRef.current) return; // already loaded, skip
    setIsLoadingActivityLogs(true);
    listActivityLogs({
      scope: "document",
      document_version_id: versionId,
      per_page: 50,
    })
      .then((p) => {
        if (alive) {
          setActivityLogs(p.data);
          hasLoadedLogsRef.current = true;
        }
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

  const submitAction = useCallback(
    async (code: WorkflowActionCode, note?: string) => {
      setIsChangingStatus(true);
      try {
        const res = await submitWorkflowAction(versionId, code, note);
        window.dispatchEvent(new Event("notifications:refresh"));
        await refreshTasksAndActions(res.version.id);
        startBurstPolling(res.version.id);

        // Always refresh both messages and logs after any action
        // Wrapped separately so a fetch failure doesn't surface as an action error
        try {
          const [msgs, logs] = await Promise.all([
            listDocumentMessages(res.version.id),
            listActivityLogs({
              scope: "document",
              document_version_id: res.version.id,
              per_page: 50,
            }),
          ]);
          setMessages(msgs);
          setActivityLogs(logs.data);
        } catch {
          // Non-critical — polling will catch up
        }

        if (onChanged) await onChanged();

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
      activeSideTab,
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

  const clearNewMessageCount = useCallback(() => {
    setNewMessageCount(0);
  }, []);

  const clearTaskChanged = useCallback(() => {
    setTaskChanged(false);
  }, []);

  return {
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
  };
}
