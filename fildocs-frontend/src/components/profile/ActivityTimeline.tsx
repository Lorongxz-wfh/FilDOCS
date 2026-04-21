import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  CheckCircle2, 
  MessageSquare, 
  ArrowRight, 
  History, 
  AlertCircle,
  ExternalLink,
  type LucideIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { friendlyEvent } from "../../utils/activityFormatters";
import Skeleton from "../ui/loader/Skeleton";

export interface ActivityLogRow {
  id: number;
  event: string;
  label?: string | null;
  document_id?: number | null;
  document_version_id?: number | null;
  meta?: any;
  created_at?: string | null;
  document?: {
    id: number;
    title: string;
    code: string | null;
  } | null;
}

interface ActivityTimelineProps {
  items: ActivityLogRow[];
  loading?: boolean;
}

const EVENT_ICONS: Record<string, LucideIcon> = {
  "workflow.forward": ArrowRight,
  "workflow.approve": CheckCircle2,
  "workflow.return": History,
  "workflow.rejected": AlertCircle,
  "document.create": FileText,
  "document.update": FileText,
  "document.distribute": FileText,
  "workflow.start_finalization": FileText,
  "message.create": MessageSquare,
  "request.create": AlertCircle,
  "document_request.created": AlertCircle,
};

const CATEGORY_COLORS: Record<string, string> = {
  workflow: "bg-sky-500",
  document: "bg-emerald-500",
  request: "bg-violet-500",
  other: "bg-slate-400",
};

function categoryFromEvent(event: string): string {
  if (event.startsWith("workflow.")) return "workflow";
  if (event.startsWith("document.") || event.startsWith("version.") || event.startsWith("message.")) return "document";
  if (event.startsWith("request.") || event.startsWith("document_request")) return "request";
  return "other";
}

function getDateLabel(dateStr?: string | null): string {
  if (!dateStr) return "Unknown Date";
  const date = new Date(dateStr);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) return "Today";
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ items, loading }) => {
  const navigate = useNavigate();

  // Group activities by date
  const groups = items.reduce((acc: { label: string; items: ActivityLogRow[] }[], item) => {
    const label = getDateLabel(item.created_at);
    const existing = acc.find(g => g.label === label);
    if (existing) {
      existing.items.push(item);
    } else {
      acc.push({ label, items: [item] });
    }
    return acc;
  }, []);

  const handleItemClick = (item: ActivityLogRow) => {
    // 1. Check for request associations
    const requestId = item.meta?.document_request_id || item.meta?.request_id || item.meta?.batch_id;
    if (requestId) {
      return navigate(`/document-requests/${requestId}`);
    }

    // 2. Check for document associations
    const docId = item.document_id || item.meta?.document_id;
    if (docId) {
      if (item.event === "document.distribute" || item.event === "document.finalize") {
        return navigate(`/documents/${docId}/view`);
      }
      return navigate(`/documents/${docId}`);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="relative space-y-8 p-4">
        {/* Main vertical line */}
        <div className="absolute left-8 top-8 bottom-8 w-px bg-slate-100 dark:bg-surface-400" />
        
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="relative flex items-start gap-5">
            <div className="relative z-10 h-8 w-8 rounded-full bg-slate-50 dark:bg-surface-400 border-4 border-white dark:border-surface-500  shrink-0 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
            </div>
            <div className="flex-1 space-y-3 py-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-12" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-10 w-10 text-slate-300 dark:text-surface-300 mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No activity history found.</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Your recent actions will appear here in a timeline.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-8 p-4">
      {/* Main vertical line */}
      <motion.div 
        initial={{ height: 0 }}
        animate={{ height: "calc(100% - 64px)" }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="absolute left-8 top-8 w-px bg-slate-200 dark:bg-surface-400 origin-top" 
      />

      <AnimatePresence initial={false} mode="popLayout">
        {groups.map((group) => (
          <motion.div 
            layout
            key={group.label} 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="relative"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-6 bg-white dark:bg-surface-500 sticky top-0 py-1 z-20 w-fit pr-4">
              {group.label}
            </h3>
            
            <div className="space-y-8">
              <AnimatePresence initial={false}>
                {group.items.map((item, idx) => {
                  const category = categoryFromEvent(item.event);
                  const Icon = EVENT_ICONS[item.event] || History;
                  const isClickable = !!(item.document_id || item.meta?.document_id || item.meta?.document_request_id || item.meta?.request_id || item.meta?.batch_id);
                  
                  return (
                    <motion.div 
                      layout
                      key={item.id} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ 
                        duration: 0.25, 
                        delay: Math.min(idx * 0.05, 0.3),
                        ease: "easeOut" 
                      }}
                      className={`relative flex items-start gap-5 group rounded-md p-2 -m-2 ${isClickable ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-surface-400/20" : ""}`}
                      onClick={() => isClickable && handleItemClick(item)}
                    >
                      {/* Timeline marker with scale animation */}
                      <motion.div 
                        whileHover={{ scale: 1.1 }}
                        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-white dark:border-surface-500 text-white  ring-1 ring-slate-100 dark:ring-surface-400/50 ${CATEGORY_COLORS[category]}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </motion.div>

                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                           <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                            {friendlyEvent(item.event)}
                          </p>
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                            {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                          </span>
                        </div>

                        {item.label && (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                            {item.label}
                          </p>
                        )}
                        
                        {isClickable && (
                           <div className="mt-2 flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wider text-brand-500 dark:text-brand-400 group-hover:text-brand-600 transition-colors">
                              <ExternalLink className="h-2.5 w-2.5" />
                              <span>View Details</span>
                           </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

