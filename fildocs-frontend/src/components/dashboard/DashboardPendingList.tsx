import React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { StatusBadge } from "../ui/Badge";
import SkeletonList from "../ui/loader/SkeletonList";
import InlineSpinner from "../ui/loader/InlineSpinner";
import type { PendingAction } from "../../services/types";
import { FileText, CheckCircle, Megaphone, Inbox } from "lucide-react";
import { Card, CardHeader, CardBody } from "../ui/Card";
import { TRANSITION_EASE_OUT } from "../../utils/animations";

type Props = {
  items: PendingAction[];
  loading: boolean;
  hasData?: boolean;
};

/**
 * Standardized Dashboard Pending List
 * Migrated to use the Card component system.
 */
const DashboardPendingList: React.FC<Props> = ({ items, loading, hasData }) => {
  const navigate = useNavigate();

  return (
    <Card className="h-full">
      <CardHeader
        title="Pending actions"
        subtitle="Items requiring your attention right now."
        icon={<Inbox className="h-4 w-4" />}
        right={loading && hasData && <InlineSpinner size="xs" variant="neutral" className="shrink-0" />}
      />

      <CardBody noPadding className="relative min-h-[240px]">
        <div
          className={`divide-y divide-neutral-200/60 dark:divide-surface-400 transition-opacity duration-200 ${loading && hasData ? "opacity-60" : "opacity-100"}`}
        >
          {loading && !hasData ? (
            <div className="flex flex-col h-full bg-white dark:bg-surface-500">
              <div className="flex-1 overflow-y-auto p-4">
                <SkeletonList variant="document" count={4} />
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4 animate-in fade-in duration-500">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                All caught up
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500 italic">
                No pending actions requiring attention.
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {items.slice(0, 5).map((x, i) => {
                const isRequest = x.type === "request";
                const Icon = isRequest ? Megaphone : FileText;

                const handleClick = () => {
                  if (x.type === "document") {
                    navigate(`/documents/${x.item.document.id}?version_id=${x.item.version.id}`);
                  } else {
                    navigate(`/document-requests/${x.id}`);
                  }
                };

                return (
                  <motion.button
                    layout
                    key={`${x.type}-${x.id}`}
                    initial={{ opacity: 0, transform: "translateX(-8px)" }}
                    animate={{ opacity: 1, transform: "translateX(0)" }}
                    exit={{ opacity: 0, transform: "translateX(8px)" }}
                    transition={{ 
                      duration: 0.3, 
                      ease: TRANSITION_EASE_OUT,
                      delay: i * 0.04 
                    }}
                    type="button"
                    onClick={handleClick}
                    className="flex w-full items-center gap-2.5 sm:gap-3 px-3 py-2 sm:px-4 sm:py-2.5 t-left transition-colors hover:bg-neutral-50 dark:hover:bg-surface-400 min-w-0"
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border border-neutral-200/60 dark:border-surface-300 ${isRequest ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-500' : 'bg-neutral-50 dark:bg-surface-400 text-neutral-500 dark:text-neutral-400'}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-neutral-900 dark:text-neutral-50 leading-tight">
                        {x.title}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] sm:text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
                        {x.type === "document" ? (x.code || (x.item as any)?.document?.reserved_code || "—") : (x.code || "—")}
                        {x.type === "document" && x.item?.version?.version_number !== undefined && (
                          <> · v{x.item.version.version_number}</>
                        )}
                      </p>
                    </div>

                    <StatusBadge status={x.status} className="shrink-0" />
                  </motion.button>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Fading overlay + Minimal Button */}
        {!loading && (
          <div className={`inset-x-0 bottom-0 flex items-center justify-center ${items.length > 0 ? "absolute h-24 bg-gradient-to-t from-white dark:from-surface-500 via-white/80 dark:via-surface-500/80 to-transparent pointer-events-none" : "py-4"}`}>
            <div className={`${items.length > 0 ? "pb-4 pointer-events-auto" : ""}`}>
              <button
                type="button"
                onClick={() => navigate("/work-queue")}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200/80 dark:border-surface-400 bg-white dark:bg-surface-500 rounded text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider hover:bg-neutral-50 dark:hover:bg-surface-400 transition-all active:scale-95 shadow-sm"
              >
                View all pending
              </button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default DashboardPendingList;
