import React from "react";
import type {
  Document,
  DocumentVersion,
  Office,
  DocumentRouteStep,
  WorkflowTask,
  OfficeUser,
} from "../../../services/documents";
import { getOfficeUsers } from "../../../services/documents";

type Props = {
  document: Document;
  version: DocumentVersion;
  offices: Office[];
  routeSteps?: DocumentRouteStep[];
  tasks?: WorkflowTask[];
};

type ParticipantRow = {
  role: string;
  label: string;
  sublabel?: string;
  status: WorkflowTask["status"] | "owner" | "pending";
  officeId: number | null;
};

const statusDot: Record<string, string> = {
  owner: "bg-sky-400",
  open: "bg-amber-400 animate-pulse",
  completed: "bg-emerald-500",
  returned: "bg-rose-400",
  rejected: "bg-rose-600",
  cancelled: "bg-slate-400",
  pending: "bg-slate-300 dark:bg-surface-300",
};

const WorkflowParticipantsTab: React.FC<Props> = ({
  document,
  offices,
  routeSteps = [],
  tasks = [],
}) => {
  const [officeUsers, setOfficeUsers] = React.useState<
    Record<number, OfficeUser[]>
  >({});
  const [loadingOffices, setLoadingOffices] = React.useState<Set<number>>(
    new Set(),
  );
  const fetchedOfficeIds = React.useRef<Set<number>>(new Set());

  const fetchOfficeUsers = React.useCallback(async (officeId: number) => {
    if (fetchedOfficeIds.current.has(officeId)) return;
    fetchedOfficeIds.current.add(officeId);
    setLoadingOffices((prev) => new Set(prev).add(officeId));
    try {
      const users = await getOfficeUsers(officeId);
      setOfficeUsers((prev) => ({ ...prev, [officeId]: users }));
    } catch {
      setOfficeUsers((prev) => ({ ...prev, [officeId]: [] }));
    } finally {
      setLoadingOffices((prev) => {
        const next = new Set(prev);
        next.delete(officeId);
        return next;
      });
    }
  }, []);

  // Build participants list
  const ownerOffice = document.ownerOffice ?? (document as any).office ?? null;
  const participantRows: ParticipantRow[] = [];
  const seenOfficeIds = new Set<number>();

  const taskByOffice = new Map<number, WorkflowTask>();
  tasks.forEach((t) => {
    if (t.assigned_office_id != null && !taskByOffice.has(t.assigned_office_id)) {
      taskByOffice.set(t.assigned_office_id, t);
    }
  });

  if (ownerOffice) {
    seenOfficeIds.add(ownerOffice.id);
    participantRows.push({
      role: "Creator",
      label: ownerOffice.name,
      sublabel: ownerOffice.code,
      status: "owner",
      officeId: ownerOffice.id,
    });
  }

  if (routeSteps.length > 0) {
    const sorted = [...routeSteps].sort((a, b) => a.step_order - b.step_order);
    sorted.forEach((step) => {
      const offId = step.office_id;
      if (!offId || seenOfficeIds.has(offId)) return;
      seenOfficeIds.add(offId);
      const off = offices.find((o) => o.id === offId);
      const roleLabel =
        step.phase === "review" ? "Review" :
        step.phase === "approval" ? "Approval" :
        step.phase === "registration" ? "Registration" :
        step.phase;
      const task = taskByOffice.get(offId);
      participantRows.push({
        role: roleLabel,
        label: off ? off.name : `Office #${offId}`,
        sublabel: off?.code,
        status: task ? task.status : "pending",
        officeId: offId,
      });
    });
  } else {
    tasks.forEach((task) => {
      const offId = task.assigned_office_id ?? null;
      if (offId && !seenOfficeIds.has(offId)) {
        seenOfficeIds.add(offId);
        const off = offices.find((o) => o.id === offId);
        const roleLabel =
          task.phase === "review" ? "Review" :
          task.phase === "approval" ? "Approval" :
          task.phase === "registration" ? "Registration" :
          (task.step ?? task.phase);
        participantRows.push({
          role: roleLabel,
          label: off ? off.name : `Office #${offId}`,
          sublabel: off?.code,
          status: task.status,
          officeId: offId,
        });
      }
    });
  }

  // Pre-fetch all offices on mount
  React.useEffect(() => {
    const officeIds = participantRows
      .map((p) => p.officeId)
      .filter((id): id is number => id != null);
    officeIds.forEach(fetchOfficeUsers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-1.5">
      {participantRows.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 px-1">
          No participants yet.
        </p>
      ) : (
        participantRows.map((p, i) => {
          const offId = p.officeId;
          const isLoading = offId != null && loadingOffices.has(offId);
          const users: OfficeUser[] =
            offId != null ? (officeUsers[offId] ?? []) : [];

          return (
            <div
              key={i}
              className="rounded-md border border-slate-100 dark:border-surface-400 bg-slate-50 dark:bg-surface-600/50 overflow-hidden"
            >
              <div className="w-full flex items-center gap-2.5 px-3 py-2 text-left border-b border-white/50 dark:border-surface-400/30">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${statusDot[p.status] ?? "bg-slate-300"}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {p.label}
                    {p.sublabel && (
                      <span className="ml-1 text-[10px] font-normal text-slate-400 dark:text-slate-500 uppercase tracking-tight">
                        ({p.sublabel})
                      </span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 rounded bg-slate-200 dark:bg-surface-400 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                  {p.role}
                </span>
              </div>

              <div className="px-3 py-2 space-y-2">
                {isLoading ? (
                  <div className="space-y-1.5 animate-pulse">
                    {[1, 2].map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-slate-200 dark:bg-surface-400 shrink-0" />
                        <div className="h-2 rounded bg-slate-200 dark:bg-surface-400 w-24" />
                      </div>
                    ))}
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-[10px] italic text-slate-400 dark:text-slate-500">
                    No active users in this office.
                  </p>
                ) : (
                  users.map((u) => {
                    const lastActive = (u as any).last_active_at ? new Date((u as any).last_active_at).getTime() : 0;
                    const isOnline = Date.now() - lastActive < 30 * 60 * 1000;
                    
                    return (
                      <div key={u.id} className="flex items-center gap-2 py-0.5">
                        <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.4)]' : 'bg-slate-300 dark:bg-surface-400'}`} />
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                            {u.full_name}
                          </p>
                          {u.role?.label && (
                            <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                              {u.role.label}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default WorkflowParticipantsTab;
