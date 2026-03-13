import React, { useEffect, useState } from "react";
import {
  getDocument,
  getDocumentVersions,
  getDocumentVersion,
  createRevision,
  logOpenedVersion,
  type Document,
  type DocumentVersion,
} from "../services/documents";
import DocumentFlow from "../components/documents/DocumentFlow";
import ShareDocumentModal from "../components/documents/ShareDocumentModal";
import {
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import DocFrame from "../components/layout/DocFrame";
import DocumentRightPanel from "../components/documents/documentFlow/DocumentRightPanel";
import BackButton from "../components/ui/buttons/BackButton";
import Skeleton from "../components/ui/loader/Skeleton";
import { replaceDocumentVersionFileWithProgress } from "../services/documents";
import { useToast } from "../components/ui/toast/ToastContext";

const DocumentFlowPage: React.FC = () => {
  const params = useParams();
  const id = Number(params.id);
  const navigate = useNavigate();

  const location = useLocation();
  const backTo: string = (location.state as any)?.from ?? "/documents";

  const handleBack = () => {
    navigate(backTo);
  };

  const [document, setDocument] = useState<Document | null>(null);
  const [allVersions, setAllVersions] = useState<DocumentVersion[]>([]);
  const [headerState, setHeaderState] = useState<{
    title: string;
    code: string;
    status: string;
    versionNumber: number;
    canAct: boolean;
    isTasksReady: boolean;
    headerActions: any[];
    versionActions: any[];
  } | null>(null);

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
  const [isLoadingSelectedVersion, setIsLoadingSelectedVersion] =
    useState(false);

  const [error, setError] = useState<string | null>(null);
  const [reviseModalOpen, setReviseModalOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [isRevising, setIsRevising] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [rightPanelContent, setRightPanelContent] =
    useState<React.ReactNode>(null);
  const rightPanelShell = React.useMemo(
    () => (
      <DocumentRightPanel
        document={null}
        version={null}
        offices={[]}
        newMessageCount={0}
        clearNewMessageCount={() => {}}
        activeSideTab="comments"
        setActiveSideTab={() => {}}
        isLoadingActivityLogs={true}
        activityLogs={[]}
        isLoadingMessages={true}
        messages={[]}
        draftMessage=""
        setDraftMessage={() => {}}
        isSendingMessage={false}
        onSendMessage={async () => {}}
        formatWhen={() => ""}
      />
    ),
    [],
  );
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [versionsDropdownOpen, setVersionsDropdownOpen] = useState(false);

  // ── Pending file upload (from create page async redirect) ─────────────────
  const toast = useToast();
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
  const [confirmAction, setConfirmAction] = useState<{
    key: string;
    label: string;
    variant: "primary" | "danger" | "outline";
    onClick: (note?: string) => Promise<void> | void;
  } | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [processingKey, setProcessingKey] = useState<string | null>(null);

  const handleHeaderActionClick = (a: any) => {
    setRejectNote("");
    setRejectError("");
    setConfirmAction(a);
  };

  const handleHeaderActionConfirm = async () => {
    if (!confirmAction) return;
    if (confirmAction.key === "REJECT" && !rejectNote.trim()) {
      setRejectError("A note is required when rejecting.");
      return;
    }
    const actionToRun = confirmAction;
    setProcessingKey(actionToRun.key);
    setConfirmAction(null); // close modal immediately
    try {
      await actionToRun.onClick(
        actionToRun.key === "REJECT" ? rejectNote : undefined,
      );
    } finally {
      setProcessingKey(null);
    }
  };
  const versionsDropdownRef = React.useRef<HTMLDivElement>(null);
  const versionsButtonRef = React.useRef<HTMLButtonElement>(null);
  const versionsFixedDropdownRef = React.useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = React.useState<{
    top: number;
    right: number;
  } | null>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      const inTrigger = versionsDropdownRef.current?.contains(e.target as Node);
      const inFixed = versionsFixedDropdownRef.current?.contains(
        e.target as Node,
      );
      if (!inTrigger && !inFixed) {
        setVersionsDropdownOpen(false);
      }
    };
    if (versionsDropdownOpen)
      window.document.addEventListener("mousedown", handler);
    return () => window.document.removeEventListener("mousedown", handler);
  }, [versionsDropdownOpen]);

  const statusColors: Record<string, string> = {
    draft:
      "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300",
    review:
      "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    approval: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    registration:
      "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    distributed:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };

  const getStatusColor = (status: string) => {
    const key = status.toLowerCase().trim();
    return (
      statusColors[key] ??
      Object.entries(statusColors).find(([k]) => key.includes(k))?.[1] ??
      statusColors.draft
    );
  };

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

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setError(null);
      setLoading(true);
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
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message ?? "Failed to load document");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
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

  // ── Versions dropdown (shared between loading + main render) ──────────────
  const versionsDropdown = (
    <div ref={versionsDropdownRef} className="flex items-center">
      <button
        ref={versionsButtonRef}
        type="button"
        onClick={() => {
          if (versionsButtonRef.current) {
            const r = versionsButtonRef.current.getBoundingClientRect();
            setDropdownPos({
              top: r.bottom + 6,
              right: window.innerWidth - r.right,
            });
          }
          setVersionsDropdownOpen((v) => !v);
        }}
        className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-surface-300 bg-slate-100 dark:bg-surface-500 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-surface-400 shadow-sm transition"
      >
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
          v{selectedVersion?.version_number ?? "—"}
        </span>
        {allVersions.length > 1 && (
          <span className="rounded-full bg-slate-300 dark:bg-surface-400 px-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
            {allVersions.length}
          </span>
        )}
        <svg
          className={`h-3 w-3 transition-transform ${versionsDropdownOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {versionsDropdownOpen && dropdownPos && (
        <div
          ref={versionsFixedDropdownRef}
          style={{
            position: "fixed",
            top: dropdownPos.top,
            right: dropdownPos.right,
          }}
          className="z-999 w-72 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shadow-xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-slate-100 dark:border-surface-400">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Select version
            </p>
          </div>
          <div className="max-h-56 overflow-y-auto">
            <div className="p-2 space-y-1">
              {allVersions.map((v) => {
                const isSel = v.id === (selectedVersion?.id ?? null);
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={isLoadingSelectedVersion}
                    onClick={() => {
                      setSearchParams((prev) => {
                        const p = new URLSearchParams(prev);
                        p.set("version_id", String(v.id));
                        return p;
                      });
                      logOpenedVersion(v.id, "versions_panel");
                      setVersionsDropdownOpen(false);
                    }}
                    className={[
                      "w-full rounded-lg px-3 py-2 text-left transition border",
                      isSel
                        ? "border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30"
                        : "border-transparent hover:bg-slate-50 dark:hover:bg-surface-500",
                      isLoadingSelectedVersion
                        ? "opacity-60 cursor-not-allowed"
                        : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          v{v.version_number}
                        </span>
                        {isSel && (
                          <span className="text-[10px] text-sky-500">
                            current
                          </span>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusColor(v.status)}`}
                      >
                        {v.status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                      {new Date(v.created_at).toLocaleDateString()} · Updated{" "}
                      {new Date(v.updated_at).toLocaleDateString()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Reset header sig when version changes so new state is always accepted
  React.useEffect(() => {
    headerSigRef.current = "";
  }, [selectedVersion?.id]);

  const rightHeader = versionsDropdown;

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (!params.id || Number.isNaN(id)) {
    return (
      <div className="flex flex-col gap-3">
        <BackButton onClick={handleBack} />
        <Alert variant="danger">Invalid document id.</Alert>
      </div>
    );
  }

  if (!loading && (error || !document)) {
    return (
      <div className="flex flex-col gap-3">
        <BackButton onClick={handleBack} />
        <Alert variant="danger">{error ?? "Document not found."}</Alert>
      </div>
    );
  }

  const current = selectedVersion ?? allVersions[0] ?? null;

  const isLatestSelected = current
    ? !allVersions.some(
        (v) => Number(v.version_number) > Number(current.version_number),
      )
    : false;

  const isRevisable = isLatestSelected && current?.status === "Distributed";

  return (
    <>
      <DocFrame
        title={
          <div className="min-w-0">
            <div className="flex items-start gap-2 min-w-0">
              {loading ? (
                <Skeleton className="h-4 w-48 mt-0.5" />
              ) : (
                <span className="min-w-0 whitespace-normal wrap-break-word leading-snug">
                  {headerState?.title ?? document?.title}
                </span>
              )}
              <div className="flex shrink-0 items-center gap-2">
                {loading ? (
                  <Skeleton className="h-5 w-7 rounded-full" />
                ) : (
                  <span className="rounded-full bg-slate-100 dark:bg-surface-400 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    v
                    {headerState?.versionNumber ??
                      current?.version_number ??
                      "-"}
                  </span>
                )}
                {loading ? (
                  <Skeleton className="h-5 w-20 rounded-full" />
                ) : (
                  <span className="rounded-full bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-400">
                    {headerState?.status ?? current?.status ?? "-"}
                  </span>
                )}
              </div>
            </div>
          </div>
        }
        subtitle={
          loading ? (
            <Skeleton className="h-3 w-36 mt-0.5" />
          ) : (
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {headerState?.code ?? document?.code ?? "CODE-NOT-AVAILABLE"}
            </span>
          )
        }
        onBack={handleBack}
        onBackDisabled={isLoadingSelectedVersion}
        rightWidthClass="w-[400px]"
        rightCollapsed={rightCollapsed}
        onCollapseToggle={() => setRightCollapsed((v) => !v)}
        actions={
          <div className="flex flex-wrap gap-2">
            {current?.status === "Distributed" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoadingSelectedVersion}
                onClick={() => setShareOpen(true)}
              >
                Share
              </Button>
            )}
            {isRevisable && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isLoadingSelectedVersion}
                onClick={() => {
                  setRevisionReason("");
                  setReviseModalOpen(true);
                }}
              >
                Revise
              </Button>
            )}
            {!headerState?.isTasksReady && current?.status !== "Distributed" ? (
              <div className="h-7 w-28 rounded-lg bg-slate-200 dark:bg-surface-400 animate-pulse" />
            ) : (
              (headerState?.headerActions ?? []).map((a: any) => {
                const isThis = processingKey === a.key;
                const isBusy = !!processingKey || isLoadingSelectedVersion;
                return (
                  <Button
                    key={a.key}
                    type="button"
                    size="sm"
                    variant={a.variant === "danger" ? "danger" : "primary"}
                    disabled={isBusy || a.disabled}
                    onClick={() => handleHeaderActionClick(a)}
                  >
                    {isThis ? (
                      <span className="flex items-center gap-1.5">
                        <svg
                          className="animate-spin h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                          />
                        </svg>
                        Processing…
                      </span>
                    ) : (
                      a.label
                    )}
                  </Button>
                );
              })
            )}
            {(headerState?.versionActions ?? []).map((a: any) => (
              <Button
                key={a.key}
                type="button"
                size="sm"
                variant={
                  a.variant === "danger"
                    ? "danger"
                    : a.variant === "outline"
                      ? "outline"
                      : "secondary"
                }
                onClick={() => a.onClick()}
                disabled={!!processingKey || isLoadingSelectedVersion}
              >
                {a.label}
              </Button>
            ))}
          </div>
        }
        rightHeader={rightHeader}
        left={
          <div className="relative">
            {pendingUploadPct !== null && (
              <div className="mb-3 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-sky-700 dark:text-sky-400">
                    Uploading file…
                  </span>
                  <span className="text-xs text-sky-600 dark:text-sky-500">
                    {pendingUploadPct}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-sky-100 dark:bg-sky-900/40 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-[width] duration-200"
                    style={{ width: `${Math.max(2, pendingUploadPct)}%` }}
                  />
                </div>
              </div>
            )}

            {!loading && !selectedVersion && !isLoadingSelectedVersion && (
              <Alert variant="warning">No version available.</Alert>
            )}
            <DocumentFlow
              isPageLoading={loading}
              document={document}
              version={selectedVersion}
              allVersions={allVersions}
              selectedVersion={selectedVersion}
              isLoadingSelectedVersion={isLoadingSelectedVersion}
              onSelectVersion={(v) => {
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev);
                  p.set("version_id", String(v.id));
                  return p;
                });
                logOpenedVersion(v.id, "versions_panel");
              }}
              onHeaderStateChange={(s) => {
                const sig =
                  `${s.title}|${s.code}|${s.status}|${s.versionNumber}|${s.canAct}|${s.isTasksReady}|` +
                  `${(s.headerActions ?? []).map((a) => `${a.key}:${a.disabled ? 1 : 0}:${a.variant}`).join(",")}|` +
                  `${(s.versionActions ?? []).map((a) => `${a.key}:${a.disabled ? 1 : 0}:${a.variant}`).join(",")}`;
                if (sig === headerSigRef.current) return;
                headerSigRef.current = sig;
                setHeaderState(s);
              }}
              onAfterActionClose={async () => {
                try {
                  await getDocument(id);
                } catch (e: any) {
                  navigate("/documents");
                  return;
                }
                await refreshAndSelectBest();
              }}
              onChanged={async () => {
                await refreshAndSelectBest({
                  preferVersionId: selectedVersion?.id ?? null,
                });
              }}
              onRightPanelContent={setRightPanelContent}
            />
          </div>
        }
        right={rightPanelContent ?? rightPanelShell}
      />

      <ShareDocumentModal
        open={shareOpen}
        documentId={document?.id ?? null}
        onClose={() => setShareOpen(false)}
        onSaved={() => {}}
      />

      {/* Header action confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-xl p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {confirmAction.key === "REJECT"
                ? "Reject document"
                : `Confirm: ${confirmAction.label}`}
            </h2>
            {confirmAction.key === "REJECT" ? (
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Rejection note <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => {
                    setRejectNote(e.target.value);
                    setRejectError("");
                  }}
                  placeholder="Explain why this document is being rejected…"
                  className="block w-full rounded-lg border border-slate-300 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/30"
                />
                {rejectError && (
                  <p className="mt-1 text-xs text-rose-600">{rejectError}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
                Are you sure you want to{" "}
                <span className="font-semibold">{confirmAction.label}</span>?
                This action cannot be undone.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction(null)}
                disabled={!!processingKey}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={confirmAction.key === "REJECT" ? "danger" : "primary"}
                size="sm"
                disabled={!!processingKey}
                onClick={handleHeaderActionConfirm}
              >
                {processingKey ? (
                  <span className="flex items-center gap-1.5">
                    <svg
                      className="animate-spin h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    Processing…
                  </span>
                ) : confirmAction.key === "REJECT" ? (
                  "Reject"
                ) : (
                  "Confirm"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Revision reason modal */}
      {reviseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-surface-400">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Start revision
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Optionally describe why this document is being revised.
              </p>
            </div>
            <div className="px-5 py-4">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Revision reason{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                className="w-full rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-500 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                rows={3}
                maxLength={1000}
                placeholder="e.g. Updated to reflect new compliance requirements…"
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
              />
              <p className="mt-1 text-right text-[10px] text-slate-400">
                {revisionReason.length}/1000
              </p>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 dark:border-surface-400 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRevising}
                onClick={() => setReviseModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={isRevising}
                onClick={async () => {
                  setIsRevising(true);
                  try {
                    const revised = await createRevision(document!.id, {
                      revision_reason: revisionReason.trim() || null,
                    });
                    setAllVersions((prev) => {
                      const next = [
                        revised,
                        ...prev.filter((v) => v.id !== revised.id),
                      ];
                      next.sort(
                        (a, b) =>
                          Number(b.version_number) - Number(a.version_number),
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
                  } catch (e: any) {
                    alert(`Revision failed: ${e.message}`);
                  } finally {
                    setIsRevising(false);
                  }
                }}
              >
                {isRevising ? "Creating…" : "Start revision"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DocumentFlowPage;
