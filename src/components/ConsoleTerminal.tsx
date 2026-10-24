import React, { useRef, useEffect } from 'react';
import { Terminal, Trash2, CheckCircle2 } from 'lucide-react';
import { ConsoleLog } from '../types';

interface ConsoleTerminalProps {
  logs: ConsoleLog[];
  onClearLogs: () => void;
}

export const ConsoleTerminal: React.FC<ConsoleTerminalProps> = ({ logs, onClearLogs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-2xl bg-[#0f1422] border border-[#1e2738] p-4 sm:p-5 shadow-xl shadow-black/40">
        {/* Terminal Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-slate-300 flex items-center gap-1.5">
              <span className="text-emerald-400">&gt;_</span> Console
            </span>
          </div>
          <button
            type="button"
            onClick={onClearLogs}
            title="Clear Console"
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        {/* Terminal Window */}
        <div
          ref={scrollRef}
          className="rounded-xl bg-[#050811] border border-[#192233] p-4 font-mono text-xs sm:text-[13px] leading-relaxed max-h-56 overflow-y-auto custom-scrollbar select-text shadow-inner"
        >
          {/* Subtle green check badge as shown in screenshot */}
          <div className="text-emerald-400 mb-2 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] text-emerald-400/80">session_active</span>
          </div>

          {logs.length === 0 ? (
            <div className="text-slate-600 italic py-2">
              Awaiting batch start... System idle.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {logs.map((log) => {
                let color = 'text-slate-300';
                if (log.type === 'success') color = 'text-emerald-400';
                if (log.type === 'warn') color = 'text-amber-300';
                if (log.type === 'error') color = 'text-rose-400';
                if (log.type === 'otp') color = 'text-cyan-300 font-semibold';

                return (
                  <div key={log.id} className="flex items-start gap-2.5 break-all">
                    <span className="text-slate-500 shrink-0 select-none font-mono">
                      {log.time}
                    </span>
                    <span className={`${color} flex-1`}>{log.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
