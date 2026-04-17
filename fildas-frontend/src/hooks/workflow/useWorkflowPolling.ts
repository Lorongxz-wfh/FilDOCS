import { useState, useCallback, useRef, useEffect } from "react";
import { useVisibilityPolling } from "../useVisibilityPolling";

type PollingOptions = {
  versionId: number;
  refreshTasks: (id: number, opts?: { isPolling?: boolean }) => Promise<void>;
  refreshLogs: (id: number) => void;
  refreshMessages: (id: number) => void;
  isTerminal?: boolean;
};

const IDLE_POLL_MS = 10_000;
const BURST_POLL_MS = 5_000;
const BURST_EXPIRE_MS = 15_000;

export function useWorkflowPolling({
  versionId,
  refreshTasks,
  refreshLogs,
  refreshMessages,
  isTerminal = false
}: PollingOptions) {
  const [isBurstPolling, setIsBurstPolling] = useState(false);
  const burstPollRef = useRef<number | null>(null);
  const burstTimeoutRef = useRef<number | null>(null);
  const idlePollRef = useRef<number | null>(null);

  const stopAllPolling = useCallback(() => {
    setIsBurstPolling(false);
    if (burstPollRef.current) window.clearInterval(burstPollRef.current);
    if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
    if (idlePollRef.current) window.clearInterval(idlePollRef.current);
    burstPollRef.current = burstTimeoutRef.current = idlePollRef.current = null;
  }, []);

  const startIdlePolling = useCallback((id: number) => {
    if (idlePollRef.current) window.clearInterval(idlePollRef.current);
    idlePollRef.current = window.setInterval(() => {
      refreshTasks(id, { isPolling: true });
      refreshLogs(id);
      refreshMessages(id);
    }, IDLE_POLL_MS);
  }, [refreshTasks, refreshLogs]);

  const startBurstPolling = useCallback((id: number) => {
    if (idlePollRef.current) window.clearInterval(idlePollRef.current);
    idlePollRef.current = null;
    if (burstPollRef.current) window.clearInterval(burstPollRef.current);

    setIsBurstPolling(true);
    burstPollRef.current = window.setInterval(() => {
      refreshTasks(id, { isPolling: true });
      refreshLogs(id);
      refreshMessages(id);
    }, BURST_POLL_MS);

    if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
    burstTimeoutRef.current = window.setTimeout(() => {
      if (burstPollRef.current) window.clearInterval(burstPollRef.current);
      burstPollRef.current = null;
      setIsBurstPolling(false);
      startIdlePolling(id);
    }, BURST_EXPIRE_MS);
  }, [refreshTasks, refreshLogs, startIdlePolling]);

  // Visibility-aware catch-up
  useVisibilityPolling(
    useCallback(() => {
      if (!versionId || versionId === 0 || isTerminal) return;
      refreshTasks(versionId, { isPolling: true });
    }, [versionId, refreshTasks, isTerminal]),
    IDLE_POLL_MS
  );

  // Sync polling state with versionId lifecycle
  useEffect(() => {
    if (!versionId || versionId === 0 || isTerminal) {
      stopAllPolling();
      return;
    }
    startIdlePolling(versionId);
    return () => stopAllPolling();
  }, [versionId, isTerminal, startIdlePolling, stopAllPolling]);

  return {
    isBurstPolling,
    startBurstPolling,
    stopAllPolling
  };
}
