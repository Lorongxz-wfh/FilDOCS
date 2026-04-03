import React from "react";
import { List, CalendarDays, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageActions, RefreshAction, ExportSplitAction } from "../ui/PageActions";
import Button from "../ui/Button";

interface Props {
  tab: "log" | "calendar";
  setTab: (tab: "log" | "calendar") => void;
  onRefresh: () => Promise<void | boolean>;
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
    <PageActions>
      {tab === "log" && (
        <ExportSplitAction
          onExport={onExport}
          loading={exporting}
          disabled={disabled}
        />
      )}

      <RefreshAction
        onRefresh={onRefresh}
        loading={refreshing || exporting}
      />

      <div className="flex bg-white dark:bg-surface-500 border border-slate-200 dark:border-surface-400 rounded-sm p-0.5 shadow-sm overflow-hidden shrink-0">
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

      <Button
        variant="outline"
        size="sm"
        responsive
        onClick={() => navigate("/my-activity")}
        className="font-bold border-slate-200 dark:border-surface-400"
      >
        <User className="h-3.5 w-3.5" />
        <span>My activity</span>
      </Button>
    </PageActions>
  );
};

export default ActivityLogsHeader;
