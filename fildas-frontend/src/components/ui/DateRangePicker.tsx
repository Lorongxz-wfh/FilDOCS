import React, { useState, useRef, useEffect } from "react";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isToday,
  addDays, 
  isWithinInterval,
  subDays,
  subYears,
  startOfDay
} from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "./Button";

interface DateRange {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  from: string;
  to: string;
  onSelect: (range: DateRange) => void;
  className?: string;
  align?: "left" | "right";
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  from,
  to,
  onSelect,
  className = "",
  align = "right"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(from ? new Date(from) : new Date());
  const [tempRange, setTempRange] = useState<DateRange>({ from, to });
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempRange({ from, to });
  }, [from, to]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      
      // Smart positioning check
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        // If less than 450px below (avg height of picker), open up
        setOpenUp(spaceBelow < 450);
      }
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handlePreset = (type: "today" | "week" | "month" | "year") => {
    const end = startOfDay(new Date());
    let start: Date;
    if (type === "today") start = end;
    else if (type === "week") start = subDays(end, 7);
    else if (type === "month") start = subMonths(end, 1);
    else start = subYears(end, 1);

    const range = {
      from: format(start, "yyyy-MM-dd"),
      to: format(end, "yyyy-MM-dd")
    };
    setTempRange(range);
    setCurrentMonth(start);
  };

  const onDateClick = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    if (!tempRange.from || (tempRange.from && tempRange.to)) {
      setTempRange({ from: dayStr, to: "" });
    } else {
      if (dayStr < tempRange.from) {
        setTempRange({ from: dayStr, to: tempRange.from });
      } else {
        setTempRange({ ...tempRange, to: dayStr });
      }
    }
  };

  const isInRange = (day: Date) => {
    if (!tempRange.from || !tempRange.to) return false;
    try {
      return isWithinInterval(day, {
        start: new Date(tempRange.from),
        end: new Date(tempRange.to)
      });
    } catch {
      return false;
    }
  };

  const isSelected = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return dayStr === tempRange.from || dayStr === tempRange.to;
  };

  const renderHeader = () => (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-surface-400/30">
      <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-slate-100 dark:hover:bg-surface-400 rounded-md transition-colors">
        <ChevronLeft size={16} className="text-slate-500" />
      </button>
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">
        {format(currentMonth, "MMMM yyyy")}
      </span>
      <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-slate-100 dark:hover:bg-surface-400 rounded-md transition-colors">
        <ChevronRight size={16} className="text-slate-500" />
      </button>
    </div>
  );

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentMonth);

    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter text-center py-2">
          {format(addDays(startDate, i), "EEE").substring(0, 2)}
        </div>
      );
    }
    return <div className="grid grid-cols-7">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows: React.ReactNode[] = [];
    let days: React.ReactNode[] = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const currentDaySelection = day;
        const disabled = !isSameMonth(currentDaySelection, monthStart);
        const selected = isSelected(currentDaySelection);
        const inRange = isInRange(currentDaySelection);
        const today = isToday(currentDaySelection);

        days.push(
          <div
            key={currentDaySelection.toString()}
            className={`relative py-2 flex items-center justify-center cursor-pointer group transition-all duration-150 ${
              disabled ? "opacity-20 pointer-events-none" : "hover:scale-110"
            }`}
            onClick={() => onDateClick(currentDaySelection)}
          >
            {inRange && !selected && (
              <div className="absolute inset-y-1.5 inset-x-0 bg-brand-500/10 dark:bg-brand-500/20 z-0" />
            )}
            <span className={`relative z-10 w-8 h-8 flex items-center justify-center text-xs font-semibold rounded-md transition-colors ${
              selected 
                ? "bg-brand-500 text-white shadow-sm ring-2 ring-brand-500/20" 
                : inRange 
                  ? "text-brand-600 dark:text-brand-400 font-bold" 
                  : today
                    ? "text-brand-500 ring-1 ring-brand-500/50"
                    : "text-slate-600 dark:text-slate-300 group-hover:bg-slate-100 dark:group-hover:bg-surface-400"
            }`}>
              {format(currentDaySelection, "d")}
              {today && !selected && !inRange && (
                <div className="absolute top-1 right-1 w-1 h-1 bg-brand-500 rounded-full" />
              )}
            </span>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div className="grid grid-cols-7" key={day.toString()}>{days}</div>);
      days = [];
    }
    return <div className="p-2">{rows}</div>;
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 h-8 border border-slate-200 dark:border-surface-400 rounded-md bg-white dark:bg-surface-500 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-300 transition-all shadow-xs"
      >
        <CalendarIcon size={14} className="text-slate-400" />
        {tempRange.from ? (
          <span className="tabular-nums">
            {format(new Date(tempRange.from), "MMMM d, yyyy")}
            {tempRange.to && ` — ${format(new Date(tempRange.to), "MMMM d, yyyy")}`}
          </span>
        ) : (
          <span>Select Range</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 bg-white dark:bg-surface-600 border border-slate-200 dark:border-surface-400 rounded-xl shadow-2xl overflow-hidden flex flex-col sm:flex-row min-w-[320px] sm:min-w-[480px] max-h-[min(520px,90vh)] overflow-y-auto scrollbar-none mb-10 ${
              openUp ? "bottom-full mb-2" : "top-full mt-2"
            } ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            <div className="w-full sm:w-36 bg-slate-50 dark:bg-surface-500/30 border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-surface-400/30 p-3 space-y-1.5 flex flex-row sm:flex-col items-center sm:items-stretch overflow-x-auto whitespace-nowrap scrollbar-none">
              <span className="hidden sm:block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 px-2">Presets</span>
              {["today", "week", "month", "year"].map((p) => (
                <button
                  key={p}
                  onClick={() => handlePreset(p as any)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-surface-400 rounded-lg transition-all border border-transparent hover:border-slate-200 dark:hover:border-surface-400"
                >
                  <Clock size={12} className="opacity-50" />
                  {p === "today" ? "Today" : `Last ${p}`}
                </button>
              ))}
            </div>

            <div className="flex-1 flex flex-col">
              <div className="p-3 border-b border-slate-100 dark:border-surface-400/30 grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-white/5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">From</label>
                  <input 
                    type="text" 
                    placeholder="YYYY-MM-DD"
                    value={tempRange.from}
                    onChange={(e) => setTempRange({...tempRange, from: e.target.value})}
                    className="w-full h-8 px-2 bg-white dark:bg-surface-600 border border-slate-200 dark:border-surface-400 rounded-md text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">To</label>
                  <input 
                    type="text" 
                    placeholder="Open Range"
                    value={tempRange.to}
                    onChange={(e) => setTempRange({...tempRange, to: e.target.value})}
                    className="w-full h-8 px-2 bg-white dark:bg-surface-600 border border-slate-200 dark:border-surface-400 rounded-md text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>
              </div>

              {renderHeader()}
              {renderDays()}
              {renderCells()}

              <div className="p-3 bg-slate-50 dark:bg-surface-500/30 border-t border-slate-100 dark:border-surface-400/30 flex items-center justify-between">
                <Button size="sm" variant="ghost" className="text-[10px] font-bold uppercase tracking-widest text-slate-500" onClick={() => setTempRange({ from: "", to: "" })}>Clear</Button>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)} className="text-xs font-bold">Cancel</Button>
                  <Button size="sm" variant="primary" onClick={() => { onSelect(tempRange); setIsOpen(false); }} className="text-xs font-bold px-5" disabled={!tempRange.from}>Apply</Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
