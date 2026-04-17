import { useState, useEffect, useCallback } from "react";
import { listActivityLogs, type ActivityLogItem } from "../../services/documents";

export function useWorkflowActivity(versionId: number, documentId?: number) {
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [isLoadingActivityLogs, setIsLoadingActivityLogs] = useState(false);

  const fetchLogs = useCallback(async (id: number, docId?: number) => {
    try {
      const res = await listActivityLogs({
        scope: "document",
        document_id: docId || undefined,
        document_version_id: !docId ? id : undefined,
        per_page: 50,
      });
      setActivityLogs(res.data);
    } catch (err) {
      console.warn("[useWorkflowActivity] Failed to fetch logs:", err);
    }
  }, []);

  const refreshLogsSilent = useCallback((id: number) => {
    if (!id || id === 0) return;
    listActivityLogs({ scope: "document", document_version_id: id, per_page: 50 })
      .then((res) => setActivityLogs(res.data))
      .catch(() => {});
  }, []);

  // Initial Load
  useEffect(() => {
    if (!versionId || versionId === 0) return;
    
    let alive = true;
    setIsLoadingActivityLogs(true);

    fetchLogs(versionId, documentId)
      .finally(() => {
        if (alive) setIsLoadingActivityLogs(false);
      });

    return () => { alive = false; };
  }, [versionId, documentId, fetchLogs]);

  return {
    activityLogs,
    setActivityLogs,
    isLoadingActivityLogs,
    refreshLogsSilent,
    fetchLogs
  };
}
