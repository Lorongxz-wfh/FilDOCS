import React, { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import {
  BookOpen,
  Layout,
  Zap,
  Settings,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Article = {
  title: string;
  content: React.ReactNode;
  role?: "QA" | "OFFICE";
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
    description: "Understand the basics of FilDAS and set up your workspace.",
    icon: BookOpen,
    iconBg: "bg-sky-100 dark:bg-sky-950/30",
    iconColor: "text-sky-600 dark:text-sky-400",
    articles: [
      {
        title: "What is FilDAS?",
        content: (
          <div className="space-y-3">
            <p>
              FilDAS (File & Document Archive System) is a comprehensive workflow engine designed to manage official documents from creation through formal distribution.
            </p>
            <p>Every document follows a structured five-stage process:</p>
            <ol className="ml-1 list-inside list-decimal space-y-1.5 font-medium text-slate-700 dark:text-slate-300">
              <li>Draft</li>
              <li>Review</li>
              <li>Approval</li>
              <li>Finalization</li>
              <li>Completed</li>
            </ol>
            <p>
              Depending on your role, you will interact with documents at different stages.
            </p>
          </div>
        ),
      },
      {
        title: "QA Role Overview",
        role: "QA",
        content: (
          <div className="space-y-3">
            <p>
              As a **Quality Assurance** user, you are the document controller. Your primary responsibilities include:
            </p>
            <ul className="ml-1 list-inside list-disc space-y-1.5">
              <li>Creating system-wide official documents (QA-start).</li>
              <li>Managing the full workflow from draft to completion.</li>
              <li>Performing "Registration" to assign official tracking numbers.</li>
              <li>Handling final "Distribution" to the library.</li>
            </ul>
          </div>
        ),
      },
      {
        title: "Office Staff Overview",
        role: "OFFICE",
        content: (
          <div className="space-y-3">
            <p>
              As an **Office Staff** or **Office Head**, you manage documents originating from your department. Your responsibilities include:
            </p>
            <ul className="ml-1 list-inside list-disc space-y-1.5">
              <li>Drafting office-specific documents (Office-start).</li>
              <li>Reviewing and approving content within your cluster.</li>
              <li>Ensuring your office's records are registered via the workflow.</li>
              <li>Responding to document requests from QA or other departments.</li>
            </ul>
          </div>
        ),
      },
    ],
  },

  "pages-explanation": {
    title: "Pages & Navigation",
    description: "A tour of the FilDAS workspace and its modules.",
    icon: Layout,
    iconBg: "bg-emerald-100 dark:bg-emerald-950/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    articles: [
      {
        title: "Dashboard",
        content: (
          <div className="space-y-3">
            <p>Your central command center. It provides real-time insights based on your role:</p>
            <ul className="ml-1 space-y-2">
              <li className="flex gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">QA:</span> High-level volume trends, approval rates, and stage delay metrics.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Office:</span> Direct links to pending tasks, recent office activity, and assigned work.
              </li>
            </ul>
          </div>
        ),
      },
      {
        title: "My Work Queue",
        content: (
          <div className="space-y-3">
            <p>
              The **Work Queue** is where all active tasks live. If a document requires your action (Review, Approval, or Check), it will appear here.
            </p>
            <p className="bg-slate-50 dark:bg-surface-400 p-3 rounded-lg border-l-4 border-brand-500 italic">
              "Check your Work Queue daily to ensure documents keep moving through the chain."
            </p>
          </div>
        ),
      },
      {
        title: "Document Library",
        content: (
          <div className="space-y-3">
            <p>
              Once a document is **Completed**, it is stored in the Library. This is the organizational source of truth.
            </p>
            <ul className="ml-1 list-inside list-disc space-y-1.5">
              <li>Search by title, number, or office.</li>
              <li>Filter by document type (ISO, Policies, etc.).</li>
              <li>Access revision history and past versions.</li>
            </ul>
          </div>
        ),
      },
      {
        title: "Inbox (Requests)",
        content: (
          <div className="space-y-3">
            <p>The Inbox handles **Document Requests**. These are formal requests from high-level roles (QA or Admin) asking your office to provide documents or information.</p>
          </div>
        ),
      },
    ],
  },

  "main-uses": {
    title: "Main Uses & Flow",
    description: "Deep dive into document creation and the 5-phase workflow.",
    icon: Zap,
    iconBg: "bg-amber-100 dark:bg-amber-950/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    articles: [
      {
        title: "Creating a Document (QA vs Office)",
        content: (
          <div className="space-y-4">
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">QA-Start Mode</p>
              <p className="text-xs">Used when QA initiates a system-wide document. QA owns the registration and distribution steps.</p>
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Office-Start Mode</p>
              <p className="text-xs">Used when an Office initiates their own document. The Office Head reviews it first before it moves to the VP/President chain.</p>
            </div>
          </div>
        ),
      },
      {
        title: "The 5-Phase Flow (Deep Dive)",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-1 text-[10px] text-center font-bold">
              <div className="p-1 bg-slate-100 dark:bg-surface-400 rounded">DRAFT</div>
              <div className="p-1 bg-sky-100 dark:bg-sky-900/30 rounded">REVIEW</div>
              <div className="p-1 bg-indigo-100 dark:bg-indigo-900/30 rounded">APPROVE</div>
              <div className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded">FINALIZE</div>
              <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded">COMPLETE</div>
            </div>
            <p>1. **Draft**: Creator prepares content and selects routing.</p>
            <p>2. **Review**: Recipients check content for accuracy. Creator double-checks at the end.</p>
            <p>3. **Approval**: Formal sign-off from Office Head, VP, or President.</p>
            <p>4. **Finalization**: Registration (assigning number) and Distribution.</p>
            <p>5. **Completed**: Available for viewing/download in the Library.</p>
          </div>
        ),
      },
      {
        title: "Default vs Custom Routing",
        content: (
          <div className="space-y-3">
            <p>**Default Routing** uses the standard hierarchy (Office → VP → President). Recommended for standard official documents.</p>
            <p>**Custom Routing** allows the creator to pick 1-5 specific offices. Useful for cross-departmental documents.</p>
          </div>
        ),
      },
    ],
  },

  account: {
    title: "Account & Settings",
    description: "Manage your profile, security, and preferences.",
    icon: Settings,
    iconBg: "bg-violet-100 dark:bg-violet-950/30",
    iconColor: "text-violet-600 dark:text-violet-400",
    articles: [
      {
        title: "Profile Management",
        content: (
          <div className="space-y-3">
            <p>Update your first name, last name, and display name in **Settings → Profile**. Email and role changes must be handled by an Admin.</p>
          </div>
        ),
      },
      {
        title: "Notifications",
        content: (
          <div className="space-y-3">
            <p>Toggle Email and Sound notifications to stay updated on your Work Queue tasks.</p>
          </div>
        ),
      },
      {
        title: "Passwords & Security",
        content: (
          <div className="space-y-3">
            <p>Change your password regularly. If locked out, use the "Forgot Password" link on the login page.</p>
          </div>
        ),
      },
    ],
  },
};

