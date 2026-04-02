import React from "react";
import RefreshButton from "../ui/RefreshButton";
import { List, CalendarDays, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  tab: "log" | "calendar";
  setTab: (tab: "log" | "calendar") => void;
  onRefresh: () => Promise<string | false>;
  refreshing: boolean;
  onExport: (format: "csv" | "pdf") => void;
  exporting: boolean;
  disabled?: boolean;
}

const ActivityLogsHeader: React.FC<Props> = ({
  tab,
  setTab,
  onRefresh,
  refreshing,
  onExport,
  exporting,
  disabled = false,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {tab === "log" && (
        <div className="flex items-center rounded-xl sm:rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden text-[10px] sm:text-xs font-bold shrink-0 shadow-sm">
          <button
            type="button"
            onClick={() => onExport("csv")}
            disabled={exporting || disabled}
            className="px-2 sm:px-2.5 py-1.5 sm:py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition border-r border-slate-200 dark:border-surface-400 disabled:opacity-50 active:scale-95"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => onExport("pdf")}
            disabled={exporting || disabled}
            className="px-2 sm:px-2.5 py-1.5 sm:py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition disabled:opacity-50 active:scale-95"
          >
            PDF
          </button>
        </div>
      )}

      <RefreshButton
        onRefresh={onRefresh}
        loading={refreshing || exporting}
        title="Refresh logs"
        className="h-9 w-9 p-0 rounded-xl sm:h-8 sm:w-8 sm:rounded-md transition-all active:scale-95"
      />

      <div className="flex items-center rounded-xl sm:rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-0.5 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setTab("log")}
          className={`p-1.5 sm:p-1.5 rounded-lg sm:rounded-md transition ${
            tab === "log"
              ? "bg-slate-100 dark:bg-surface-400 text-slate-900 dark:text-slate-100 shadow-xs"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          } active:scale-95`}
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => setTab("calendar")}
          className={`p-1.5 sm:p-1.5 rounded-lg sm:rounded-md transition ${
            tab === "calendar"
              ? "bg-slate-100 dark:bg-surface-400 text-slate-900 dark:text-slate-100 shadow-xs"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          } active:scale-95`}
        >
          <CalendarDays size={15} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate("/my-activity")}
        className="flex h-9 w-9 items-center justify-center rounded-xl sm:h-auto sm:w-auto sm:rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 sm:px-3 sm:py-1.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition shadow-sm whitespace-nowrap active:scale-95"
        title="My Activity"
      >
        <User size={15} className="sm:hidden" />
        <span className="hidden sm:inline">My activity →</span>
      </button>
    </div>
  );
};

export default ActivityLogsHeader;
