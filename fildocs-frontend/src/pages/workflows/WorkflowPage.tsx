import React, { useEffect, useState } from "react";
import {
  getDocument,
  getDocumentVersions,
  getDocumentVersion,
  logOpenedVersion,
  type Document,
  type DocumentVersion,
} from "../../services/documents";
import Workflow from "../../components/documents/workflow/Workflow";
import WorkflowShareModal from "../../components/documents/modals/WorkflowShareModal";
import WorkflowActionConfirmModal, { type ConfirmAction } from "../../components/documents/modals/WorkflowActionConfirmModal";
import WorkflowRevisionModal from "../../components/documents/modals/WorkflowRevisionModal";
import { type WorkflowHeaderState } from "../../components/documents/workflow/config/types";
import {
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import Alert from "../../components/ui/Alert";
import Button from "../../components/ui/Button";
import { PageActions } from "../../components/ui/PageActions";
import DocFrame from "../../components/layout/DocFrame";
import WorkflowRightPanel from "../../components/documents/panels/WorkflowRightPanel";
import WorkflowVersionsDropdown from "../../components/documents/ui/WorkflowVersionsDropdown";
import BackButton from "../../components/ui/buttons/BackButton";
import Skeleton from "../../components/ui/loader/Skeleton";
import { replaceDocumentVersionFileWithProgress } from "../../services/documents";
import { useToast } from "../../components/ui/toast/ToastContext";
import { getUserRole, isQA } from "../../lib/roleFilters";
import { getAuthUser } from "../../lib/auth";


import {
  FileX,
  Share2,
  Library,
  Loader2,
  XCircle,
  Trash2,
  ArrowRightToLine,
  ArrowLeftCircle,
  CheckCircle2,
  Hash,
  Play,
  Layers,
  RefreshCcw,
} from "lucide-react";
import { normalizeError } from "../../lib/normalizeError";
import WorkflowVersionCompareModal from "../../components/documents/modals/WorkflowVersionCompareModal";
import { GitCompare } from "lucide-react";
import { motion } from "framer-motion";

const WorkflowSkeleton: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <DocFrame
    title={<Skeleton className="h-6 w-48" />}
    onBack={onBack}
    rightHeader={<Skeleton className="h-8 w-32 rounded-md" />}
    left={
      <div className="space-y-6">
        <div className="flex items-center gap-4 border-b border-neutral-200/60 dark:border-surface-400 pb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    }
    right={
      <div className="p-4 space-y-6">
        <div>
          <Skeleton className="h-3 w-20 mb-3" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-2 w-16 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0 border-t border-neutral-200/60 dark:border-surface-400 pt-6">
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    }
  />
);

const WorkflowPage: React.FC = () => {
  const params = useParams();
  const id = Number(params.id);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    console.log("[WorkflowPage] Diagnostic Check:", {
      React: !!React,
      Workflow: !!Workflow,
      WorkflowActionConfirmModal: !!WorkflowActionConfirmModal,
      WorkflowRevisionModal: !!WorkflowRevisionModal,
      Alert: !!Alert,
      Button: !!Button,
      PageActions: !!PageActions,
      DocFrame: !!DocFrame,
      WorkflowRightPanel: !!WorkflowRightPanel,
      WorkflowVersionsDropdown: !!WorkflowVersionsDropdown,
      BackButton: !!BackButton,
      Skeleton: !!Skeleton,
      FileX: !!FileX,
      Share2: !!Share2,
      Library: !!Library,
      Loader2: !!Loader2,
      XCircle: !!XCircle,
      Trash2: !!Trash2,
      ArrowRightToLine: !!ArrowRightToLine,
      ArrowLeftCircle: !!ArrowLeftCircle,
      CheckCircle2: !!CheckCircle2,
      Hash: !!Hash,
      Play: !!Play,
      Layers: !!Layers,
      RefreshCcw: !!RefreshCcw,
      GitCompare: !!GitCompare,
    });
  }, []);

  const role = getUserRole();
  const isAdmin = role === "ADMIN" || role === "SYSADMIN";
  const currentUserId = getAuthUser()?.id;
  const myOfficeId = getAuthUser()?.office_id ?? null;
  const debugKey = `pref_debug_mode_${currentUserId}`;

  const [adminDebugMode, setAdminDebugMode] = React.useState<boolean>(() =>
    isAdmin ? localStorage.getItem(debugKey) === "1" : false,
  );

  React.useEffect(() => {
    if (!isAdmin) return;
    const sync = () => setAdminDebugMode(localStorage.getItem(debugKey) === "1");
    window.addEventListener("admin_debug_mode_changed", sync);
    return () => window.removeEventListener("admin_debug_mode_changed", sync);
  }, [isAdmin, debugKey]);

  const location = useLocation();
  const fromPath: string = (location.state as any)?.from ?? "/work-queue";
  // If came from a doc view page, go back there; if from library, go to library; else work queue
  const backTo =
    fromPath.startsWith("/documents/") && fromPath.includes("/view")
      ? fromPath
      : ["/documents", "/archive"].includes(fromPath)
        ? fromPath
        : "/work-queue";

  const handleBack = () => {
    navigate(backTo);
  };

  const stateCrumbs: { label: string; to?: string }[] =
    (location.state as any)?.breadcrumbs ?? [];

  const [document, setDocument] = useState<Document | null>(null);
  const [allVersions, setAllVersions] = useState<DocumentVersion[]>([]);
  const isArchived = !!document?.archived_at;

  const [headerState, setHeaderState] = useState<WorkflowHeaderState | null>(null);

  const headerSigRef = React.useRef<string>("");

  const [selectedVersion, setSelectedVersion] =
    useState<DocumentVersion | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const selectedVersionParam = searchParams.get("version_id");
  const selectedVersionIdFromUrl = selectedVersionParam
    ? Number(selectedVersionParam)
    : null;
  const selectedVersionId =
    selectedVersionIdFromUrl && !Number.isNaN(selectedVersionIdFromUrl)
      ? selectedVersionIdFromUrl
      : null;
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isLoadingSelectedVersion, setIsLoadingSelectedVersion] =
    useState(false);

  const refreshAndSelectBest = React.useCallback(
    async (opts?: { preferVersionId?: number | null }) => {
      const [docData, versions] = await Promise.all([
        getDocument(id),
        getDocumentVersions(id),
      ]);
      const sorted = [...versions].sort(
        (a, b) => Number(b.version_number) - Number(a.version_number),
      );
      setDocument(docData);
      setAllVersions(sorted);
      const preferId = opts?.preferVersionId ?? null;
      const best =
        (preferId ? sorted.find((v) => v.id === preferId) : null) ??
        sorted[0] ??
        null;
      setSelectedVersion(best);
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (best) p.set("version_id", String(best.id));
        else p.delete("version_id");
        p.delete("version");
        return p;
      });
    },
    [id, setSearchParams],
  );

  const [error, setError] = useState<string | null>(null);
  const [reviseModalOpen, setReviseModalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [rightPanelContent, setRightPanelContent] =
    useState<React.ReactNode>(null);
  const rightPanelShell = React.useMemo(
    () => (
      <WorkflowRightPanel
        document={null}
        version={null}
        offices={[]}
        newMessageCount={0}
        clearNewMessageCount={() => { }}
        activeSideTab="details"
        setActiveSideTab={() => { }}
        isLoadingActivityLogs={true}
        activityLogs={[]}
        isLoadingMessages={true}
        messages={[]}
        onSendMessage={async () => { }}
        formatWhen={() => ""}
      />
    ),
    [],
  );
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // ── Pending file upload (from create page async redirect) ─────────────────
  const [pendingUploadPct, setPendingUploadPct] = useState<number | null>(null);
  const pendingFileRef = React.useRef<File | null>(
    (location.state as any)?.pendingFile ?? null,
  );

  useEffect(() => {
    const file = pendingFileRef.current;
    if (!file || !selectedVersion) return;
    // Clear from location state so back-nav doesn't re-trigger
    window.history.replaceState(
      { ...(window.history.state ?? {}), pendingFile: undefined },
      "",
    );
    pendingFileRef.current = null;
    setPendingUploadPct(0);
    replaceDocumentVersionFileWithProgress(selectedVersion.id, file, (pct) =>
      setPendingUploadPct(pct),
    )
      .then(() => {
        setPendingUploadPct(null);
        toast.push({ type: "success", message: "File uploaded successfully." });
        return refreshAndSelectBest({ preferVersionId: selectedVersion.id });
      })
      .catch((err: any) => {
        setPendingUploadPct(null);
        toast.push({
          type: "error",
          title: "Upload failed",
          message:
            err?.message ??
            "Could not upload file. Please re-upload from the document page.",
        });
      });
    // Only run once when selectedVersion first becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersion?.id]);

  // ── Header action confirm modal ──────────────────────────────
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [processingVersionAction, setProcessingVersionAction] = useState<string | null>(null);

  const handleHeaderActionClick = async (a: any) => {
    if (a.skipConfirm) {
      setProcessingKey(a.key);
      try {
        await a.onClick();
      } finally {
        setProcessingKey(null);
      }
      return;
    }
    setConfirmAction(a);
  };

  const handleHeaderActionConfirm = async (note?: string) => {
    if (!confirmAction) return;
    const actionToRun = confirmAction;
    setProcessingKey(actionToRun.key);
    setConfirmAction(null);
    try {
      await actionToRun.onClick(note);
    } finally {
      setProcessingKey(null);
    }
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setError(null);
      setLoading(true);
      // Retry up to 3 times with a short delay — document creation can be slow
      // enough that the first fetch lands before all records are ready.
      let lastErr: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!alive) return;
        if (attempt > 0) await new Promise((r) => setTimeout(r, 800));
        try {
          const [docData, versions] = await Promise.all([
            getDocument(id),
            getDocumentVersions(id),
          ]);
          if (!alive) return;
          const sorted = [...versions].sort(
            (a, b) => Number(b.version_number) - Number(a.version_number),
          );
          setDocument(docData);
          setAllVersions(sorted);
          const best =
            (selectedVersionId
              ? sorted.find((v) => v.id === selectedVersionId)
              : null) ??
            sorted[0] ??
            null;
          setSelectedVersion(best);
          setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            if (best) p.set("version_id", String(best.id));
            else p.delete("version_id");
            p.delete("version");
            return p;
          });
          setLoading(false);
          return; // success — exit retry loop
        } catch (err: any) {
          lastErr = err;
        }
      }
      if (!alive) return;
      setError(normalizeError(lastErr));
      setLoading(false);
    };
    load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let alive = true;
    const loadVersion = async () => {
      if (!selectedVersionId) return;
      if (selectedVersion?.id === selectedVersionId) return;
      setIsLoadingSelectedVersion(true);
      setError(null);
      try {
        const { version, document: docRes } =
          await getDocumentVersion(selectedVersionId);
        if (!alive) return;
        setSelectedVersion(version);
        setDocument(docRes);
      } catch (e: any) {
        if (!alive) return;
        const status = e?.response?.status;
        if (status === 404) {
          setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.delete("version_id");
            p.delete("version");
            return p;
          });
        } else {
          setError(e?.message ?? "Failed to load version");
        }
      } finally {
        if (!alive) return;
        setIsLoadingSelectedVersion(false);
      }
    };
    loadVersion();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersionId]);

  // Reset header sig when version changes so new state is always accepted
  React.useEffect(() => {
    headerSigRef.current = "";
  }, [selectedVersion?.id]);

  // ── Workflow Callbacks (Moved to top level to follow Rules of Hooks) ─────
  const onSelectVersion = React.useCallback(
    (v: any) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set("version_id", String(v.id));
        return p;
      });
      logOpenedVersion(v.id, "versions_panel");
    },
    [setSearchParams],
  );

  const onHeaderStateChange = React.useCallback((s: any) => {
    const sig =
      `${s.title}|${s.code}|${s.status}|${s.versionNumber}|${s.canAct}|${s.isTasksReady}|${(s.availableActions ?? []).join(",")}|` +
      `${(s.headerActions ?? []).map((a: any) => `${a.key}:${a.disabled ? 1 : 0}:${a.variant}`).join(",")}|` +
      `${(s.versionActions ?? []).map((a: any) => `${a.key}:${a.disabled ? 1 : 0}:${a.variant}`).join(",")}`;
    if (sig === headerSigRef.current) return;
    headerSigRef.current = sig;
    setHeaderState(s);
  }, []);

  const onAfterActionClose = React.useCallback(async () => {
    try {
      await refreshAndSelectBest({
        preferVersionId: selectedVersion?.id ?? null,
      });
    } catch (e: any) {
      // Document was deleted (404) — navigate back
      if (e?.response?.status === 404 || e?.status === 404) {
        navigate(fromPath);
      }
    }
  }, [
    refreshAndSelectBest,
    selectedVersion?.id,
    navigate,
    fromPath,
  ]);

  const onChanged = React.useCallback(async () => {
    const preferId = selectedVersion?.id ?? null;
    if (preferId) {
      try {
        const { version: v, document: d } =
          await getDocumentVersion(preferId);
        setDocument(d);
        setSelectedVersion(v);
        setAllVersions((prev) =>
          prev.map((x) => (x.id === v.id ? v : x)),
        );
        return;
      } catch {
        // Fall through to full refresh
      }
    }
    await refreshAndSelectBest({ preferVersionId: preferId });
  }, [selectedVersion?.id, refreshAndSelectBest]);

  const rightHeader = (
    <div className="flex items-center gap-2">
      {allVersions.length > 1 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCompareModalOpen(true)}
          className="flex items-center gap-1.5"
        >
          <GitCompare className="h-4 w-4" />
          Compare
        </Button>
      )}
      <WorkflowVersionsDropdown
        allVersions={allVersions}
        selectedVersion={selectedVersion}
        isLoadingSelectedVersion={isLoadingSelectedVersion}
        onSelectVersion={(v) => {
          setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.set("version_id", String(v.id));
            return p;
          });
        }}
      />
    </div>
  );

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (!params.id || Number.isNaN(id)) {
    return (
      <div className="flex flex-col gap-3">
        <BackButton onClick={handleBack} />
        <Alert variant="error">Invalid document id.</Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <motion.div
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="flex flex-1 flex-col min-h-0 min-w-0"
      >
        <WorkflowSkeleton onBack={handleBack} />
      </motion.div>
    );
  }

  if (error || !document) {
    const isNotFound =
      !document ||
      (error ?? "").toLowerCase().includes("not found") ||
      (error ?? "").toLowerCase().includes("could not be found");
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-400 dark:text-rose-500">
          <FileX className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
            {isNotFound ? "Document not found" : "Failed to load document"}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
            {error ??
              "This document doesn't exist or you may not have access to it."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleBack}>
          Go back
        </Button>
      </div>
    );
  }

  const current = selectedVersion ?? allVersions[0] ?? null;
  const isOwner = !!myOfficeId && !!document?.owner_office_id && Number(myOfficeId) === Number(document.owner_office_id);
  const canActPage = !isAdmin || adminDebugMode;

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-1 flex-col min-h-0 min-w-0"
    >
      <DocFrame
        breadcrumbs={stateCrumbs}
        title={
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {loading ? (
                <Skeleton className="h-4 w-48 mt-0.5" />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 whitespace-normal wrap-break-word font-semibold text-neutral-900 dark:text-white leading-snug">
                    {headerState?.title ?? document?.title}
                  </span>
                </div>
              )}
            </div>
          </div>
        }
        subtitle={null}
        onBack={handleBack}
        onBackDisabled={isLoadingSelectedVersion}
        rightWidthClass="w-[400px]"
        rightCollapsed={rightCollapsed}
        onCollapseToggle={() => setRightCollapsed((v) => !v)}
        actions={
          <PageActions>
            {current?.status === "Distributed" && isOwner && role !== "AUDITOR" && !isArchived && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                reveal
                disabled={isLoadingSelectedVersion || !canActPage}
                onClick={() => setShareOpen(true)}
                tooltip="Share document with other offices"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </Button>
            )}
            {current?.status === "Distributed" && !isArchived && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                reveal
                disabled={isLoadingSelectedVersion}
                onClick={() => navigate(`/documents/${id}/view`)}
                tooltip="Open document in Library view"
              >
                <Library className="h-3.5 w-3.5" />
                <span>View</span>
              </Button>
            )}
            {current?.status === "Distributed" && isOwner && role !== "AUDITOR" && !isArchived && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                reveal
                disabled={isLoadingSelectedVersion || !canActPage}
                onClick={() => {
                  if (selectedVersion) logOpenedVersion(selectedVersion.id, "revise_action");
                  setReviseModalOpen(true);
                }}
                tooltip="Start a new revision for this document"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                <span>Revise</span>
              </Button>
            )}
            {!headerState?.isTasksReady && current?.status !== "Distributed" ? (
              <div className="h-7 w-28 rounded-sm bg-slate-200 dark:bg-surface-400 animate-pulse" />
            ) : (
              <>
                {(headerState?.headerActions ?? []).map((a: any) => {
                  const isThis = processingKey === a.key || a.loading;
                  const isBusy =
                    !!processingKey ||
                    a.loading ||
                    isLoadingSelectedVersion ||
                    pendingUploadPct !== null;

                  // Contextual Icons for Flow Actions
                  const Icon =
                    a.icon ? a.icon :
                      a.key === "REJECT" ? XCircle :
                        a.key.includes("CANCEL") || a.key.includes("DELETE") ? Trash2 :
                          a.key.includes("SEND") || a.key.includes("FORWARD") ? ArrowRightToLine :
                            a.key.includes("BACK") || a.key.includes("RETURN") ? ArrowLeftCircle :
                              a.key.includes("APPROVAL") || a.key === "QA_PRESIDENT_APPROVE" || a.key === "OFFICE_PRESIDENT_APPROVE" ? CheckCircle2 :
                                a.key.includes("REGISTER") ? Hash :
                                  a.key.includes("DISTRIBUTE") ? Share2 :
                                    a.key.includes("FINALIZATION") ? Play :
                                      a.key.includes("APPROVAL") ? Layers :
                                        ArrowRightToLine;

                  return (
                    <Button
                      key={a.key}
                      type="button"
                      size="sm"
                      reveal
                      variant={
                        (a.key.includes("DISTRIBUTE") || a.key.includes("FINALIZATION")) ? "success" :
                          a.variant === "danger" ? "danger" :
                            a.variant === "outline" ? "outline" : "primary"
                      }
                      disabled={isBusy || a.disabled}
                      loading={isThis}
                      onClick={() => handleHeaderActionClick(a)}
                      tooltip={a.label}
                    >
                      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                      <span>{a.label}</span>
                    </Button>
                  );
                })}

                {/* Revise Button */}
                {(!isArchived && (isOwner || isQA(role) || isAdmin)) &&
                  selectedVersion?.status === "Distributed" && (
                    <Button
                      variant="outline"
                      onClick={() => setReviseModalOpen(true)}
                      tooltip="Create New Version"
                      className="group"
                    >
                      <Layers className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
                    </Button>
                  )}

                {/* Generic Workflow Actions */}
                {(headerState?.versionActions ?? []).map((a: any) => {
                  const Icon = a.icon;
                  const isThisActionBusy = processingVersionAction === a.key;
                  return (
                    <Button
                      key={a.key}
                      variant={
                        a.variant === "primary"
                          ? "primary"
                          : a.variant === "danger"
                            ? "danger"
                            : "outline"
                      }
                      reveal
                      loading={isThisActionBusy}
                      onClick={async () => {
                        setProcessingVersionAction(a.key);
                        try {
                          await a.onClick();
                        } finally {
                          setProcessingVersionAction(null);
                        }
                      }}
                      disabled={
                        !!processingKey ||
                        !!processingVersionAction ||
                        isLoadingSelectedVersion ||
                        pendingUploadPct !== null
                      }
                      tooltip={a.label}
                    >
                      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                      <span>{a.label}</span>
                    </Button>
                  );
                })}
              </>
            )}
          </PageActions>
        }
        rightHeader={rightHeader}
        left={
          <div className="relative">
            {pendingUploadPct !== null && (
              <div className="mb-3 w-full rounded-md border-l-4 border-brand-400 dark:border-brand-300 bg-neutral-50 dark:bg-surface-400 px-4 py-2.5 flex items-center gap-4">
                <div className="flex items-center gap-2 shrink-0">
                  <Loader2 className="animate-spin h-3.5 w-3.5 text-brand-400 dark:text-brand-300" />
                  <span className="text-xs font-medium text-brand-600 dark:text-brand-300">
                    Uploading file…
                  </span>
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-brand-100 dark:bg-brand-900/30 overflow-hidden">
                  <div
                    className="h-full bg-brand-400 dark:bg-brand-300 transition-[width] duration-200"
                    style={{ width: `${Math.max(2, pendingUploadPct)}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs font-semibold text-brand-500 dark:text-brand-300">
                  {pendingUploadPct}%
                </span>
              </div>
            )}

            {!loading &&
              !selectedVersion &&
              !isLoadingSelectedVersion &&
              allVersions.length === 0 && (
                <Alert variant="warning">No version available.</Alert>
              )}
            <Workflow
              isPageLoading={loading}
              isExternalUploading={pendingUploadPct !== null}
              adminDebugMode={adminDebugMode}
              document={document}
              version={selectedVersion}
              allVersions={allVersions}
              selectedVersion={selectedVersion}
              isLoadingSelectedVersion={isLoadingSelectedVersion}
              onSelectVersion={onSelectVersion}
              onHeaderStateChange={onHeaderStateChange}
              onAfterActionClose={onAfterActionClose}
              onChanged={onChanged}
              onRightPanelContent={setRightPanelContent}
            />
          </div>
        }
        right={rightPanelContent ?? rightPanelShell}
      />

      <WorkflowShareModal
        open={shareOpen}
        documentId={document?.id ?? null}
        onClose={() => setShareOpen(false)}
        onSaved={() => { }}
      />

      <WorkflowActionConfirmModal
        action={confirmAction}
        processingKey={processingKey}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleHeaderActionConfirm}
        adminDebugMode={adminDebugMode}
        routingUsers={headerState?.routingUsers}
        actingAsUserId={headerState?.actingAsUserId}
        setActingAsUserId={headerState?.setActingAsUserId}
        isLoadingRoutingUsers={headerState?.isLoadingRoutingUsers}
      />

      <WorkflowRevisionModal
        open={reviseModalOpen}
        documentId={document?.id ?? 0}
        onClose={() => setReviseModalOpen(false)}
        onRevised={(revised) => {
          setAllVersions((prev) => {
            const next = [
              revised,
              ...prev.filter((v) => v.id !== revised.id),
            ];
            next.sort(
              (a, b) => Number(b.version_number) - Number(a.version_number),
            );
            return next;
          });
          setSelectedVersion(revised);
          setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.set("version_id", String(revised.id));
            p.delete("version");
            return p;
          });
          setReviseModalOpen(false);
        }}
      />

      <WorkflowVersionCompareModal
        open={isCompareModalOpen}
        allVersions={allVersions}
        baseVersionId={selectedVersion?.id ?? null}
        onClose={() => setIsCompareModalOpen(false)}
      />
    </motion.div>
  );
};

export default WorkflowPage;
