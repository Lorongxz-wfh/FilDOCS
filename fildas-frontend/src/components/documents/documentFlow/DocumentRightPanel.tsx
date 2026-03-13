import React from "react";
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
  isEditable?: boolean;
  onTitleSaved?: (newTitle: string) => void;
};

// PanelHeightButton removed — info section now scrolls independently

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
  isEditable = false,
  onTitleSaved,
}) => {
  const [infoExpanded, setInfoExpanded] = React.useState(true);
  const [commentsExpanded, setCommentsExpanded] = React.useState(true);
  const isDataReady = !!document && !!version;

  return (
    <div className="flex flex-col h-full">
      {/* ── Doc Info Accordion ── */}
      <div className="shrink-0 border-b border-slate-200 dark:border-surface-400">
        <button
          type="button"
          onClick={() => setInfoExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-surface-400/40 transition"
        >
          <svg
            className={`h-3 w-3 shrink-0 text-slate-400 transition-transform duration-150 ${infoExpanded ? "rotate-90" : "rotate-0"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M7.5 4.5 13 10l-5.5 5.5-1.4-1.4L10.2 10 6.1 5.9 7.5 4.5z" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Document Info
          </span>
          {isDataReady && document && (
            <div
              className="flex items-center gap-1 ml-1"
              onClick={(e) => e.stopPropagation()}
            >
              {document.doctype && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                    document.doctype === "internal"
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                      : document.doctype === "external"
                        ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                  }`}
                >
                  {document.doctype}
                </span>
              )}
              {(document as any).visibility_scope && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
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
          {isEditable && isDataReady && (
            <span className="ml-auto text-[10px] font-medium text-sky-500 dark:text-sky-400 shrink-0">
              Draft
            </span>
          )}
        </button>

        {infoExpanded && (
          <div className="px-2.5 pb-3">
            {!isDataReady ? (
              /* Skeleton info rows */
              <div className="space-y-1.5">
                {[148, 100, 130, 90, 120, 110].map((w, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-surface-400 bg-slate-50 dark:bg-surface-600/50 px-3 py-2"
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
              />
            )}
          </div>
        )}
      </div>

      {/* ── Comments / Activity Accordion ── */}
      <div className="flex flex-col flex-1 min-h-0">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setCommentsExpanded((v) => !v)}
          onKeyDown={(e) => e.key === "Enter" && setCommentsExpanded((v) => !v)}
          className="shrink-0 w-full flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-surface-400 hover:bg-slate-50 dark:hover:bg-surface-400/40 transition cursor-pointer"
        >
          <svg
            className={`h-3 w-3 shrink-0 text-slate-400 transition-transform duration-150 ${commentsExpanded ? "rotate-90" : "rotate-0"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M7.5 4.5 13 10l-5.5 5.5-1.4-1.4L10.2 10 6.1 5.9 7.5 4.5z" />
          </svg>
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
                  "px-2.5 py-0.5 text-[11px] font-medium rounded transition",
                  activeSideTab === tab
                    ? "text-sky-600 dark:text-sky-400 font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                ].join(" ")}
              >
                {tab === "comments" ? "Comments" : "Activity"}
                {tab === "comments" && newMessageCount > 0 && (
                  <span className="ml-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white animate-pulse">
                    +{newMessageCount}
                  </span>
                )}
                {tab === "comments" &&
                  newMessageCount === 0 &&
                  messages.length > 0 && (
                    <span className="ml-1 rounded-full bg-sky-100 dark:bg-sky-900/40 px-1.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
                      {messages.length}
                    </span>
                  )}
              </button>
            ))}
          </div>
        </div>

        {commentsExpanded && (
          <div className="flex flex-1 min-h-0 px-2.5 py-2">
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
