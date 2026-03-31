import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import {
  BookOpen,
  Layout,
  Zap,
  Settings,
  ChevronRight,
  MessageSquare,
  ShieldCheck,
  User,
} from "lucide-react";
import { getUserRole, isQA } from "../lib/roleFilters";

export type HelpPerspective = "QA" | "OFFICE";

export const HELP_CATEGORIES = [
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "Understand the basics and set up your workspace efficiently.",
    icon: BookOpen,
    iconBg: "bg-sky-100 dark:bg-sky-950/30",
    iconColor: "text-sky-600 dark:text-sky-400",
    qaArticles: [
      "QA Role Overview",
      "System Documentation ownership",
      "Registration & Distribution basics",
    ],
    officeArticles: [
      "Office Role Overview",
      "Creating your first document",
      "Responding to tasks",
    ],
  },
  {
    slug: "pages-explanation",
    title: "Pages & Navigation",
    description: "A complete tour of the sidebar and what each module does.",
    icon: Layout,
    iconBg: "bg-emerald-100 dark:bg-emerald-950/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    qaArticles: [
      "Dashboard: System Metrics",
      "Work Queue: Managing all flows",
      "Library: Global document access",
    ],
    officeArticles: [
      "Dashboard: Office Metrics",
      "Work Queue: Your pending tasks",
      "Library: Office-specific records",
    ],
  },
  {
    slug: "main-uses",
    title: "Main Uses & Flow",
    description: "Deep dive into the 5-phase workflow and document requests.",
    icon: Zap,
    iconBg: "bg-amber-100 dark:bg-amber-950/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    qaArticles: [
      "QA-start workflow deep dive",
      "Handling registration tasks",
      "Managing custom routing",
    ],
    officeArticles: [
      "Office-start workflow deep dive",
      "Handling review/approval tasks",
      "Responding to document requests",
    ],
  },
  {
    slug: "account",
    title: "Account & Settings",
    description: "Manage your profile, security, and notification preferences.",
    icon: Settings,
    iconBg: "bg-violet-100 dark:bg-violet-950/30",
    iconColor: "text-violet-600 dark:text-violet-400",
    qaArticles: [
      "Updating QA Profile",
      "Notification preferences",
      "Security & Passwords",
    ],
    officeArticles: [
      "Updating Office Profile",
      "Notification preferences",
      "Security & Passwords",
    ],
  },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const userRole = getUserRole();
  const [perspective, setPerspective] = useState<HelpPerspective>(
    isQA(userRole) ? "QA" : "OFFICE"
  );

  return (
    <PageFrame title="Help & Support" contentClassName="max-w-4xl mx-auto">
      {/* Perspective Toggle */}
      <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-slate-50 dark:bg-surface-600 p-1.5 border border-slate-200 dark:border-surface-400">
        <div className="flex w-full sm:w-auto p-1">
          <button
            type="button"
            onClick={() => setPerspective("QA")}
            className={`flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-xs font-semibold transition-all ${
              perspective === "QA"
                ? "bg-white dark:bg-surface-400 text-brand-600 dark:text-brand-400 shadow-sm ring-1 ring-slate-200 dark:ring-surface-300"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            QA Perspective
          </button>
          <button
            type="button"
            onClick={() => setPerspective("OFFICE")}
            className={`flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-xs font-semibold transition-all ${
              perspective === "OFFICE"
                ? "bg-white dark:bg-surface-400 text-brand-600 dark:text-brand-400 shadow-sm ring-1 ring-slate-200 dark:ring-surface-300"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <User className="h-4 w-4" />
            Office Perspective
          </button>
        </div>
        <div className="px-4 py-2 sm:py-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Viewing as <span className="text-brand-500">{perspective} Staff</span>
          </p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          How can we help?
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Explore documentation tailored for the{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {perspective === "QA" ? "Quality Assurance" : "Office Staff"}
          </span>{" "}
          workflow.
        </p>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {HELP_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const articles =
            perspective === "QA" ? cat.qaArticles : cat.officeArticles;
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => navigate(`/help/${cat.slug}?v=${perspective}`)}
              className="group text-left rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-6 hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${cat.iconBg}`}
                >
                  <Icon className={`h-6 w-6 ${cat.iconColor}`} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {cat.title}
                    </p>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-500" />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {cat.description}
                  </p>

                  <ul className="mt-4 space-y-2">
                    {articles.map((article) => (
                      <li
                        key={article}
                        className="flex items-center gap-2.5 text-[11px] font-medium text-slate-600 dark:text-slate-400"
                      >
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400/50" />
                        {article}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-surface-400 shadow-sm">
            <MessageSquare className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Still have questions?
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Our support team is ready to help you with any issues.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/report-issue")}
          className="w-full sm:w-auto rounded-xl bg-slate-900 dark:bg-brand-500 px-6 py-3 text-xs font-bold text-white transition hover:bg-slate-800 dark:hover:bg-brand-600 shadow-lg shadow-slate-200 dark:shadow-none"
        >
          Contact Support
        </button>
      </div>
    </PageFrame>
  );
}
