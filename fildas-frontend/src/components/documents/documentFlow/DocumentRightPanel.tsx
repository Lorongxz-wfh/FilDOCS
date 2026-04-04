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
import { Tabs, TabContent } from "../../ui/Tabs";

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

  const TABS = React.useMemo(() => [
    { key: "details", label: "Details", icon: <FileText className="h-3 w-3 shrink-0 opacity-70" /> },
    { 
      key: "comments", 
      label: "Comments", 
      icon: <MessageSquare className="h-3 w-3 shrink-0 opacity-70" />, 
      badge: newMessageCount > 0 ? (
        <span className="ml-0.5 inline-flex items-center justify-center rounded bg-sky-100 dark:bg-sky-950/40 px-1 py-0.5 text-[8px] font-bold text-sky-700 dark:text-sky-400">
          {newMessageCount}
        </span>
      ) : null 
    },
    { key: "participants", label: "Participants", icon: <Users className="h-3 w-3 shrink-0 opacity-70" /> },
    { key: "logs", label: "Activity", icon: <ActivityIcon className="h-3 w-3 shrink-0 opacity-70" /> },
  ], [newMessageCount]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Unified Tab Header ── */}
      <Tabs 
        tabs={TABS} 
        activeTab={activeSideTab} 
        onChange={(key) => {
          setActiveSideTab(key as any);
          if (key === "comments") clearNewMessageCount();
        }} 
        id="document-flow-right" 
        fullWidth={true}
        className="px-0.5 border-b border-slate-200 dark:border-surface-400 bg-slate-50/30 dark:bg-surface-600/20"
      />

      {/* ── Tab Content ── */}
      <div className="flex-1 min-h-0 flex flex-col p-2.5 overflow-y-auto hide-scrollbar">
        {!isDataReady ? (
          <div className="space-y-1.5">
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
            <TabContent activeKey={activeSideTab} currentKey="details">
              <DocumentInfoPanel
                document={document}
                version={version}
                offices={offices}
                routeSteps={routeSteps}
                tasks={tasks}
                isEditable={isEditable}
                onTitleSaved={onTitleSaved}
                onChanged={onChanged}
                activeTab="details"
              />
            </TabContent>

            <TabContent activeKey={activeSideTab} currentKey="participants">
              <DocumentInfoPanel
                document={document}
                version={version}
                offices={offices}
                routeSteps={routeSteps}
                tasks={tasks}
                isEditable={isEditable}
                onTitleSaved={onTitleSaved}
                onChanged={onChanged}
                activeTab="participants"
              />
            </TabContent>

            <TabContent activeKey={activeSideTab} currentKey="comments">
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
            </TabContent>

            <TabContent activeKey={activeSideTab} currentKey="logs">
              <DocumentActivityPanel
                loading={isLoadingActivityLogs}
                logs={activityLogs}
              />
            </TabContent>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentRightPanel;
