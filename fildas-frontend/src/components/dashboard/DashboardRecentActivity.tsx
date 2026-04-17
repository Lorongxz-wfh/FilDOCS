import React from "react";
import { useNavigate } from "react-router-dom";
import SkeletonList from "../ui/loader/SkeletonList";
import type { ActivityLogItem } from "../../services/documents";
import {
  Send,
  CheckCircle2,
  XCircle,
  CornerUpLeft,
  Share2,
  BookMarked,
  Activity,
  History,
} from "lucide-react";
import { formatRelative } from "../../utils/formatters";
import { friendlyEvent } from "../../utils/activityFormatters";
import EmptyState from "../ui/EmptyState";
import { Card, CardHeader, CardBody } from "../ui/Card";

type Props = {
  logs: ActivityLogItem[];
  loading: boolean;
  hasData?: boolean;
};

type EventMeta = {
  icon: React.ReactNode;
  bg: string;
  text: string;
};

const getEventMeta = (event: string): EventMeta => {
  const e = event.toLowerCase();
  if (e.includes("approved") || e.includes("approval"))
    return {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-600 dark:text-emerald-400",
    };
  if (e.includes("rejected") || e.includes("reject"))
    return {
      icon: <XCircle className="h-3.5 w-3.5" />,
      bg: "bg-rose-50 dark:bg-rose-950/40",
      text: "text-rose-600 dark:text-rose-400",
    };
  if (e.includes("returned") || e.includes("return"))
    return {
      icon: <CornerUpLeft className="h-3.5 w-3.5" />,
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-600 dark:text-amber-400",
    };
  if (e.includes("distributed") || e.includes("distribute"))
    return {
      icon: <Share2 className="h-3.5 w-3.5" />,
      bg: "bg-sky-50 dark:bg-sky-950/40",
      text: "text-sky-600 dark:text-sky-400",
    };
  if (e.includes("registered") || e.includes("register"))
    return {
      icon: <BookMarked className="h-3.5 w-3.5" />,
      bg: "bg-violet-50 dark:bg-violet-950/40",
      text: "text-violet-600 dark:text-violet-400",
    };
  if (e.includes("submitted") || e.includes("submit"))
    return {
      icon: <Send className="h-3.5 w-3.5" />,
      bg: "bg-brand-50 dark:bg-brand-950/30",
      text: "text-brand-600 dark:text-brand-400",
    };
  return {
    icon: <Activity className="h-3.5 w-3.5" />,
    bg: "bg-slate-100 dark:bg-surface-400",
    text: "text-slate-500 dark:text-slate-400",
  };
};

/**
 * Standardized Dashboard Recent Activity List
 * Migrated to use the Card component system.
 */
const DashboardRecentActivity: React.FC<Props> = ({ logs, loading, hasData }) => {
  const navigate = useNavigate();
  const [newLogIds, setNewLogIds] = React.useState<Set<number>>(new Set());

  // Track new arrivals for animation
  React.useEffect(() => {
    if (logs.length > 0) {
      const ids = logs.map(l => l.id);
      setNewLogIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => {
          if (!prev.has(id)) next.add(id);
        });
        return next;
      });

      const timer = setTimeout(() => {
        setNewLogIds(new Set(ids));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [logs]);

  const isRecentlyAdded = (id: number) => !newLogIds.has(id);

  return (
    <Card className="h-full">
      <CardHeader
        title="Recent activity"
        subtitle="The latest actions across your documents."
        icon={<History className="h-4 w-4" />}
      />

      <CardBody noPadding className="relative min-h-[300px]">
        <div className={`p-4 space-y-4 transition-opacity duration-200 ${loading && hasData ? "opacity-60" : "opacity-100"}`}>
          {loading && !hasData ? (
            <SkeletonList variant="activity" rows={4} className="divide-y divide-slate-100 dark:divide-surface-400" />
          ) : logs.length === 0 ? (
            <EmptyState
              label="No recent activity"
              description="Latest actions will appear here when they occur."
              className="py-10"
            />
          ) : (
            <div className="space-y-4">
              {logs.slice(0, 10).map((log, idx) => {
                const meta = getEventMeta(log.event);

                const targetName = log.document
                  ? (log.document.code ? `${log.document.code} — ${log.document.title}` : log.document.title)
                  : (Object(log).document_request?.title || log.meta?.document_request_title || log.meta?.filename || log.meta?.original_filename || "System Action");

                const actorName = log.actor_user
                  ? `${log.actor_user.first_name} ${log.actor_user.last_name}${Object(log.actor_user).role?.name ? ` (${Object(log.actor_user).role.name})` : ""}`
                  : (log.actor_office?.code || "System");

                const handleLogClick = () => {
                  if (log.document_id) {
                    navigate(`/documents/${log.document_id}`);
                  } else {
                    const requestId = Object(log).document_request?.id || log.meta?.document_request_id;
                    if (requestId) {
                      navigate(`/document-requests/${requestId}`);
                    }
                  }
                };

                const isClickable = !!(log.document_id || Object(log).document_request?.id || log.meta?.document_request_id);

                return (
                  <div
                    key={log.id}
                    onClick={isClickable ? handleLogClick : undefined}
                    className={`flex items-start gap-3 group/item ${isRecentlyAdded(log.id) ? "animate-live-entry" : ""} ${isClickable ? "cursor-pointer" : ""}`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-slate-100 dark:border-surface-400/30 bg-white dark:bg-surface-500 ${meta.text} shadow-xs transition-transform group-hover/item:scale-110`}>
                      {meta.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`text-[12px] sm:text-[13px] font-bold uppercase tracking-tight leading-tight transition-colors ${isClickable ? "text-slate-800 dark:text-slate-100 group-hover/item:text-sky-600 dark:group-hover/item:text-sky-400" : "text-slate-600 dark:text-slate-300"}`}>
                        {friendlyEvent(log.event)}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium overflow-hidden">
                        <span className="shrink-0 font-bold text-slate-600 dark:text-slate-300">
                          {actorName}
                        </span>
                        <span className="shrink-0 opacity-40">|</span>
                        <span className="truncate max-w-[50%]">
                          {targetName}
                        </span>
                        <span className="shrink-0 opacity-40">|</span>
                        <span className="tabular-nums whitespace-nowrap opacity-80">
                          {formatRelative(log.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fading overlay + Minimal Button */}
        {!loading && (
          <div className={`inset-x-0 bottom-0 flex items-center justify-center ${logs.length > 0 ? "absolute h-24 bg-gradient-to-t from-white dark:from-surface-500 via-white/90 dark:via-surface-500/90 to-transparent pointer-events-none" : "py-4"}`}>
            <div className={`${logs.length > 0 ? "pb-4 pointer-events-auto" : ""}`}>
              <button
                type="button"
                onClick={() => navigate("/activity-logs")}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider shadow-sm hover:bg-slate-50 dark:hover:bg-surface-400 transition-all active:scale-95"
              >
                View full activity
              </button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default DashboardRecentActivity;
