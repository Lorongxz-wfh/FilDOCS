import React from "react";

interface UploadProgressBarProps {
  value: number; // 0..100
}

const UploadProgress: React.FC<UploadProgressBarProps> = ({ value }) => {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-sky-600 transition-[width] duration-150"
          style={{ width: `${safe}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-600">{safe}%</p>
    </div>
  );
};

export default UploadProgress;
