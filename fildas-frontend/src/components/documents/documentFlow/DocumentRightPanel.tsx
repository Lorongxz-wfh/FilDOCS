import React from "react";
import { ChevronRight } from "lucide-react";
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
  activeSideTab: "comments" | "logs";
  setActiveSideTab: (v: "comments" | "logs") => void;
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
  const [infoExpanded, setInfoExpanded] = React.useState(true);
  const [commentsExpanded, setCommentsExpanded] = React.useState(true);
  const isDataReady = !!document && !!version;

  return (
    <div className="flex flex-col h-full">
      {/* ── Doc Info Accordion ── */}
      <div className={`flex flex-col min-h-0 border-b border-slate-200 dark:border-surface-400 transition-all ${infoExpanded && !commentsExpanded ? "flex-1" : "shrink-0"}`}>
        <button
          type="button"
          onClick={() => {
            const isMobile = window.innerWidth < 768;
            setInfoExpanded(!infoExpanded);
            if (isMobile && !infoExpanded) setCommentsExpanded(false);
          }}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-surface-400/40 transition"
        >
          <ChevronRight
            className={`h-3 w-3 shrink-0 text-slate-400 transition-transform duration-150 ${infoExpanded ? "rotate-90" : "rotate-0"}`}
          />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
            Document Info
          </span>
          {isDataReady && document && (
            <div
              className="flex items-center gap-1 ml-1"
              onClick={(e) => e.stopPropagation()}
            >
              {document.doctype && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                    document.doctype === "internal"
                      ? "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border border-sky-100 dark:border-sky-800"
                      : document.doctype === "external"
                        ? "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-100 dark:border-orange-800"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900"
                  }`}
                >
                  {document.doctype}
                </span>
              )}
              {(document as any).visibility_scope && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                    (document as any).visibility_scope === "global"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300"
                  }`}
                >
                  {(document as any).visibility_scope}
                </span>
              )}
            </div>
          )}
        </button>

        {infoExpanded && (
          <div className="flex-1 px-2.5 pb-3 overflow-y-auto">
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
              <DocumentInfoPanel
                document={document}
                version={version}
                offices={offices}
                routeSteps={routeSteps}
                tasks={tasks}
                isEditable={isEditable}
                onTitleSaved={onTitleSaved}
                onChanged={onChanged}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Comments / Activity Accordion ── */}
      <div className={`flex flex-col min-h-0 transition-all ${commentsExpanded ? "flex-1" : "shrink-0"}`}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            const isMobile = window.innerWidth < 768;
            setCommentsExpanded(!commentsExpanded);
            if (isMobile && !commentsExpanded) setInfoExpanded(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && setCommentsExpanded((v) => !v)}
          className="shrink-0 w-full flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-surface-400 hover:bg-slate-50 dark:hover:bg-surface-400/40 transition cursor-pointer"
        >
          <ChevronRight
            className={`h-3 w-3 shrink-0 text-slate-400 transition-transform duration-150 ${commentsExpanded ? "rotate-90" : "rotate-0"}`}
          />
          <div
            className="flex items-center gap-0"
            onClick={(e) => e.stopPropagation()}
          >
            {(["comments", "logs"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSideTab(tab);
                  if (tab === "comments") clearNewMessageCount();
                  if (!commentsExpanded) setCommentsExpanded(true);
                }}
                className={[
                  "px-2.5 py-0.5 text-xs font-medium rounded transition",
                  activeSideTab === tab
                    ? "text-slate-900 dark:text-slate-100 font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                ].join(" ")}
              >
                {tab === "comments" ? "Comments" : "Activity"}
                {tab === "comments" && newMessageCount > 0 && (
                  <span className="ml-1 rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white animate-pulse">
                    +{newMessageCount}
                  </span>
                )}
                {tab === "comments" &&
                  newMessageCount === 0 &&
                  messages.length > 0 && (
                    <span className="ml-1 rounded-full bg-slate-200 dark:bg-surface-300 px-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                      {messages.length}
                    </span>
                  )}
              </button>
            ))}
          </div>
        </div>

        {commentsExpanded && (
          <div className="flex flex-1 min-h-[250px] md:min-h-0 px-2.5 py-2">
            {activeSideTab === "comments" ? (
              <DocumentCommentsPanel
                isLoading={isLoadingMessages || !isDataReady}
                messages={messages}
                draftMessage={draftMessage}
                setDraftMessage={setDraftMessage}
                isSending={isSendingMessage}
                onSend={onSendMessage}
                formatWhen={formatWhen}
                skeletonCount={infoExpanded ? 2 : 5}
                optimisticMessages={optimisticMessages}
                setOptimisticMessages={setOptimisticMessages}
              />
            ) : (
              <DocumentActivityPanel
                isLoading={isLoadingActivityLogs || !isDataReady}
                logs={activityLogs}
                formatWhen={formatWhen}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentRightPanel;
