import React, { useEffect, useMemo, useState } from "react";
import {
  listActivityLogs,
  type ActivityLogItem,
} from "../../services/documents";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { formatTime, formatCalendarDate } from "../../utils/formatters";
import {
  categorizeEvent,
  CATEGORY_COLORS,
  heatColor,
} from "../../utils/eventCategories";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}


function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Day detail panel ──────────────────────────────────────────────────────────

const DayPanel: React.FC<{
  date: string;
  logs: ActivityLogItem[];
  onClose: () => void;
}> = ({ date, logs, onClose }) => (
  <div
    className="flex flex-col w-full bg-white dark:bg-surface-500"
    style={{ height: "100%", minHeight: 0 }}
  >
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-surface-400 shrink-0">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {formatCalendarDate(date)}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {logs.length} event{logs.length !== 1 ? "s" : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg leading-none px-1"
      >
        ×
      </button>
    </div>
    <div className="overflow-y-auto" style={{ flex: "1 1 0", minHeight: 0 }}>
      {logs.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          No activity this day.
        </p>
      ) : (
        <div className="relative px-4 py-4">
          {/* Timeline line */}
          <div className="absolute left-[1.85rem] top-4 bottom-4 w-px bg-slate-200 dark:bg-surface-400" />
          <div className="flex flex-col gap-4">
            {logs.map((log) => {
              const cat = categorizeEvent(log.event);
              const colors = CATEGORY_COLORS[cat];
              return (
                <div key={log.id} className="flex gap-3 relative">
                  <div
                    className={`w-3 h-3 rounded-full mt-1 shrink-0 z-10 ring-2 ring-white dark:ring-surface-500 ${colors.dot}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
                      >
                        {log.event.replace(".", " ")}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                        <Clock size={9} />
                        {formatTime(log.created_at)}
                      </span>
                    </div>
                    {log.label && (
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                        {log.label}
                      </p>
                    )}
                    {(log as any).actor_user?.name && (
                      <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                        by {(log as any).actor_user.name}
                        {(log as any).actor_office?.code
                          ? ` · ${(log as any).actor_office.code}`
                          : ""}
                      </p>
                    )}
                    {(log as any).document?.title && (
                      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        📄 {(log as any).document.title}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  </div>
);

// ── Year heatmap ──────────────────────────────────────────────────────────────

const YearHeatmap: React.FC<{
  year: number;
  byDay: Map<string, ActivityLogItem[]>;
  onDayClick: (date: string) => void;
  selectedDate: string | null;
}> = ({ year, byDay, onDayClick, selectedDate }) => {
  const max = useMemo(
    () => Math.max(0, ...Array.from(byDay.values()).map((v) => v.length)),
    [byDay],
  );

  // Build 52-week grid starting from Jan 1
  const startDate = new Date(year, 0, 1);
  const startDay = startDate.getDay(); // 0=Sun

  // Pad to start on Sunday
  const cells: (string | null)[] = Array(startDay).fill(null);
  const end = new Date(year, 11, 31);
  for (let d = new Date(startDate); d <= end; d.setDate(d.getDate() + 1)) {
    cells.push(toDateKey(d.toISOString()));
  }
  // Pad to complete last week
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const cellSize = 14; // px per cell
  const gap = 3;

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex w-full">
        {/* Day labels */}
        <div className="flex flex-col shrink-0 mr-2" style={{ gap }}>
          {DAYS.map((d, i) => (
            <div
              key={d}
              style={{ height: cellSize, width: 28 }}
              className="flex items-center"
            >
              {i % 2 === 1 && (
                <span className="text-[10px] text-slate-400">{d}</span>
              )}
            </div>
          ))}
        </div>
        {/* Weeks — stretch to fill */}
        <div className="flex flex-1 overflow-x-auto" style={{ gap }}>
          {weeks.map((week, wi) => (
            <div
              key={wi}
              className="flex flex-col flex-1"
              style={{ gap, minWidth: cellSize }}
            >
              {week.map((dateKey, di) => {
                if (!dateKey)
                  return <div key={di} style={{ height: cellSize }} />;
                const count = byDay.get(dateKey)?.length ?? 0;
                const isSelected = selectedDate === dateKey;
                return (
                  <button
                    key={dateKey}
                    type="button"
                    title={`${dateKey}: ${count} event${count !== 1 ? "s" : ""}`}
                    onClick={() => onDayClick(dateKey)}
                    style={{ height: cellSize }}
                    className={`rounded-[3px] transition-all w-full ${
                      isSelected
                        ? "ring-2 ring-sky-500 ring-offset-1 dark:ring-offset-surface-600"
                        : ""
                    } ${heatColor(count, max)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Month labels */}
      <div className="flex mt-2 ml-8">
        <div className="flex flex-1 overflow-x-hidden" style={{ gap }}>
          {weeks.map((week, wi) => {
            const firstDay = week.find((d) => d !== null);
            if (!firstDay) return <div key={wi} className="flex-1" />;
            const day = parseInt(firstDay.slice(8));
            const month = parseInt(firstDay.slice(5, 7)) - 1;
            return (
              <div
                key={wi}
                className="flex-1 relative"
                style={{ minWidth: cellSize }}
              >
                {day <= 7 && (
                  <span className="absolute text-[10px] text-slate-400 whitespace-nowrap">
                    {MONTHS[month].slice(0, 3)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Month grid ────────────────────────────────────────────────────────────────

const MonthGrid: React.FC<{
  year: number;
  month: number;
  byDay: Map<string, ActivityLogItem[]>;
  onDayClick: (date: string) => void;
  selectedDate: string | null;
}> = ({ year, month, byDay, onDayClick, selectedDate }) => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = toDateKey(new Date().toISOString());

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-1">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 py-1"
          >
            {d}
          </div>
        ))}
      </div>
      {/* Calendar cells */}
      {Array.from({ length: cells.length / 7 }, (_, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1">
          {cells.slice(wi * 7, wi * 7 + 7).map((day, di) => {
            if (!day) return <div key={di} className="h-16 rounded-lg" />;
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const logs = byDay.get(dateKey) ?? [];
            const isToday = dateKey === today;
            const isSelected =
              selectedDate === dateKey && selectedDate !== today;
            const isTodaySelected = dateKey === today && selectedDate === today;
            const topEvents = logs.slice(0, 2);

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onDayClick(dateKey)}
                className={`h-22 rounded-lg p-1.5 text-left transition-all border ${
                  isTodaySelected
                    ? "border-sky-500 bg-sky-100 dark:bg-sky-900/40 ring-2 ring-sky-400 ring-offset-1 dark:ring-offset-surface-500"
                    : isSelected
                      ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30 ring-2 ring-sky-400 ring-offset-1 dark:ring-offset-surface-500"
                      : isToday
                        ? "border-amber-400 dark:border-amber-600 bg-amber-50/60 dark:bg-amber-950/20"
                        : logs.length > 0
                          ? "border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 hover:border-sky-300 dark:hover:border-sky-700"
                          : "border-transparent bg-slate-50 dark:bg-surface-600/50 hover:bg-slate-100 dark:hover:bg-surface-500"
                }`}
              >
                <span
                  className={`text-xs font-semibold ${isToday ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"}`}
                >
                  {day}
                </span>
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {topEvents.map((log) => {
                    const cat = categorizeEvent(log.event);
                    const c = CATEGORY_COLORS[cat];
                    // Show label if available, else prettify event
                    const display = log.label
                      ? log.label
                      : log.event.replace(/[._]/g, " ");
                    return (
                      <div
                        key={log.id}
                        className={`text-[9px] truncate rounded-sm px-1 py-0.5 flex items-center gap-1 ${c.bg} ${c.text}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`}
                        />
                        <span className="truncate">{display}</span>
                      </div>
                    );
                  })}
                  {logs.length > 3 && (
                    <div className="text-[9px] text-slate-400 pl-1">
                      +{logs.length - 3} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ── Today list ────────────────────────────────────────────────────────────────

const TodayList: React.FC<{ logs: ActivityLogItem[] }> = ({ logs }) => {
  if (logs.length === 0)
    return (
      <p className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
        No activity today.
      </p>
    );
  return (
    <div className="relative px-2 py-2">
      <div className="absolute left-[1.1rem] top-2 bottom-2 w-px bg-slate-200 dark:bg-surface-400" />
      <div className="flex flex-col gap-4">
        {logs.map((log) => {
          const cat = categorizeEvent(log.event);
          const colors = CATEGORY_COLORS[cat];
          return (
            <div key={log.id} className="flex gap-3 relative">
              <div
                className={`w-3 h-3 rounded-full mt-1 shrink-0 z-10 ring-2 ring-white dark:ring-surface-500 ${colors.dot}`}
              />
              <div className="flex-1 min-w-0 rounded-xl border border-slate-100 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2.5">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
                  >
                    {log.event.replace(".", " ")}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                    <Clock size={9} />
                    {formatTime(log.created_at)}
                  </span>
                </div>
                {log.label && (
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    {log.label}
                  </p>
                )}
                {(log as any).actor_user?.name && (
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    by {(log as any).actor_user.name}
                    {(log as any).actor_office?.code
                      ? ` · ${(log as any).actor_office.code}`
                      : ""}
                  </p>
                )}
                {(log as any).document?.title && (
                  <p className="mt-0.5 text-[10px] text-slate-500 truncate">
                    📄 {(log as any).document.title}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Main Calendar component ───────────────────────────────────────────────────

type CalendarMode = "year" | "month" | "today";

interface Props {
  scope: "all" | "office" | "mine";
}

const ActivityCalendar: React.FC<Props> = ({ scope }) => {
  const now = new Date();
  const [mode, setMode] = useState<CalendarMode>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch logs for the visible range
  useEffect(() => {
    let alive = true;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        let date_from: string;
        let date_to: string;

        if (mode === "year") {
          date_from = `${year}-01-01`;
          date_to = `${year}-12-31`;
        } else if (mode === "today") {
          const today = toDateKey(new Date().toISOString());
          date_from = today;
          date_to = today;
        } else {
          // month
          date_from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
          const lastDay = getDaysInMonth(year, month);
          date_to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        }

        let allLogs: ActivityLogItem[] = [];
        let p = 1;
        while (true) {
          const res = await listActivityLogs({
            scope,
            date_from,
            date_to,
            per_page: 50,
            page: p,
          });
          allLogs = [...allLogs, ...(res.data ?? [])];
          const meta = res.meta;
          if (!meta || Number(meta.current_page) >= Number(meta.last_page))
            break;
          p++;
          if (p > 20) break;
        }
        if (!alive) return;
        setLogs(allLogs);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };
    fetch();
    return () => {
      alive = false;
    };
  }, [scope, mode, year, month]);

  const byDay = useMemo(() => {
    const map = new Map<string, ActivityLogItem[]>();
    for (const log of logs) {
      const key = toDateKey(log.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return map;
  }, [logs]);

  const selectedLogs = selectedDate ? (byDay.get(selectedDate) ?? []) : [];
  const todayKey = toDateKey(new Date().toISOString());
  const todayLogs = byDay.get(todayKey) ?? [];

  const handleDayClick = (date: string) => {
    setSelectedDate((prev) => (prev === date ? null : date));
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
    setSelectedDate(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-surface-400 shrink-0">
        {/* Mode switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 p-0.5">
          {(["today", "month", "year"] as CalendarMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setSelectedDate(null);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition capitalize ${
                mode === m
                  ? "bg-white dark:bg-surface-500 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Navigation */}
        {mode === "month" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-400 text-slate-500 transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-32 text-center">
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-400 text-slate-500 transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {mode === "year" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setYear((y) => y - 1);
                setSelectedDate(null);
              }}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-400 text-slate-500 transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {year}
            </span>
            <button
              type="button"
              onClick={() => {
                setYear((y) => y + 1);
                setSelectedDate(null);
              }}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-400 text-slate-500 transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {mode === "today" && (
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {formatCalendarDate(todayKey)}
          </span>
        )}

        {loading && <span className="text-xs text-slate-400">Loading…</span>}
        {error && <span className="text-xs text-rose-500">{error}</span>}
      </div>

      {/* Body: calendar + optional side panel side by side */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Calendar area */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          <div
            className={`flex-1 min-h-0 p-5 ${mode === "year" ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}
          >
            {mode === "year" && (
              <div className="flex-1 min-h-0">
                <YearHeatmap
                  year={year}
                  byDay={byDay}
                  onDayClick={handleDayClick}
                  selectedDate={selectedDate}
                />
              </div>
            )}
            {mode === "month" && (
              <MonthGrid
                year={year}
                month={month}
                byDay={byDay}
                onDayClick={handleDayClick}
                selectedDate={selectedDate}
              />
            )}
            {mode === "today" && <TodayList logs={todayLogs} />}
          </div>
        </div>

        {/* Side panel — month and year, right side, own scroll */}
        {selectedDate && (mode === "month" || mode === "year") && (
          <div
            className="flex flex-col shrink-0 border-l border-slate-200 dark:border-surface-400"
            style={{ width: "300px", minHeight: 0, overflow: "hidden" }}
          >
            <DayPanel
              date={selectedDate}
              logs={selectedLogs}
              onClose={() => setSelectedDate(null)}
            />
          </div>
        )}

        {/* Collapsed tab */}
        {selectedDate &&
          (mode === "month" || mode === "year") &&
          panelCollapsed && (
            <button
              type="button"
              onClick={() => setPanelCollapsed(false)}
              className="flex flex-col items-center justify-center shrink-0 border-l border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 hover:bg-slate-100 dark:hover:bg-surface-500 transition px-2 gap-1"
              style={{ width: "28px" }}
              title="Expand day detail"
            >
              <span
                className="text-[9px] text-slate-400 writing-mode-vertical"
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                }}
              >
                {selectedDate}
              </span>
            </button>
          )}
      </div>
    </div>
  );
};

export default ActivityCalendar;
