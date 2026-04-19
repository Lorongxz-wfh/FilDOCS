import React from "react";
import { List, CalendarDays, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageActions, ExportSplitAction } from "../ui/PageActions";

interface Props {
  tab: "log" | "calendar";
  setTab: (tab: "log" | "calendar") => void;
  onExport: (format: "csv" | "pdf") => void;
  exporting: boolean;
  disabled?: boolean;
}

const ActivityLogsHeader: React.FC<Props> = ({
  tab,
  setTab,
  onExport,
  exporting,
  disabled = false,
}) => {
  const navigate = useNavigate();

  return (
    <PageActions>
      {tab === "log" && (
        <ExportSplitAction
          onExport={onExport}
          loading={exporting}
          disabled={disabled}
        />
      )}

      <div className="flex bg-white dark:bg-surface-500 border border-slate-200 dark:border-surface-400 rounded-sm p-0.5  overflow-hidden shrink-0">
        <button
          type="button"
          onClick={() => setTab("log")}
          className={`p-1.5 rounded-sm transition-colors ${
            tab === "log"
              ? "bg-slate-100 dark:bg-surface-400 text-slate-900 dark:text-slate-100"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          <List size={14} />
        </button>
        <button
          type="button"
          onClick={() => setTab("calendar")}
          className={`p-1.5 rounded-sm transition-colors ${
            tab === "calendar"
              ? "bg-slate-100 dark:bg-surface-400 text-slate-900 dark:text-slate-100"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          <CalendarDays size={14} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate("/my-activity")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-400 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-300 transition-colors"
      >
        <User className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">My activity</span>
      </button>
    </PageActions>
  );
};

export default ActivityLogsHeader;
