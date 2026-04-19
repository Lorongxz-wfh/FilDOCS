import { useEffect, useState } from "react";
import logoUrl from "../assets/FCU Logo.png";

type Phase = "hidden" | "enter" | "visible" | "exit";

export default function SplashScreen() {
  const [phase, setPhase] = useState<Phase>("hidden");

  useEffect(() => {
    let exitTimer: ReturnType<typeof setTimeout>;
    let hiddenTimer: ReturnType<typeof setTimeout>;

    const handler = () => {
      clearTimeout(exitTimer);
      clearTimeout(hiddenTimer);
      setPhase("enter");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase("visible"));
      });
      // Standard animation flow
      exitTimer = setTimeout(() => setPhase("exit"), 1300);
      hiddenTimer = setTimeout(() => setPhase("hidden"), 1700);

      // EMERGENCY FAIL-SAFE: Force hide after 5 seconds if timers above somehow stall
      setTimeout(() => setPhase("hidden"), 5000);
    };

    const hideHandler = () => {
      clearTimeout(exitTimer);
      clearTimeout(hiddenTimer);
      setPhase("hidden");
    };

    window.addEventListener("show_splash", handler);
    window.addEventListener("hide_splash", hideHandler);
    return () => {
      window.removeEventListener("show_splash", handler);
      window.removeEventListener("hide_splash", hideHandler);
      clearTimeout(exitTimer);
      clearTimeout(hiddenTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  const opacity =
    phase === "enter" ? "opacity-0" :
    phase === "exit"  ? "opacity-0" :
    "opacity-100";

  return (
    <div
      className={`fixed inset-0 z-9999 flex items-center justify-center bg-white dark:bg-slate-900 transition-opacity duration-300 ${opacity}`}
    >
      {/* Subtle top accent line */}
      <div className="absolute top-0 inset-x-0 h-0.5 bg-linear-to-r from-transparent via-sky-500/60 to-transparent" />

      <div className="flex flex-col items-center gap-5">
        {/* Logo */}
        <div className="h-18 w-18 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ">
          <img
            src={logoUrl}
            alt="FilDOCS logo"
            className="h-full w-full object-contain p-1.5"
          />
        </div>

        {/* Title block */}
        <div className="text-center space-y-1">
          <p className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            FilDOCS
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            FCU · Quality Assurance
          </p>
        </div>

        {/* Spinner + label */}
        <div className="flex flex-col items-center gap-2.5 mt-1">
          <div className="h-4.5 w-4.5 rounded-full border-2 border-slate-200 dark:border-slate-800 border-t-sky-500 dark:border-t-sky-300 animate-spin" />
          <p className="text-[11px] text-slate-400 dark:text-slate-400 tracking-wide">
            Signing you in…
          </p>
        </div>
      </div>
    </div>
  );
}
