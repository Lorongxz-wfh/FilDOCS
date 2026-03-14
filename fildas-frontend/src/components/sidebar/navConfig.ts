import {
  LayoutDashboard,
  ClipboardList,
  FolderOpen,
  Inbox,
  FileText,
  BarChart3,
  ScrollText,
  Users,
  Building2,
  Settings,
  FilePlus,
  FileInput,
  LayoutTemplate,
  UserPlus,
  Building,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const settingsNavItem: NavItem = {
  to: "/settings",
  label: "Settings",
  icon: Settings,
};

export const inboxNavItem: NavItem = {
  to: "/inbox",
  label: "Inbox",
  icon: Inbox,
};

export type NewAction = {
  label: string;
  to: string;
  icon: LucideIcon;
  roles?: string[];
  state?: Record<string, unknown>;
};

export const newActions: NewAction[] = [
  {
    label: "New Document",
    to: "/documents/create",
    icon: FilePlus,
    state: { fromLibrary: true },
  },
  {
    label: "New Request",
    to: "/document-requests",
    icon: FileInput,
    state: { openModal: true },
  },
  {
    label: "New Template",
    to: "/templates",
    icon: LayoutTemplate,
    state: { openModal: true },
  },
  {
    label: "New User",
    to: "/user-manager",
    icon: UserPlus,
    roles: ["ADMIN", "SYSADMIN"],
    state: { openModal: true },
  },
  {
    label: "New Office",
    to: "/office-manager",
    icon: Building,
    roles: ["ADMIN", "SYSADMIN"],
    state: { openModal: true },
  },
];

export const navGroups: NavGroup[] = [
  {
    label: "General",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/work-queue", label: "Work Queue", icon: ClipboardList },
      { to: "/documents", label: "Library", icon: FolderOpen },
      {
        to: "/document-requests",
        label: "Requests",
        icon: Inbox,
        roles: [
          "OFFICE_STAFF",
          "OFFICE_HEAD",
          "VPAA",
          "VPAD",
          "VPF",
          "VPR",
          "PRESIDENT",
          "ADMIN",
          "QA",
          "SYSADMIN",
        ],
      },
      { to: "/templates", label: "Templates", icon: FileText },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        to: "/reports",
        label: "Reports",
        icon: BarChart3,
        roles: [
          "QA",
          "SYSADMIN",
          "ADMIN",
          "PRESIDENT",
          "VPAA",
          "VPAD",
          "VPF",
          "VPR",
        ],
      },
      {
        to: "/activity-logs",
        label: "Activity Logs",
        icon: ScrollText,
        roles: ["QA", "SYSADMIN", "ADMIN"],
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        to: "/user-manager",
        label: "User Manager",
        icon: Users,
        roles: ["SYSADMIN", "ADMIN"],
      },
      {
        to: "/office-manager",
        label: "Office Manager",
        icon: Building2,
        roles: ["SYSADMIN", "ADMIN"],
      },
    ],
  },
];
