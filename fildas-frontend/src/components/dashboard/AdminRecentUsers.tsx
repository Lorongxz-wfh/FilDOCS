import Skeleton from "../ui/loader/Skeleton";
import RoleBadge from "../ui/RoleBadge";
import { useNavigate } from "react-router-dom";
import { UserPlus, Users } from "lucide-react";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  office_name: string | null;
  is_active: boolean;
  created_at: string;
};



const AdminRecentUsers: React.FC<{ users: User[]; loading: boolean }> = ({
  users,
  loading,
}) => {
  const navigate = useNavigate();

  return (
    <div className="relative h-[240px] overflow-hidden">
      <div className={`divide-y divide-slate-100 dark:divide-surface-400 transition-opacity duration-200 ${loading ? "opacity-60" : "opacity-100"}`}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-2 py-2">
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))
          : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 dark:bg-surface-400/20">
                  <UserPlus className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No users yet
                </p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  New users will show up here.
                </p>
              </div>
            ) : (
              users.slice(0, 5).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-50 dark:hover:bg-surface-600 transition-colors"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-surface-400 text-xs font-bold text-slate-600 dark:text-slate-300">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                      {u.name}
                    </p>
                    <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                      {u.office_name ?? "No office"}
                    </p>
                  </div>
                  <RoleBadge 
                    role={u.role} 
                    className="shrink-0"
                    dot
                  />
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${u.is_active ? "bg-emerald-400" : "bg-slate-300"}`}
                  />
                </div>
              ))
            )}
      </div>

      {/* Fading overlay + Minimal Button */}
      {!loading && (
        <div className={`inset-x-0 bottom-0 flex items-center justify-center ${users.length > 0 ? "absolute h-24 bg-gradient-to-t from-white dark:from-surface-500 via-white/80 dark:via-surface-500/80 to-transparent pointer-events-none" : "py-2"}`}>
          <div className={`${users.length > 0 ? "pb-4 pointer-events-auto" : "mt-2"}`}>
            <button
              type="button"
              onClick={() => navigate("/user-manager")}
              className="flex items-center gap-1.5 px-3 py-1 border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-400 rounded-sm text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] shadow-xs hover:bg-slate-50 dark:hover:bg-surface-300 transition-all active:scale-95"
            >
              <Users className="h-2.5 w-2.5" />
              Manage users
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRecentUsers;
