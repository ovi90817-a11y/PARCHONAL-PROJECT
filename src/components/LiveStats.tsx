import React, { useState, useEffect } from 'react';

interface LiveStatsProps {
  activeCount: number;
  otpCount: number;
}

export const LiveStats: React.FC<LiveStatsProps> = ({ activeCount, otpCount }) => {
  const [timeStr, setTimeStr] = useState<string>('19:31');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      setTimeStr(`${h}:${m}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-2xl bg-[#0f1422] border border-[#1e2738] p-4 sm:p-5 shadow-xl shadow-black/40">
        <h3 className="text-sm font-bold text-slate-100 mb-3 tracking-tight">
          Live Stats
        </h3>

        <div className="grid grid-cols-3 gap-3">
          {/* Active stats */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#090d16] border border-[#1a2334]">
            <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {activeCount}
            </span>
            <span className="text-xs font-medium text-slate-400 mt-1">
              Active
            </span>
          </div>

          {/* OTPs stats */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#090d16] border border-[#1a2334]">
            <span className="text-2xl sm:text-3xl font-black text-[#fbbf24] tracking-tight">
              {otpCount}
            </span>
            <span className="text-xs font-medium text-slate-400 mt-1">
              OTPs
            </span>
          </div>

          {/* Watch (Clock / Timer) */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#090d16] border border-[#1a2334]">
            <span className="text-2xl sm:text-3xl font-black text-[#818cf8] tracking-tight font-mono">
              {timeStr}
            </span>
            <span className="text-xs font-medium text-slate-400 mt-1">
              Watch
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
