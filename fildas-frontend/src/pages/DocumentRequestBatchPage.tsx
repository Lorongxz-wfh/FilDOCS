import React from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import { getAuthUser } from "../lib/auth";
import {
  getDocumentRequest,
  updateDocumentRequest,
  updateDocumentRequestStatus,
  type DocumentRequestItemRow,
  // type DocumentRequestProgress,
} from "../services/documentRequests";
import { Users, FileStack, RefreshCw, Ban, Check, Pencil, AlertTriangle } from "lucide-react";
import { roleLower, StatusBadge } from "../components/documentRequests/shared";
import RequestActivityPanel from "../components/documentRequests/RequestActivityPanel";
import RequestPreviewModal from "../components/documentRequests/RequestPreviewModal";
import InlineEditField from "../components/documentRequests/InlineEditField";
import RequestProgressBar from "../components/documentRequests/RequestProgressBar";
import { inputCls } from "../utils/formStyles";

export default function DocumentRequestBatchPage() {
  const navigate = useNavigate();
  const params = useParams();
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const requestId = Number(params.id);
  if (!Number.isFinite(requestId) || requestId <= 0)
    return <Navigate to="/dashboard" replace />;

  const role = roleLower(me);
  const isQa = role === "qa" || role === "sysadmin" || role === "admin";

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [req, setReq] = React.useState<any | null>(null);
  const [recipients, setRecipients] = React.useState<any[]>([]);
  const [items, setItems] = React.useState<DocumentRequestItemRow[]>([]);
  const [activityLogs, setActivityLogs] = React.useState<any[]>([]);
  const [activityLoading, setActivityLoading] = React.useState(false);
  const [previewModal, setPreviewModal] = React.useState<{
    url: string;
    filename?: string;
  } | null>(null);

  // Edit panel state
  const [editOpen, setEditOpen] = React.useState(false);
  const [editDesc, setEditDesc] = React.useState("");
  const [editDueAt, setEditDueAt] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);
  const [editErr, setEditErr] = React.useState<string | null>(null);

  const isMultiDoc = req?.mode === "multi_doc";

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDocumentRequest(requestId);
      setReq(data.request);
      setRecipients(data.recipients ?? []);
      setItems(data.items ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  React.useEffect(() => {
    load().catch(() => {});
  }, [load]);

  // Poll every 15s for status/progress updates
  React.useEffect(() => {
    const id = window.setInterval(() => {
      load().catch(() => {});
    }, 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }, [load]);

  const [statusUpdating, setStatusUpdating] = React.useState(false);
  const [confirmModal, setConfirmModal] = React.useState<{
    status: "closed" | "cancelled";
    label: string;
  } | null>(null);

  const handleStatusChange = React.useCallback((status: "closed" | "cancelled") => {
    setConfirmModal({ status, label: status === "closed" ? "close" : "cancel" });
  }, []);

  const handleConfirmStatus = React.useCallback(async () => {
    if (!confirmModal) return;
    const { status, label } = confirmModal;
    setConfirmModal(null);
    setStatusUpdating(true);
    try {
      await updateDocumentRequestStatus(requestId!, status);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? `Failed to ${label} request.`);
    } finally {
      setStatusUpdating(false);
    }
  }, [confirmModal, requestId, load]);

  // Sync edit fields when req loads
  React.useEffect(() => {
    if (!req) return;
    setEditDesc(req.description ?? "");
    setEditDueAt(req.due_at ? req.due_at.slice(0, 16) : "");
  }, [req?.id]);

  // ── Activity ───────────────────────────────────────────────────────────────
  const loadActivity = React.useCallback(async () => {
    setActivityLoading(true);
    try {
      const { default: api } = await import("../services/api");
      const res = await api.get("/activity", {
        params: { scope: "request", request_id: requestId, per_page: 50 },
      });
      setActivityLogs(res.data?.data ?? []);
    } catch {
      setActivityLogs([]);
    } finally {
      setActivityLoading(false);
    }
  }, [requestId]);

  React.useEffect(() => {
    loadActivity().catch(() => {});
  }, [loadActivity]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const saveTitle = async (title: string) => {
    await updateDocumentRequest(requestId, { title });
    setReq((prev: any) => ({ ...prev, title }));
  };

  const saveDetails = async () => {
    setEditSaving(true);
    setEditErr(null);
    try {
      await updateDocumentRequest(requestId, {
        description: editDesc.trim() || null,
        due_at: editDueAt || null,
      });
      setReq((prev: any) => ({
        ...prev,
        description: editDesc.trim() || null,
        due_at: editDueAt || null,
      }));
      setEditOpen(false);
    } catch (e: any) {
      setEditErr(e?.response?.data?.message ?? "Failed to save.");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading && !req) {
    return (
      <PageFrame
        title="Document Request"
        onBack={() => navigate("/document-requests")}
      >
        <div className="flex h-60 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-7 w-7 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Loading…
            </span>
          </div>
        </div>
      </PageFrame>
    );
  }

  if (error) {
    return (
      <PageFrame
        title="Document Request"
        onBack={() => navigate("/document-requests")}
      >
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
          {error}
        </div>
      </PageFrame>
    );
  }

  if (!req) return null;

  const statusColor: Record<string, string> = {
    pending: "text-amber-600 dark:text-amber-400",
    submitted: "text-sky-600 dark:text-sky-400",
    accepted: "text-emerald-600 dark:text-emerald-400",
    rejected: "text-rose-600 dark:text-rose-400",
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageFrame
      title={req.title ?? `Request #${requestId}`}
      onBack={() => navigate("/document-requests")}
      right={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="Refresh"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {isQa && req?.status === "open" && (
            <>
              <button
                type="button"
                onClick={() => handleStatusChange("closed")}
                disabled={statusUpdating}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
              >
                <Check className="h-3 w-3" /> Close
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange("cancelled")}
                disabled={statusUpdating}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-surface-500 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 transition"
              >
                <Ban className="h-3 w-3" /> Cancel
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="grid h-full min-h-0 overflow-hidden grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ── LEFT ── */}
        <section className="lg:col-span-7 min-w-0 flex flex-col gap-4">
          {/* Header card */}
          <div className="rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-surface-400">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
                #{requestId}
              </span>
              {isQa ? (
                <InlineEditField
                  value={req.title ?? ""}
                  onSave={saveTitle}
                  className="flex-1 text-base font-bold tracking-tight text-slate-900 dark:text-slate-100"
                />
              ) : (
                <h1 className="flex-1 text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                  {req.title}
                </h1>
              )}
              <StatusBadge status={req.status} />
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0",
                  isMultiDoc
                    ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400"
                    : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-400",
                ].join(" ")}
              >
                {isMultiDoc ? (
                  <FileStack className="h-3 w-3" />
                ) : (
                  <Users className="h-3 w-3" />
                )}
                {isMultiDoc ? "Multi-Doc" : "Multi-Office"}
              </span>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-4 px-5 py-2.5 bg-slate-50/50 dark:bg-surface-600/40 flex-wrap text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">
                Due:{" "}
                <strong className="text-slate-700 dark:text-slate-300">
                  {req.due_at
                    ? new Date(req.due_at).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })
                    : "—"}
                </strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Created:{" "}
                <strong className="text-slate-700 dark:text-slate-300">
                  {req.created_at
                    ? new Date(req.created_at).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })
                    : "—"}
                </strong>
              </span>
              {isQa && (
                <button
                  type="button"
                  onClick={() => setEditOpen((o) => !o)}
                  className="ml-auto flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition"
                >
                  <Pencil className="h-3 w-3" />
                  {editOpen ? "Close" : "Edit details"}
                </button>
              )}
            </div>

            {/* Edit panel — QA only */}
            {isQa && editOpen && (
              <div className="px-5 py-4 border-t border-slate-100 dark:border-surface-400 flex flex-col gap-3 bg-slate-50/30 dark:bg-surface-600/30">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Add instructions for recipients…"
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Due date (batch)
                  </label>
                  <input
                    type="datetime-local"
                    value={editDueAt}
                    onChange={(e) => setEditDueAt(e.target.value)}
                    className={inputCls}
                  />
                </div>
                {editErr && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {editErr}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditOpen(false);
                      setEditErr(null);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveDetails}
                    disabled={editSaving}
                    className="rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition"
                  >
                    {editSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}

            {/* Description display */}
            {req.description && !editOpen && (
              <div className="px-5 py-3 border-t border-blue-100 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400 mb-1">
                  Instructions
                </p>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {req.description}
                </p>
              </div>
            )}
          </div>

          {/* Progress */}
          {req.progress && (
            <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-5 py-4">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
                {isMultiDoc ? "Document Progress" : "Office Progress"}
              </p>
              <RequestProgressBar progress={req.progress} />
            </div>
          )}

          {/* Items / recipients list */}
          <div
            className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden flex flex-col"
            style={{ height: "calc(100vh - 360px)" }}
          >
            <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-surface-400 bg-slate-50/80 dark:bg-surface-600/80 flex items-center gap-2">
              {isMultiDoc ? (
                <FileStack className="h-4 w-4 text-violet-500" />
              ) : (
                <Users className="h-4 w-4 text-sky-500" />
              )}
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {isMultiDoc ? "Document Items" : "Recipient Offices"}
              </p>
              <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                {isMultiDoc ? items.length : recipients.length} total
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-surface-400 overflow-y-auto flex-1">
              {isMultiDoc
                ? items.map((item, idx) => {
                    const sub = item.latest_submission;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          navigate(
                            `/document-requests/${requestId}/items/${item.id}`,
                          )
                        }
                        className="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                      >
                        <span className="shrink-0 text-xs font-bold text-slate-400 w-5 text-center">
                          {idx + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                              {item.description}
                            </p>
                          )}
                        </div>
                        {item.example_original_filename && (
                          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
                            Has example
                          </span>
                        )}
                        <span
                          className={`shrink-0 text-xs font-semibold uppercase ${statusColor[sub?.status ?? "pending"] ?? "text-slate-400"}`}
                        >
                          {sub?.status ?? "pending"}
                        </span>
                      </button>
                    );
                  })
                : recipients.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() =>
                        navigate(
                          `/document-requests/${requestId}/recipients/${r.id}`,
                        )
                      }
                      className="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">
                          {r.office_name ?? `Office #${r.office_id}`}
                        </p>
                        {r.office_code && (
                          <p className="text-[11px] text-slate-400 font-mono">
                            {r.office_code}
                          </p>
                        )}
                      </div>
                      {r.due_at && (
                        <span className="shrink-0 text-[11px] text-amber-600 dark:text-amber-400 hidden sm:block">
                          Due {new Date(r.due_at).toLocaleDateString()}
                        </span>
                      )}
                      {r.latest_submission_at && (
                        <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
                          {new Date(
                            r.latest_submission_at,
                          ).toLocaleDateString()}
                        </span>
                      )}
                      <span
                        className={`shrink-0 text-xs font-semibold uppercase ${statusColor[r.status] ?? "text-slate-500"}`}
                      >
                        {r.status}
                      </span>
                    </button>
                  ))}
            </div>
          </div>
        </section>

        {/* ── RIGHT ── */}
        <aside className="lg:col-span-5 flex flex-col gap-4">
          {/* Summary — QA only */}
          {isQa && (
            <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-surface-400 bg-slate-50/80 dark:bg-surface-600/80">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Summary
                </p>
              </div>
              <div className="px-4 py-4 flex flex-col gap-3">
                {[
                  {
                    label: "Total",
                    value: req.progress?.total ?? 0,
                    color: "text-slate-700 dark:text-slate-300",
                  },
                  {
                    label: "Pending",
                    value:
                      (req.progress?.total ?? 0) -
                      (req.progress?.submitted ?? 0),
                    color: "text-amber-600 dark:text-amber-400",
                  },
                  {
                    label: "Submitted",
                    value: req.progress?.submitted ?? 0,
                    color: "text-sky-600 dark:text-sky-400",
                  },
                  {
                    label: "Accepted",
                    value: req.progress?.accepted ?? 0,
                    color: "text-emerald-600 dark:text-emerald-400",
                  },
                  {
                    label: "Rejected",
                    value:
                      (req.progress?.submitted ?? 0) -
                      (req.progress?.accepted ?? 0),
                    color: "text-rose-600 dark:text-rose-400",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {stat.label}
                    </span>
                    <span className={`text-sm font-bold ${stat.color}`}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions — non-QA */}
          {!isQa && req.description && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-400 mb-2">
                Instructions
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {req.description}
              </p>
            </div>
          )}

          {/* Activity */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden flex-1 min-h-0">
            <div className="shrink-0 border-b border-slate-200 dark:border-surface-400 px-4 py-2.5">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Activity
              </p>
            </div>
            <RequestActivityPanel
              logs={activityLogs}
              loading={activityLoading}
            />
          </div>
        </aside>
      </div>

      {previewModal && (
        <RequestPreviewModal
          url={previewModal.url}
          filename={previewModal.filename}
          onClose={() => setPreviewModal(null)}
        />
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shadow-xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className={`flex items-center justify-center h-9 w-9 rounded-full ${confirmModal.status === "cancelled" ? "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400" : "bg-slate-100 dark:bg-surface-500 text-slate-600 dark:text-slate-300"}`}>
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                  {confirmModal.label} this request?
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {confirmModal.status === "cancelled"
                    ? "This will void the request. This action cannot be undone."
                    : "This will mark the request as closed and stop accepting submissions."}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={statusUpdating}
                className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={handleConfirmStatus}
                disabled={statusUpdating}
                className={`px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 transition ${confirmModal.status === "cancelled" ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 text-white"}`}
              >
                {statusUpdating ? "Processing…" : `Yes, ${confirmModal.label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageFrame>
  );
}
