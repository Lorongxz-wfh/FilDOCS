import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { getSystemHealth } from "../../services/systemHealthApi";
import echo from "../../lib/echo";

export default function MaintenanceBanner() {
  const [schedule, setSchedule] = useState<{ startsAt: Date; message: string; mode: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  const fetchStatus = async () => {
    const token = localStorage.getItem("auth_token");
    const isLoginPage = window.location.pathname === "/login";

    if (!token || isLoginPage) {
      setSchedule(null);
      return;
    }

    try {
      const data = await getSystemHealth();
      if (data.maintenance.starts_at) {
        setSchedule({
          startsAt: new Date(data.maintenance.starts_at),
          message: data.maintenance.message || "Scheduled maintenance",
          mode: data.maintenance.mode
        });
      } else {
        setSchedule(null);
      }
    } catch (error) {
      // Silently fail for background status check
    }
  };

  useEffect(() => {
    fetchStatus();

    // Listen for Real-time events
    const channel = echo.channel("system-status");
    
    channel.listen(".maintenance.scheduled", (e: any) => {
      setSchedule({
        startsAt: new Date(e.startsAt),
        message: e.message || "Scheduled maintenance",
        mode: "hard" // Default to hard for safety in banner
      });
    });

    channel.listen(".maintenance.cancelled", () => {
      setSchedule(null);
      setTimeLeft("");
    });

    // Fallback polling (every 60s)
    const interval = setInterval(fetchStatus, 60000);

    return () => {
      channel.stopListening(".maintenance.scheduled");
      channel.stopListening(".maintenance.cancelled");
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!schedule) return;

    const timer = setInterval(() => {
      const now = new Date();
      const diff = schedule.startsAt.getTime() - now.getTime();

      if (diff <= 0) {
        setSchedule(null);
        setTimeLeft("");
        // The API interceptor will handle the actual logout on the next request
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [schedule]);

  if (!schedule || !timeLeft) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top-full duration-500">
      <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-white/20 p-1.5 rounded-md shrink-0">
            <Clock size={16} className="animate-pulse" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 overflow-hidden">
            <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
              Scheduled Maintenance
            </span>
            <span className="text-xs opacity-90 truncate max-w-md">
              {schedule.message}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 bg-black/10 px-3 py-1 rounded-full border border-white/20">
            <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Starts in</span>
            <span className="text-sm font-mono font-bold">{timeLeft}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
