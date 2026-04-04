import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, Pin, ChevronDown, ChevronUp } from "lucide-react";
import { AnnouncementTypePill } from "../ui/Badge";
import InlineSpinner from "../ui/loader/InlineSpinner";
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
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Initial loading or empty state
  if (announcements.length === 0) {
    if (loading) {
      return (
        <div className="flex h-[42px] items-center justify-center gap-3 rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-2 dark:border-surface-300/50 dark:bg-surface-600/30">
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
            <InlineSpinner className="h-3 w-3" />
            <span className="uppercase tracking-wider">Synchronizing broadcasts...</span>
          </div>
        </div>
      );
    }
    
    if (!canManage) return null;
    
    return (
      <div className="flex h-[42px] items-center justify-between gap-3 rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-surface-300 dark:bg-surface-600">
        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <Megaphone className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">No active announcements — post one to notify all users.</span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/announcements")}
          className="shrink-0 text-xs font-medium text-brand-500 hover:text-brand-400 dark:text-brand-400 transition-colors whitespace-nowrap"
        >
          Post →
        </button>
      </div>
    );
  }

  const pinned = announcements.filter(a => a.is_pinned);
  const regular = announcements.filter(a => !a.is_pinned);

  return (
    <div className="rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-surface-400 px-4 py-2 sm:py-2.5">
        <div className="flex items-center gap-2">
          <Megaphone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 leading-tight uppercase tracking-widest">
            Announcements
          </p>
        </div>
        <div className="flex items-center gap-3">
          {regular.length > 0 && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 uppercase tracking-tighter"
            >
              {isCollapsed ? "Expand" : "Collapse"}
              {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/announcements")}
            className="shrink-0 text-[10px] font-bold text-brand-500 hover:text-brand-400 dark:text-brand-400 transition-colors uppercase"
          >
            Manage →
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="divide-y divide-slate-100 dark:divide-surface-400">
        {loading ? (
          <>
            {(isCollapsed ? [1] : [1, 2, 3]).map((i) => (
              <div key={i} className="flex h-[42px] items-center px-4 gap-3">
                <Skeleton className="h-4 w-12 rounded-md shrink-0 opacity-50" />
                <Skeleton className="h-2.5 w-full max-w-[200px] rounded-full opacity-40" />
                <div className="flex-1" />
                <Skeleton className="h-2 w-12 rounded-full shrink-0 opacity-30" />
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Pinned - Always Expanded */}
            {pinned.map((a) => (
              <div key={a.id} className="flex items-stretch bg-slate-50/30 dark:bg-surface-400/10">
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
                  <div key={a.id} className="flex h-[42px] items-center">
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
                <div key={a.id} className="flex items-stretch">
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
          </>
        )}
      </div>
    </div>
  );
};

export default AnnouncementsBanner;
