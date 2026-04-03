import React from "react";
import { FileText, MessageSquare, Users, Activity as ActivityIcon } from "lucide-react";
import type {
  Document,
  DocumentVersion,
  DocumentMessage,
  ActivityLogItem,
  Office,
  DocumentRouteStep,
  WorkflowTask,
} from "../../../services/documents";
import DocumentInfoPanel from "./DocumentInfoPanel";
import DocumentCommentsPanel from "./DocumentCommentsPanel";
import DocumentActivityPanel from "./DocumentActivityPanel";

type Props = {
  document: Document | null;
  version: DocumentVersion | null;
  offices: Office[];
  routeSteps?: DocumentRouteStep[];
  tasks?: WorkflowTask[];
  newMessageCount: number;
  clearNewMessageCount: () => void;
  activeSideTab: "details" | "comments" | "participants" | "logs";
  setActiveSideTab: (v: "details" | "comments" | "participants" | "logs") => void;
  isLoadingActivityLogs: boolean;
  activityLogs: ActivityLogItem[];
  isLoadingMessages: boolean;
  messages: DocumentMessage[];
  draftMessage: string;
  setDraftMessage: (v: string) => void;
  isSendingMessage: boolean;
  onSendMessage: () => Promise<void>;
  formatWhen: (iso: string) => string;
  optimisticMessages: {
    tempId: string;
    text: string;
    sending: boolean;
    failed: boolean;
  }[];
  setOptimisticMessages: React.Dispatch<
    React.SetStateAction<
      { tempId: string; text: string; sending: boolean; failed: boolean }[]
    >
  >;
  isEditable?: boolean;
  onTitleSaved?: (newTitle: string) => void;
  onChanged?: () => void;
};

const DocumentRightPanel: React.FC<Props> = ({
  document,
  version,
  offices,
  routeSteps = [],
  tasks = [],
  newMessageCount,
  clearNewMessageCount,
  activeSideTab,
  setActiveSideTab,
  isLoadingActivityLogs,
  activityLogs,
  isLoadingMessages,
  messages,
  draftMessage,
  setDraftMessage,
  isSendingMessage,
  onSendMessage,
  formatWhen,
  optimisticMessages,
  setOptimisticMessages,
  isEditable = false,
  onTitleSaved,
  onChanged,
}) => {
  const isDataReady = !!document && !!version;

  const tabs: {
    id: Props["activeSideTab"];
    label: string;
    icon: React.ElementType;
    badge?: number;
  }[] = [
    { id: "details", label: "Details", icon: FileText },
    { id: "comments", label: "Comments", icon: MessageSquare, badge: newMessageCount },
    { id: "participants", label: "Participants", icon: Users },
    { id: "logs", label: "Activity", icon: ActivityIcon },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Unified Tab Header ── */}
      <div className="flex items-center px-1.5 border-b border-slate-200 dark:border-surface-400 bg-slate-50/30 dark:bg-surface-600/20 shrink-0">
        <div className="flex items-center overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeSideTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveSideTab(tab.id);
                  if (tab.id === "comments") clearNewMessageCount();
                }}
                className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold border-b-1 transition-colors whitespace-nowrap ${
                  active
                    ? "border-sky-600 text-slate-900 dark:text-slate-50"
                    : "border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
                }`}
              >
                <Icon className="h-3 w-3 shrink-0 opacity-70" />
                <span>{tab.label}</span>
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center rounded bg-sky-100 dark:bg-sky-950/40 px-1 py-0.5 text-[8px] font-bold text-sky-700 dark:text-sky-400">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 min-h-0 flex flex-col p-2.5">
        {!isDataReady ? (
          <div className="space-y-1.5 overflow-y-auto">
            {[148, 100, 130, 90, 120, 110].map((w, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border border-slate-100 dark:border-surface-400 bg-slate-50 dark:bg-surface-600/50 px-3 py-2"
              >
                <div className="h-2.5 w-14 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                <div
                  className="h-2.5 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse"
                  style={{ width: w / 2 }}
                />
              </div>
            ))}
          </div>
        ) : (
          <>
            {(activeSideTab === "details" || activeSideTab === "participants") && (
              <DocumentInfoPanel
                document={document}
                version={version}
                offices={offices}
                routeSteps={routeSteps}
                tasks={tasks}
                isEditable={isEditable}
                onTitleSaved={onTitleSaved}
                onChanged={onChanged}
                activeTab={activeSideTab as "details" | "participants"}
              />
            )}

            {activeSideTab === "comments" && (
              <DocumentCommentsPanel
                isLoading={isLoadingMessages}
                messages={messages}
                draftMessage={draftMessage}
                setDraftMessage={setDraftMessage}
                isSending={isSendingMessage}
                onSend={onSendMessage}
                formatWhen={formatWhen}
                skeletonCount={5}
                optimisticMessages={optimisticMessages}
                setOptimisticMessages={setOptimisticMessages}
              />
            )}

            {activeSideTab === "logs" && (
              <DocumentActivityPanel
                loading={isLoadingActivityLogs}
                logs={activityLogs}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentRightPanel;
