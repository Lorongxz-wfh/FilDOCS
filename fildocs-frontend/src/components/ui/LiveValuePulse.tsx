import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LiveValuePulseProps {
  value: any;
  children: React.ReactNode;
  className?: string;
  pulseColor?: string; // Tailwind class, e.g., 'bg-sky-500/20'
  duration?: number;
}

/**
 * A utility wrapper that triggers a brief background pulse animation
 * whenever the provided value changes. Useful for highlighting real-time
 * updates in data-heavy dashboards.
 */
export const LiveValuePulse: React.FC<LiveValuePulseProps> = ({
  value,
  children,
  className = "",
  pulseColor = "bg-sky-500/10",
  duration = 0.6,
}) => {
  const [pulse, setPulse] = useState(false);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    setPulse(true);
    const timer = setTimeout(() => setPulse(false), duration * 1000);
    return () => clearTimeout(timer);
  }, [value, duration]);

  return (
    <div className={`relative ${className}`}>
      <AnimatePresence>
        {pulse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`absolute inset-0 -inset-x-1 -inset-y-0.5 rounded pointer-events-none z-0 ${pulseColor}`}
          />
        )}
      </AnimatePresence>
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default LiveValuePulse;
