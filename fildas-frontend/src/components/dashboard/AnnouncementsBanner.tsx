import React from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, Pin } from "lucide-react";
import { AnnouncementTypePill } from "../ui/Badge";
import Skeleton from "../ui/loader/Skeleton";
import { type Announcement } from "../../services/documents";
import { getUserRole } from "../../lib/roleFilters";

interface Props {
  announcements: Announcement[];
  loading: boolean;
  onDeleted?: (id: number) => void;
}

const TYPE_BAR: Record<string, string> = {
  info:    "bg-sky-400",
  warning: "bg-amber-400",
  urgent:  "bg-rose-500",
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const AnnouncementsBanner: React.FC<Props> = ({ announcements, loading }) => {
  const navigate = useNavigate();
  const role = getUserRole();
  const canManage = role === "QA" || role === "ADMIN" || role === "SYSADMIN";

  // Empty state — only QA/Admin see it
  if (!loading && announcements.length === 0) {
    if (!canManage) return null;
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-surface-300 dark:bg-surface-600">
        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <Megaphone className="h-3.5 w-3.5 shrink-0" />
          <span>No active announcements — post one to notify all users.</span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/announcements")}
          className="shrink-0 text-xs font-medium text-brand-500 hover:text-brand-400 dark:text-brand-400 transition-colors whitespace-nowrap"
        >
          Go to announcements →
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-surface-400 px-4 py-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
            Announcements
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/announcements")}
          className="shrink-0 text-xs font-medium text-brand-500 hover:text-brand-400 dark:text-brand-400 transition-colors"
        >
          View all →
        </button>
      </div>

      {/* Body */}
      <div className="divide-y divide-slate-100 dark:divide-surface-400">
        {loading ? (
          <div className="px-4 py-3 space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : (
          announcements.map((a) => {
            return (
              <div key={a.id} className="flex items-stretch">
                <div className={`w-1 shrink-0 rounded-l-sm ${TYPE_BAR[a.type] ?? "bg-slate-300"}`} />
                <div className="flex flex-1 min-w-0 flex-col px-4 py-3 gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                      {a.title}
                    </p>
                    {a.is_pinned && (
                      <Pin className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                    )}
                    <AnnouncementTypePill type={a.type} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {a.body}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                    <span>{a.created_by}</span>
                    <span>·</span>
                    <span>{timeAgo(a.created_at)}</span>
                    {a.expires_at && (
                      <>
                        <span>·</span>
                        <span>
                          Expires{" "}
                          {new Date(a.expires_at).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AnnouncementsBanner;
