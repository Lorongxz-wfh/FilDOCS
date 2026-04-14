import React, { useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import PageFrame from "../../components/layout/PageFrame";
import {
  BookOpen,
  Layout,
  Zap,
  Settings,
  ChevronDown,
  MessageSquare,
  Search,
  X,
  ExternalLink
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import KnowledgeBaseSidebar from "../../components/support/KnowledgeBaseSidebar";

// ── Types ─────────────────────────────────────────────────────────────────────
type Article = {
  title: string;
  content: React.ReactNode;
};

type TopicData = {
  title: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  articles: Article[];
};

// ── Content ───────────────────────────────────────────────────────────────────
const TOPICS: Record<string, TopicData> = {
  "getting-started": {
    title: "Getting Started",
    description: "Foundations of navigation, authentication, and setting up your professional identity.",
    icon: BookOpen,
    iconBg: "bg-slate-100 dark:bg-surface-400",
    iconColor: "text-slate-900 dark:text-slate-100",
    articles: [
      {
        title: "Chapter 1.1 — System Overview",
        content: (
          <div className="space-y-4">
            <p>FilDOCS is a centralized document workflow and management system designed for institutional compliance and ISO-standard document control. It replaces manual paper trails with a rigorous, electronic serial lifecycle.</p>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-surface-400 border border-slate-100 dark:border-surface-300">
               <p className="text-xs font-bold uppercase text-brand-600 mb-2">Key Value Pillars</p>
            <ul className="list-disc list-inside space-y-2 text-[13px]">
                 <li><span className="font-bold">Accountability:</span> Every action is logged with a timestamp and IP address.</li>
                 <li><span className="font-bold">Standardization:</span> All documents follow the same 5 phases without exception.</li>
                 <li><span className="font-bold">Security:</span> Mandatory 2FA for all administrative and workflow actions.</li>
               </ul>
            </div>
          </div>
        )
      },
      {
        title: "Chapter 1.2 — Login and Authentication",
        content: (
          <div className="space-y-4">
            <p>Accessing your workspace requires valid institutional credentials. Your account is usually created by a System Administrator.</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                <p className="text-xs leading-relaxed">Enter your registered email and password at the <Link to="/login" className="text-brand-500 font-bold hover:underline inline-flex items-center gap-1">Login Page <ExternalLink className="h-3 w-3" /></Link>.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                <p className="text-xs leading-relaxed">If you forget your password, use the 'Forgot Password' link to receive a reset code via email.</p>
              </div>
            </div>
          </div>
        )
      },
      {
        title: "Chapter 1.3 — Two-Factor Authentication",
        content: (
          <div className="space-y-4">
            <p>Security is paramount. 2FA is mandatory for all users participating in workflows.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-brand-100 bg-brand-50/20 dark:bg-brand-500/5">
                <p className="text-xs font-bold text-brand-600 mb-2 uppercase">Initial Setup</p>
                <p className="text-xs leading-relaxed mb-4">Navigate to your <Link to="/profile" className="text-brand-500 font-bold hover:underline">Profile Settings</Link> and click 'Enable 2FA'. You will need a TOTP app like Google Authenticator.</p>
                    <Link to="/profile" className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 dark:bg-brand-500 text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-colors">Go to Settings</Link>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 dark:bg-surface-400">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-100 mb-2 uppercase">Recovery Codes</p>
                <p className="text-xs leading-relaxed">Always save your recovery codes during setup. These are the only way to access your account if you lose your phone.</p>
              </div>
            </div>
          </div>
        )
      },
      {
        title: "Chapter 1.4 — Profile and Account Settings",
        content: (
          <div className="space-y-4">
            <p>Your profile is your digital identity in FilDOCS. It must be accurate to ensure document validity.</p>
            <ul className="space-y-3 text-[13px]">
              <li className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors">
                 <div className="h-2 w-2 rounded-full bg-brand-500" />
                 <p><span className="font-bold">E-Signature:</span> Mandatory for Approvers. Upload a clean PNG at <Link to="/profile" className="text-brand-500 underline">Settings</Link>.</p>
              </li>
              <li className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors">
                 <div className="h-2 w-2 rounded-full bg-brand-500" />
                 <p><span className="font-bold">Notification Prefs:</span> Toggle Email vs In-App alerts for document updates.</p>
              </li>
              <li className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors">
                 <div className="h-2 w-2 rounded-full bg-brand-500" />
                 <p><span className="font-bold">Theme:</span> Switch between Light, Dark, or System mode.</p>
              </li>
            </ul>
          </div>
        )
      },
      {
        title: "Chapter 1.5 — Navigation and Dashboard",
        content: (
          <div className="space-y-4">
            <p>The <Link to="/dashboard" className="text-brand-500 font-bold hover:underline">Dashboard</Link> is your command center.</p>
            <div className="grid grid-cols-2 gap-3">
               {[
                 { t: "Pending Tasks", v: "Actions currently waiting for your office." },
                 { t: "Volume Trends", v: "Monthly document creation volume." },
                 { t: "Recent Activity", v: "Last 5 actions across your department." },
                 { t: "Stage Delay", v: "Phase identifying bottlenecks." }
               ].map((item, i) => (
                 <div key={i} className="p-3 rounded-xl border border-slate-100 dark:border-surface-400 bg-white dark:bg-surface-500">
                    <p className="text-[10px] font-black uppercase text-brand-500 mb-1">{item.t}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{item.v}</p>
                 </div>
               ))}
            </div>
          </div>
        )
      }
    ]
  },
  "document-workflow": {
    title: "Document Workflow",
    description: "Deep dive into the 5-phase serial lifecycle and the mechanics of document movement.",
    icon: Zap,
    iconBg: "bg-slate-100 dark:bg-surface-400",
    iconColor: "text-slate-900 dark:text-slate-100",
    articles: [
      {
        title: "Chapter 2.1 — How the Workflow Works",
        content: (
          <div className="space-y-4">
            <p>FilDOCS uses a **Strict Serial Workflow**. This means data flows in one direction and phases cannot be skipped.</p>
            <div className="flex flex-col gap-2 relative">
               {[
                 { n: "Draft", c: "Creator" },
                 { n: "Review", c: "Technical Head" },
                 { n: "Approval", c: "Executives" },
                 { n: "Finalization", c: "Document Controller" },
                 { n: "Completed", c: "Shared to Library" }
               ].map((s, i) => (
                 <div key={i} className="flex items-center gap-4 group">
                    <div className="relative flex flex-col items-center">
                       <div className="h-8 w-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs z-10">{i+1}</div>
                       {i < 4 && <div className="h-10 w-0.5 bg-slate-200 dark:bg-surface-300 -mb-2" />}
                    </div>
                    <div className="flex-1 p-3 rounded-xl border border-slate-100 dark:border-surface-400 bg-slate-50/50">
                       <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{s.n}</p>
                       <p className="text-[10px] text-slate-500">Actor: {s.c}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )
      },
      {
        title: "Chapter 2.2 — Draft Phase",
        content: (
          <div className="space-y-4">
            <p>Every document starts at <Link to="/documents/create" className="text-brand-500 font-bold underline">Create Document</Link>.</p>
            <ul className="space-y-2 text-[13px]">
               <li><span className="font-bold">v0 Versioning:</span> All new drafts are named v0. They remain private until forwarded.</li>
               <li><span className="font-bold">Metadata:</span> You must provide a Title, Description, and Category.</li>
               <li><span className="font-bold">Routing:</span> Choose Default (System) or Custom (Select specific offices).</li>
            </ul>
            <Link to="/documents/create" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all">Start a Draft</Link>
          </div>
        )
      },
      {
        title: "Chapter 2.3 — Review Phase",
        content: (
          <div className="space-y-3">
             <p>The Review phase is for technical validation. The reviewer ensures the content is accurate and formatted correctly.</p>
             <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-950/30">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-2 uppercase">Reviewer Actions</p>
                <div className="grid grid-cols-2 gap-4 text-[11px]">
                   <p><span className="font-bold">Forward:</span> Moves it to Approval.</p>
                   <p><span className="font-bold">Return:</span> Sends back to Creator for fixes.</p>
                </div>
             </div>
          </div>
        )
      },
      {
        title: "Chapter 2.4 — Approval Phase",
        content: (
          <div className="space-y-4">
             <p>A formal 'Approved' status requires an electronic signature. This is applied by Department Heads, VPs, or the President.</p>
             <div className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-slate-200 dark:border-surface-400">
                <div className="h-10 w-10 shrink-0 bg-brand-500 rounded flex items-center justify-center text-white font-black">SIG</div>
                <p className="text-xs leading-relaxed text-slate-500 uppercase tracking-tight font-medium">To approve, click the 'In-App Signature' button in the Workflow Task bar. If not set up, you must manually sign and upload.</p>
             </div>
          </div>
        )
      },
      {
        title: "Chapter 2.5 — Finalization Phase",
        content: (
          <div className="space-y-3 text-[13px]">
             <p>Once approved globally, the document returns to the Creator (or QA) for finalization:</p>
             <ol className="list-decimal list-inside space-y-2">
                <li><span className="font-bold uppercase tracking-wider text-brand-600">Register:</span> Assign a unique Document ID based on your office code.</li>
                <li><span className="font-bold uppercase tracking-wider text-brand-600">Distribute:</span> Share the document with the Library. Only after this step is it visible to others.</li>
             </ol>
          </div>
        )
      },
      {
        title: "Chapter 2.6 — Completed and Revision",
        content: (
          <div className="space-y-4 text-[13px]">
             <p>A 'Completed' document cannot be edited. To update it, you must initiate a **Revision Cycle**.</p>
             <div className="bg-slate-900 rounded-xl p-4 text-white">
                <p className="text-brand-400 font-bold uppercase mb-2">Revision Process</p>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed opacity-90">
                   <li>Locate the document in the <Link to="/documents" className="text-brand-300 underline">Library</Link>.</li>
                   <li>Click the 'Revise' button.</li>
                   <li>System generates a **v1 Draft** (inheriting all v0 metadata).</li>
                   <li>The new draft must complete Phases 1-4 again.</li>
                </ol>
             </div>
          </div>
        )
      }
    ]
  },
  "documents-and-requests": {
    title: "Documents and Requests",
    description: "Accessing the permanent record of institutional documentation and managing the archive.",
    icon: Layout,
    iconBg: "bg-slate-100 dark:bg-surface-400",
    iconColor: "text-slate-900 dark:text-slate-100",
    articles: [
      {
        title: "Chapter 3.1 — Document Library",
        content: (
          <div className="space-y-4">
            <p>The <Link to="/documents" className="text-brand-500 font-bold underline">Document Library</Link> contains all distributed and active records.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
               {[
                 { t: "Created", d: "Docs started by your office." },
                 { t: "Shared", d: "Docs you participated in." },
                 { t: "Requested", d: "Docs your office requested." },
                 { t: "All Docs", d: "Global institution view." }
               ].map((tab, i) => (
                 <div key={i} className="p-3 rounded-lg border border-slate-100 dark:border-surface-400 bg-white">
                    <p className="text-[10px] font-black uppercase text-brand-500 mb-1">{tab.t}</p>
                    <p className="text-[10px] text-slate-500 leading-tight">{tab.d}</p>
                 </div>
               ))}
            </div>
          </div>
        )
      },
      {
        title: "Chapter 3.2 — Archive",
        content: (
          <div className="space-y-3">
             <p>The <Link to="/archive" className="text-brand-500 font-bold underline">Archive</Link> stores soft-deleted documents and outdated versions. These remain searchable and can be restored by Sysadmins if necessary.</p>
             <p className="text-xs bg-red-50 dark:bg-red-950/20 p-2 border border-red-100 text-red-700 dark:text-red-400 font-medium">Items in the Archive are read-only and cannot be modified until restored to the Library.</p>
          </div>
        )
      },
      {
        title: "Chapter 3.3 — Templates",
        content: (
          <div className="space-y-3 text-[13px]">
             <p>Standardized forms are available in the <Link to="/templates" className="text-brand-500 font-bold underline">Templates Hub</Link>.</p>
             <ul className="list-disc list-inside space-y-2">
                <li><span className="font-bold">QA Provided:</span> All official templates are uploaded by Document Controllers.</li>
                <li><span className="font-bold">Auto-Fill:</span> Some templates will automatically pull your office data when used to create a draft.</li>
             </ul>
          </div>
        )
      },
      {
        title: "Chapter 3.4 — Document Requests",
        content: (
          <div className="space-y-3 text-[13px]">
             <p>If you need a physical copy or access to a restricted document, use <Link to="/document-requests" className="text-brand-500 font-bold underline">Document Requests</Link>.</p>
             <ol className="list-decimal list-inside space-y-1">
                <li>Create a Request specifying the document and reason.</li>
                <li>Owner office reviews the request.</li>
                <li>Once approved, you receive a 'Shared' copy in the Library.</li>
             </ol>
          </div>
        )
      }
    ]
  },
  "reports-logs-notifications": {
    title: "Reports and Logs",
    description: "System monitoring, activity auditing, and staying updated with institutional changes.",
    icon: Settings,
    iconBg: "bg-slate-100 dark:bg-surface-400",
    iconColor: "text-slate-900 dark:text-slate-100",
    articles: [
      {
        title: "Chapter 4.1 — Reports and Analytics",
        content: (
          <div className="space-y-3 text-[13px]">
             <p>Visit the <Link to="/reports" className="text-brand-500 font-bold underline">Reports</Link> page to view department-level audits:</p>
             <ul className="list-disc list-inside space-y-2">
                <li><span className="font-bold">Approval Audit:</span> Lists signatures with timestamps and IP addresses of approvers.</li>
                <li><span className="font-bold">Compliance Rate:</span> Percent of docs that completed within target timeframes.</li>
                <li><span className="font-bold">Export:</span> All reports can be downloaded as CSV for external meetings.</li>
             </ul>
          </div>
        )
      },
      {
        title: "Chapter 4.2 — Activity Logs",
        content: (
          <div className="space-y-3 text-[13px]">
             <p>Every major change is tracked in <Link to="/activity-logs" className="text-brand-500 font-bold underline">Activity Logs</Link>.</p>
             <div className="p-3 bg-brand-50 dark:bg-brand-500/5 rounded-xl border border-brand-100">
                <p className="font-bold text-brand-600 mb-1">What is logged?</p>
                <p className="leading-relaxed opacity-80">Document creation, Phase changes, File replacements, Signature applications, and Permission changes.</p>
             </div>
          </div>
        )
      },
      {
        title: "Chapter 4.3 — Notifications",
        content: (
          <div className="space-y-3">
             <p>FilDOCS notifies you via the Bell icon and Email whenever a document requires your action.</p>
             <div className="flex gap-4 p-4 rounded-xl bg-slate-100 dark:bg-surface-400 border border-slate-200">
                <div className="text-2xl">🔔</div>
                <p className="text-xs text-slate-500">Unread notifications appear in your <Link to="/inbox" className="underline">Notification Inbox</Link>. Clicking an alert takes you directly to the document.</p>
             </div>
          </div>
        )
      },
      {
        title: "Chapter 4.4 — Announcements",
        content: (
          <p className="text-xs">System-wide notices (Maintenance windows, Policy updates) are posted in <Link to="/announcements" className="text-brand-500 font-bold underline">Announcements</Link>. These are shared with all users and usually pinned to the top of the dashboard feed.</p>
        )
      },
      {
        title: "Chapter 4.5 — Support and Help",
        content: (
          <div className="space-y-4">
             <p className="text-xs">This manual is the primary resource for technical training. If you identify a bug or need access assistance, use the support button below:</p>
             <Link to="/report-issue" className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white text-[11px] font-bold rounded-lg hover:shadow-lg transition-all">Open Support Ticket</Link>
          </div>
        )
      }
    ]
  }
};

// ── Accordion item ────────────────────────────────────────────────────────────
function AccordionItem({
  title,
  content,
  defaultOpen = false,
  highlight = false,
}: {
  title: string;
  content: React.ReactNode;
  defaultOpen?: boolean;
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`border-b border-slate-100 dark:border-surface-400 last:border-0 transition-colors ${highlight ? "bg-brand-50/30 dark:bg-brand-500/5" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50 dark:hover:bg-surface-400"
      >
        <span className={`text-sm font-bold transition-colors ${open ? "text-brand-600 dark:text-brand-400" : "text-slate-800 dark:text-slate-100"}`}>
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180 text-brand-500" : ""
          }`}
        />
      </button>

      {open && (
        <div className="px-6 pb-6 text-sm sm:text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
          {content}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HelpTopicPage() {
  const { topic } = useParams<{ topic: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const data = topic ? TOPICS[topic] : undefined;

  const filteredArticles = useMemo(() => {
    if (!data) return [];
    if (!searchQuery.trim()) return data.articles;
    
    const query = searchQuery.toLowerCase();
    return data.articles.filter(article => 
      article.title.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  if (!data) {
    return (
      <PageFrame
        title="Topic not found"
        onBack={() => navigate("/help")}
        breadcrumbs={[{ label: "User Manual", to: "/help" }]}
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This help topic does not exist.{" "}
          <button
            type="button"
            onClick={() => navigate("/help")}
            className="text-brand-500 hover:underline"
          >
            Return to Help & Support
          </button>
        </p>
      </PageFrame>
    );
  }

  const Icon = data.icon;

  return (
    <PageFrame
      title={data.title}
      breadcrumbs={[{ label: "User Manual", to: "/help" }]}
      onBack={() => navigate("/help")}
      contentClassName="max-w-7xl mx-auto"
    >
      <div className="flex gap-10">
        {/* Sidebar */}
        <KnowledgeBaseSidebar />

        {/* Content Area */}
        <div className="flex-1 min-w-0 pb-20">
          {/* Header & Search */}
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-xl">
               <div className="flex items-center gap-3 mb-2">
                 <div className={`p-2 rounded-lg ${data.iconBg}`}>
                   <Icon className={`h-5 w-5 ${data.iconColor}`} />
                 </div>
                 <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                   {data.title}
                 </h1>
               </div>
               <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                 {data.description}
               </p>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chapters..."
                className="w-full pl-9 pr-9 py-2.5 text-xs bg-white dark:bg-surface-500 border border-slate-200 dark:border-surface-400 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Articles */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-sm">
            {filteredArticles.length > 0 ? (
              filteredArticles.map((article, i) => (
                <AccordionItem
                  key={article.title}
                  title={article.title}
                  content={article.content}
                  defaultOpen={i === 0 || searchQuery.length > 0}
                  highlight={searchQuery.length > 0}
                />
              ))
            ) : (
                <div className="p-20 text-center">
                   <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 dark:bg-surface-400 mb-4">
                      <Search className="h-6 w-6 text-slate-300" />
                   </div>
                   <p className="text-sm font-bold text-slate-900 dark:text-slate-100">No matching articles</p>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try adjusting your search query.</p>
                </div>
            )}
          </div>

          {/* Nav Footer */}
          <div className="mt-12 p-8 rounded-2xl border border-dashed border-slate-200 dark:border-surface-400 flex flex-col items-center text-center">
             <MessageSquare className="h-8 w-8 text-slate-300 mb-4" />
             <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Still Stuck?</p>
             <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
                If the manual doesn't have the answer, our technical support team is available for direct assistance.
             </p>
             <button
               type="button"
               onClick={() => navigate("/report-issue")}
               className="mt-6 px-6 py-2.5 bg-slate-900 dark:bg-brand-500 text-white text-[11px] font-bold rounded-lg hover:shadow-lg transition-all"
             >
               Contact Support
             </button>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
