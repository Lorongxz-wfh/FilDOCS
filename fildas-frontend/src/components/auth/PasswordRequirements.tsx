import React from "react";
import { Check, X } from "lucide-react";

interface Requirement {
  label: string;
  met: boolean;
}

interface PasswordRequirementsProps {
  password: string;
  className?: string;
}

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password, className = "" }) => {
  const requirements: Requirement[] = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "At least one uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { label: "At least one lowercase letter (a-z)", met: /[a-z]/.test(password) },
    { label: "At least one number (0-9)", met: /[0-9]/.test(password) },
    { label: "At least one special character (@$!%*#?&_)", met: /[@$!%*#?&_]/.test(password) },
  ];

  return (
    <div className={`space-y-2 p-3 rounded-md bg-slate-50 dark:bg-surface-600 border border-slate-100 dark:border-surface-400 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Password Requirements</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {requirements.map((req, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className={`shrink-0 h-4 w-4 rounded-full flex items-center justify-center ${req.met ? "bg-emerald-500" : "bg-slate-200 dark:bg-surface-400"}`}>
              {req.met ? (
                <Check className="h-2.5 w-2.5 text-white stroke-[3px]" />
              ) : (
                <X className="h-2.5 w-2.5 text-slate-400 dark:text-slate-200 stroke-[3px]" />
              )}
            </div>
            <span className={`text-[11px] leading-tight ${req.met ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-500 dark:text-slate-400"}`}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const validatePassword = (password: string): boolean => {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[@$!%*#?&_]/.test(password)
  );
};