// ── Accordion item ────────────────────────────────────────────────────────────
function AccordionItem({
  title,
  content,
  defaultOpen = false,
}: {
  title: string;
  content: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-100 dark:border-surface-400 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-surface-400"
      >
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {content}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HelpTopicPage() {
  const { topic } = useParams<{ topic: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const perspective = (searchParams.get("v") as "QA" | "OFFICE") || "OFFICE";
  const data = topic ? TOPICS[topic] : undefined;

  if (!data) {
    return (
      <PageFrame
        title="Topic not found"
        onBack={() => navigate("/help")}
        breadcrumbs={[{ label: "Help & Support", to: "/help" }]}
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

  const filteredArticles = data.articles.filter(
    (a) => !a.role || a.role === perspective
  );
  const Icon = data.icon;

  return (
    <PageFrame
      title={data.title}
      breadcrumbs={[{ label: "Help & Support", to: "/help" }]}
      onBack={() => navigate("/help")}
      contentClassName="max-w-3xl mx-auto"
    >
      {/* Section header */}
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-500 px-5 py-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${data.iconBg}`}
        >
          <Icon className={`h-5 w-5 ${data.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            {data.description}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              Viewing:
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-500">
              {perspective} Perspective
            </span>
          </div>
        </div>
      </div>

      {/* Articles */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500">
        {filteredArticles.map((article, i) => (
          <AccordionItem
            key={article.title}
            title={article.title}
            content={article.content}
            defaultOpen={i === 0}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-6 py-5">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Still have questions?
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Can't find what you're looking for? Let us know and we'll help.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/report-issue")}
          className="shrink-0 rounded-md bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600"
        >
          Contact Support
        </button>
      </div>
    </PageFrame>
  );
}
