import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, Pin, ChevronDown, ChevronUp } from "lucide-react";
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
  info: "bg-sky-400",
  warning: "bg-amber-400",
  urgent: "bg-rose-500",
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
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [newAnnouncementIds, setNewAnnouncementIds] = useState<Set<number>>(new Set());

  // Track new arrivals for animation
  React.useEffect(() => {
    if (announcements.length > 0) {
      const ids = announcements.map(a => a.id);
      setNewAnnouncementIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => {
          if (!prev.has(id)) next.add(id);
        });
        return next;
      });

      // Cleanup animation classes after 400ms
      const timer = setTimeout(() => {
        setNewAnnouncementIds(new Set(ids));
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [announcements]);

  // Initial loading state - shimmer skeleton
  if (loading && announcements.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-surface-400 px-4 py-2 sm:py-2.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-3 w-24 rounded-full" />
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-surface-400">
          {[1, 2].map((i) => (
            <div key={i} className="flex h-[42px] items-center px-4 gap-3">
              <Skeleton className="h-4 w-12 rounded-md shrink-0 opacity-40" />
              <Skeleton className="h-2.5 w-full max-w-[240px] rounded-full opacity-30" />
              <div className="flex-1" />
              <Skeleton className="h-2 w-16 rounded-full shrink-0 opacity-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Finalized empty state
  if (announcements.length === 0) {
    if (!canManage) return null;

    return (
      <div className="flex h-[42px] items-center justify-between gap-3 rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-surface-300 dark:bg-surface-600 transition-all duration-300">
        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <Megaphone className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">No active announcements — notify all users.</span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/announcements")}
          className="shrink-0 text-xs font-bold text-brand-500 hover:text-brand-400 dark:text-brand-400"
        >
          Post →
        </button>
      </div>
    );
  }

  const pinned = announcements.filter(a => a.is_pinned);
  const regular = announcements.filter(a => !a.is_pinned);

  const isRecentlyAdded = (id: number) => !newAnnouncementIds.has(id);

  return (
    <div className="rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-surface-400 px-4 py-2 sm:py-2.5">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-brand-500 dark:text-brand-400 fill-brand-500/10" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight truncate">
            Announcements
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {regular.length > 0 && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 uppercase tracking-tight transition-colors"
            >
              <span className="hidden sm:inline">{isCollapsed ? "Expand" : "Collapse"}</span>
              {isCollapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/announcements")}
            className="shrink-0 text-[10px] sm:text-[11px] font-bold text-brand-500 hover:text-brand-400 dark:text-brand-400 transition-colors uppercase tracking-tight flex items-center gap-1"
          >
            <span className="hidden sm:inline">Manage</span>
            <span className="text-[13px] sm:text-[11px]">→</span>
          </button>
        </div>
      </div>

      {/* Body - Reserved min-height to prevent jumping */}
      <div className="divide-y divide-slate-100 dark:divide-surface-400 min-h-[42px] transition-all duration-300 relative">
        {/* Pinned - Always Expanded */}
        {pinned.map((a) => (
          <div
            key={a.id}
            className={`flex items-stretch bg-emerald-50/10 dark:bg-emerald-500/5 ${isRecentlyAdded(a.id) ? "animate-live-entry" : ""}`}
          >
            <div className={`w-1 shrink-0 ${TYPE_BAR[a.type] ?? "bg-slate-300"}`} />
            <div className="flex flex-1 min-w-0 flex-col px-4 py-3 gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                  {a.title}
                </p>
                <Pin className="h-3 w-3 text-brand-500 dark:text-brand-400 shrink-0 fill-current" />
                <AnnouncementTypePill type={a.type} />
              </div>
              <p
                className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2"
                dangerouslySetInnerHTML={{ __html: a.body }}
              />
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 uppercase font-medium">
                <span className="text-slate-600 dark:text-slate-300">{a.created_by}</span>
                <span>·</span>
                <span>{timeAgo(a.created_at)}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Regular - Conditional Collapse */}
        {regular.map((a) => {
          if (isCollapsed) {
            return (
              <div
                key={a.id}
                className={`flex h-[42px] items-center ${isRecentlyAdded(a.id) ? "animate-live-entry border-b-emerald-500/20" : ""}`}
              >
                <div className={`w-1 self-stretch ${TYPE_BAR[a.type] ?? "bg-slate-300"}`} />
                <div className="flex flex-1 items-center justify-between gap-3 px-4 py-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <AnnouncementTypePill type={a.type} className="scale-90 origin-left" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate leading-none">
                      {a.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums uppercase whitespace-nowrap">
                    <span className="hidden sm:inline text-slate-500 dark:text-slate-400">{a.created_by}</span>
                    <span className="hidden sm:inline opacity-50">·</span>
                    <span>{timeAgo(a.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={a.id}
              className={`flex items-stretch ${isRecentlyAdded(a.id) ? "animate-live-entry bg-emerald-500/5" : ""}`}
            >
              <div className={`w-1 shrink-0 ${TYPE_BAR[a.type] ?? "bg-slate-300"}`} />
              <div className="flex flex-1 min-w-0 flex-col px-4 py-3 gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                    {a.title}
                  </p>
                  <AnnouncementTypePill type={a.type} />
                </div>
                <p
                  className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: a.body }}
                />
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 uppercase font-medium">
                  <span className="text-slate-600 dark:text-slate-300">{a.created_by}</span>
                  <span>·</span>
                  <span>{timeAgo(a.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnnouncementsBanner;
