import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAuthUser } from "../lib/auth";
import {
  listWorkflowTasks,
  getAvailableActions,
  submitWorkflowAction,
  listDocumentMessages,
  listActivityLogs,
  listRoutingUsers,
  type WorkflowTask,
  type WorkflowActionCode,
  type DocumentMessage,
  type OfficeUser,
} from "../services/documents";
import { useRealtimeUpdates } from "./useRealtimeUpdates";
import { useWorkflowMessaging } from "./workflow/useWorkflowMessaging";
import { useWorkflowActivity } from "./workflow/useWorkflowActivity";
import { useWorkflowPolling } from "./workflow/useWorkflowPolling";

type Options = {
  versionId: number;
  documentId?: number;
  isTerminal?: boolean;
  onChanged?: () => Promise<void> | void;
  onAfterActionClose?: () => void;
  myOfficeId: number | null;
  qaOfficeId: number | null;
  adminDebugMode?: boolean;
};

export function useDocumentWorkflow({
  versionId,
  documentId,
  isTerminal = false,
  onChanged,
  onAfterActionClose,
  myOfficeId,
  qaOfficeId,
  adminDebugMode = false,
}: Options) {
  const myUserId = useMemo(() => getAuthUser()?.id ?? null, []);

  // 1. Core Workflow State (Tasks & Actions)
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [availableActions, setAvailableActions] = useState<WorkflowActionCode[]>([]);
  const [isTasksReady, setIsTasksReady] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [taskChanged, setTaskChanged] = useState(false);

  const prevOpenTaskOfficeRef = useRef<number | null>(null);
  const prevActionsRef = useRef<string>("");
  const isFirstTaskLoadRef = useRef(true);

  // 2. Impersonation State
  const [routingUsers, setRoutingUsers] = useState<OfficeUser[]>([]);
  const [actingAsUserId, setActingAsUserId] = useState<number | undefined>(undefined);
  const [isLoadingRoutingUsers, setIsLoadingRoutingUsers] = useState(false);

  // 3. Sub-Hooks (Modularized Logic)
  const messaging = useWorkflowMessaging(versionId, myUserId);
  const activity = useWorkflowActivity(versionId, documentId);

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
      } catch (err) {
        if (!opts?.isPolling) {
          setTasks([]);
          setAvailableActions([]);
        }
      } finally {
        setIsTasksReady(true);
      }
    },
    [adminDebugMode]
  );

  const polling = useWorkflowPolling({
    versionId,
    refreshTasks: refreshTasksAndActions,
    refreshLogs: activity.refreshLogsSilent,
    refreshMessages: messaging.pollMessages,
    isTerminal
  });

  // 3. Action Wrappers (Parameterless for consumers)
  const refreshTasks = useCallback((opts?: { isPolling?: boolean }) => 
    refreshTasksAndActions(versionId, opts), [versionId, refreshTasksAndActions]);
  
  const refreshLogs = useCallback(() => 
    activity.refreshLogsSilent(versionId), [versionId, activity]);
    
  const refreshMessages = useCallback(() => 
    messaging.pollMessages(versionId), [versionId, messaging]);

  // 4. Submission Logic
  const submitAction = useCallback(
    async (code: WorkflowActionCode, note?: string) => {
      setIsChangingStatus(true);
      try {
        const res = await submitWorkflowAction(
          versionId,
          code,
          note,
          adminDebugMode,
          actingAsUserId
        );
        window.dispatchEvent(new Event("notifications:refresh"));

        // Immediate background sync
        await refreshTasksAndActions(res.version.id);
        polling.startBurstPolling(res.version.id);

        Promise.all([
          listDocumentMessages(res.version.id),
          listActivityLogs({
            scope: "document",
            document_version_id: res.version.id,
            per_page: 50,
          }),
        ]).then(([msgs, logs]) => {
          messaging.setMessages(msgs);
          activity.setActivityLogs(logs.data);
        }).catch(() => {});

        if (onChanged) void Promise.resolve(onChanged()).catch(() => {});
        if (qaOfficeId && myOfficeId !== qaOfficeId) {
          onAfterActionClose?.();
        }
        return res;
      } finally {
        setIsChangingStatus(false);
      }
    },
    [versionId, adminDebugMode, actingAsUserId, polling, messaging, activity, refreshTasksAndActions, onChanged, qaOfficeId, myOfficeId, onAfterActionClose]
  );

  // 5. Initial Lifecycle
  useEffect(() => {
    if (!versionId || versionId === 0 || isTerminal) {
      setIsTasksReady(true);
      if (isTerminal) setAvailableActions([]);
      return;
    }
    let alive = true;
    setIsTasksReady(false);
    refreshTasksAndActions(versionId).finally(() => {
      if (alive) setIsTasksReady(true);
    });
    return () => { alive = false; };
  }, [versionId, isTerminal, refreshTasksAndActions]);

  useEffect(() => {
    if (!versionId || !adminDebugMode) {
      setRoutingUsers([]);
      setActingAsUserId(undefined);
      return;
    }
    let alive = true;
    setIsLoadingRoutingUsers(true);
    listRoutingUsers(versionId)
      .then((users) => { if (alive) setRoutingUsers(users); })
      .catch(() => { if (alive) setRoutingUsers([]); })
      .finally(() => { if (alive) setIsLoadingRoutingUsers(false); });
    return () => { alive = false; };
  }, [versionId, adminDebugMode]);

  // 6. Real-time Integration
  useRealtimeUpdates({
    documentVersionId: versionId,
    onWorkflowUpdate: (data: any) => {
      const isSig = data?.event === "version.in_app_signature_applied" || data?.event === "version.in_app_signature_removed";
      const isPreview = data?.event === "version.preview_regenerated";

      refreshTasksAndActions(versionId, { isPolling: true });
      activity.refreshLogsSilent(versionId);
      messaging.pollMessages(versionId);

      if (isSig || isPreview) setTaskChanged(true);
      if (onChanged) void Promise.resolve(onChanged()).catch(() => {});
    },
    onDocumentMessage: (incoming: DocumentMessage) => {
      messaging.pushMessage(incoming);
    },
    requestId: null,
  });

  const syncAll = useCallback(async () => {
    if (!versionId || versionId === 0) return;
    await Promise.all([
      refreshTasksAndActions(versionId),
      messaging.pollMessages(versionId),
      activity.fetchLogs(versionId, documentId)
    ]);
  }, [versionId, documentId, refreshTasksAndActions, messaging, activity]);

  // 7. Memoized API (matching original hook exactly)
  return useMemo(() => ({
    tasks,
    setTasks,
    availableActions,
    isTasksReady,
    isChangingStatus,
    setIsChangingStatus,
    ...messaging,
    ...activity,
    ...polling,
    submitAction,

    // Parameterless Refresh Actions
    refreshTasks,
    refreshMessages,
    refreshLogs,
    refreshTasksAndActions: refreshTasks, // Legacy Alias
    
    syncAll,
    taskChanged,
    clearTaskChanged: () => setTaskChanged(false),
 
    // Impersonation
    routingUsers,
    actingAsUserId,
    setActingAsUserId,
    isLoadingRoutingUsers,
  }), [
    tasks, availableActions, isTasksReady, isChangingStatus, taskChanged,
    messaging, activity, polling, submitAction, syncAll,
    refreshTasks, refreshMessages, refreshLogs,
    routingUsers, actingAsUserId, isLoadingRoutingUsers
  ]);
}
