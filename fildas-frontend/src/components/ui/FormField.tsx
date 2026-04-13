import React, { useState, useId } from "react";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "id">;

interface FormFieldProps extends InputProps {
  label?: string;
  hint?: string;
  error?: string;
  /** Lucide icon component to show on the left */
  icon?: React.ElementType;
  /** If true, shows password toggle button */
  isPassword?: boolean;
  /** Show success state (green border + check) */
  isValid?: boolean;
  /** Required asterisk next to label */
  isRequired?: boolean;
  containerClassName?: string;
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  (
    {
      label,
      hint,
      error,
      icon: Icon,
      isPassword = false,
      isValid = false,
      isRequired = false,
      containerClassName,
      className,
      type,
      disabled,
      ...props
    },
    ref,
  ) => {
    const id = useId();
    const [showPassword, setShowPassword] = useState(false);

    const hasError = !!error;
    const resolvedType = isPassword
      ? showPassword
        ? "text"
        : "password"
      : type;

    const borderCls = hasError
      ? "border-rose-400 dark:border-rose-600 focus:border-rose-500 focus:ring-rose-500/20"
      : isValid
        ? "border-emerald-400 dark:border-emerald-600 focus:border-emerald-500 focus:ring-emerald-500/20"
        : "border-slate-200 dark:border-surface-400 focus:border-brand-400 dark:focus:border-brand-300 focus:ring-brand-500/20";

    const inputBase = [
      "w-full rounded-md border bg-white dark:bg-surface-600",
      "text-sm text-slate-900 dark:text-slate-100",
      "placeholder-slate-400 dark:placeholder-slate-500",
      "outline-none focus:ring-2 transition-all",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      borderCls,
      Icon ? "pl-9" : "pl-3",
      isPassword || hasError || isValid ? "pr-9" : "pr-3",
      "py-2.5",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={containerClassName}>
        {label && (
          <label
            htmlFor={id}
            className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
          >
            {label}
            {isRequired && <span className="ml-0.5 text-rose-500">*</span>}
          </label>
        )}

        <div className="relative">
          {/* Left icon */}
          {Icon && (
            <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          )}

          <input
            ref={ref}
            id={id}
            type={resolvedType}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${id}-error` : hint ? `${id}-hint` : undefined
            }
            className={inputBase}
            {...props}
          />

          {/* Right slot — password toggle, error icon, or valid icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {isPassword ? (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            ) : hasError ? (
              <AlertCircle className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400 pointer-events-none" />
            ) : isValid ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 pointer-events-none" />
            ) : null}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p
            id={`${id}-error`}
            className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400"
          >
            {error}
          </p>
        )}

        {/* Hint text — only shown when no error */}
        {hint && !error && (
          <p
            id={`${id}-hint`}
            className="mt-1.5 text-xs font-medium text-slate-400 dark:text-slate-500"
          >
            {hint}
          </p>
        )}
      </div>
    );
  },
);

FormField.displayName = "FormField";

export default FormField;
