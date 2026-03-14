import { useEffect, useState } from "react";
import logoUrl from "../assets/FCU Logo.png";

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      setVisible(true);
      setTimeout(() => setVisible(false), 2000);
    };
    window.addEventListener("show_splash", handler);
    return () => window.removeEventListener("show_splash", handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-linear-to-br from-sky-500 to-blue-700">
      <div className="flex flex-col items-center gap-5">
        <div className="h-20 w-20 overflow-hidden rounded-2xl border border-white/30 bg-white/20 backdrop-blur-sm shadow-xl">
          <img
            src={logoUrl}
            alt="FilDAS"
            className="h-full w-full object-contain p-1.5"
          />
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white tracking-tight">FilDAS</p>
          <p className="text-sm text-blue-100 mt-0.5">
            FCU • Quality Assurance
          </p>
        </div>
        <div className="mt-2 h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      </div>
    </div>
  );
}
