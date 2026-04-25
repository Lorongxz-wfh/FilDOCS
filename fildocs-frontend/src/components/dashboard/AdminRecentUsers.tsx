import React from "react";
import Skeleton from "../ui/loader/Skeleton";
import RoleBadge from "../ui/RoleBadge";
import { useNavigate } from "react-router-dom";
import { UserPlus, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="relative h-[240px] overflow-hidden flex flex-col">
      <div className={`flex-1 overflow-y-auto custom-scrollbar transition-opacity duration-200 ${loading ? "opacity-60" : "opacity-100"}`}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-2 py-2">
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))
          : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 dark:bg-surface-400/20 border border-slate-100 dark:border-surface-400">
                  <UserPlus className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  No users yet
                </p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 max-w-[180px]">
                  New registrations will appear here in real-time.
                </p>
              </div>
            ) : (
              <motion.div 
                className="space-y-0.5 p-1"
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.04 } }
                }}
              >
                {users.slice(0, 8).map((u) => (
                  <motion.button
                    key={u.id}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0 }
                    }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    type="button"
                    onClick={() => navigate("/user-manager")}
                    className="w-full flex items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors group text-left"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-surface-600 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-surface-400 group-hover:bg-white dark:group-hover:bg-surface-300 transition-colors">
                      {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-bold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {u.name}
                      </p>
                      <p className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-tighter">
                        {u.office_name ?? "Independent"}
                      </p>
                    </div>
                    <RoleBadge 
                      role={u.role} 
                      className="shrink-0 scale-90 origin-right"
                      dot
                    />
                    <div
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${u.is_active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-slate-300 dark:bg-surface-400"}`}
                      title={u.is_active ? "Online" : "Offline"}
                    />
                  </motion.button>
                ))}
              </motion.div>
            )}
      </div>

      {/* Footer link */}
      {!loading && users.length > 0 && (
        <div className="shrink-0 flex justify-center py-3 border-t border-slate-100 dark:border-surface-400/50 bg-white dark:bg-surface-500">
          <button
            type="button"
            onClick={() => navigate("/user-manager")}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md border border-slate-200 dark:border-surface-400 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 hover:border-slate-300 dark:hover:border-surface-300 transition-all uppercase tracking-widest active:scale-95"
          >
            <Users className="h-3.5 w-3.5" />
            Manage all users
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminRecentUsers;
