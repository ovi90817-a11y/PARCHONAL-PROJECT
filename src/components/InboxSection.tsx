import React, { useState, useEffect } from 'react';
import {
  Layers,
  Copy,
  RefreshCw,
  Trash2,
  Radio,
  Zap,
} from 'lucide-react';
import { AccountRecord } from '../types';
import { copyToClipboard } from '../utils/generators';

interface InboxSectionProps {
  accounts: AccountRecord[];
  onCheckOTP: (orderId: string) => void;
  onCancelOrder?: (orderId: string) => void;
  onFinishOrder?: (orderId: string) => void;
  onConfirmManualOTP?: (orderId: string, otpCode: string) => void;
  onRefreshPanel?: () => void;
  isRefreshingPanel?: boolean;
  onToast: (msg: string) => void;
  checkingOrderId?: string | null;
  onOpenLiveChecker?: () => void;
  onClearAll?: () => void;
  onCopyAll?: () => void;
}

export const InboxSection: React.FC<InboxSectionProps> = ({
  accounts,
  onCheckOTP,
  onConfirmManualOTP,
  onRefreshPanel,
  isRefreshingPanel = false,
  onToast,
  checkingOrderId,
  onOpenLiveChecker,
  onClearAll,
  onCopyAll,
}) => {
  const [manualCodes, setManualCodes] = useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [autoLiveActive, setAutoLiveActive] = useState<boolean>(true);
  const [autoConfirmEnabled, setAutoConfirmEnabled] = useState<boolean>(true);
  const [checkingAll, setCheckingAll] = useState<boolean>(false);

  // Auto Live 2s polling: periodically checks OTP for active waiting accounts
  useEffect(() => {
    if (!autoLiveActive) return;

    const interval = setInterval(() => {
      const waiting = accounts.filter(
        (a) => a.status === 'WAITING_OTP' && (a.orderId || a.id)
      );
      if (waiting.length > 0) {
        // Ping up to 2 active orders per 2s tick to prevent rate limiting
        const batch = waiting.slice(0, 2);
        for (const acc of batch) {
          const key = acc.orderId || acc.id;
          if (key && checkingOrderId !== key) {
            onCheckOTP(key);
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [autoLiveActive, accounts, checkingOrderId, onCheckOTP]);

  // Auto-Confirm trigger when OTP is received if Auto-Confirm: ON is active
  useEffect(() => {
    if (!autoConfirmEnabled || !onConfirmManualOTP) return;

    for (const acc of accounts) {
      if (acc.status === 'OTP_RECEIVED' && acc.otpCode && !acc.completedAt) {
        // If not marked completed locally, finalize confirmation
        const key = acc.orderId || acc.id;
        if (key && !confirmingId) {
          onConfirmManualOTP(key, acc.otpCode);
        }
      }
    }
  }, [accounts, autoConfirmEnabled, onConfirmManualOTP, confirmingId]);

  const handleCopyNumber = async (acc: AccountRecord) => {
    const ok = await copyToClipboard(acc.number);
    if (ok) {
      onToast(`Phone number copied: ${acc.number}`);
    }
  };

  const handleCopyUID = async (acc: AccountRecord) => {
    const uidVal = acc.uid && acc.uid !== 'N/A' ? acc.uid : acc.orderId || acc.number;
    const ok = await copyToClipboard(uidVal);
    if (ok) {
      onToast(`UID copied: ${uidVal}`);
    }
  };

  const handleCopyOTP = async (code: string) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      onToast(`OTP code copied: ${code}`);
    }
  };

  const handleCopyAll = async () => {
    if (onCopyAll) {
      onCopyAll();
      return;
    }
    if (accounts.length === 0) {
      onToast('No accounts to copy.');
      return;
    }
    const allText = accounts
      .map(
        (a, i) =>
          `V${a.indexNumber || i + 1} | ${a.number} | Name: ${a.name || 'Trisha Rahman'} | Pass: ${a.password || 'Pass@MUtegNq'} | UID: ${a.uid || 'N/A'} | Status: ${a.status} | OTP: ${a.otpCode || 'Waiting'}`
      )
      .join('\n');
    const ok = await copyToClipboard(allText);
    if (ok) {
      onToast(`Copied ${accounts.length} account details to clipboard!`);
    }
  };

  const handleCheckAll = async () => {
    setCheckingAll(true);
    if (onRefreshPanel) {
      onRefreshPanel();
    }
    const waiting = accounts.filter((a) => a.status === 'WAITING_OTP');
    for (const acc of waiting.slice(0, 4)) {
      const key = acc.orderId || acc.id;
      if (key) {
        onCheckOTP(key);
      }
    }
    setTimeout(() => {
      setCheckingAll(false);
      onToast('All accounts checked for incoming SMS.');
    }, 1200);
  };

  const handleManualConfirm = async (orderKey: string) => {
    const code = (manualCodes[orderKey] || '').trim();
    if (!code) {
      onToast('Please enter the OTP verification code first.');
      return;
    }
    if (onConfirmManualOTP) {
      setConfirmingId(orderKey);
      try {
        await onConfirmManualOTP(orderKey, code);
        setManualCodes((prev) => {
          const next = { ...prev };
          delete next[orderKey];
          return next;
        });
      } finally {
        setConfirmingId(null);
      }
    }
  };

  return (
    <div className="w-full bg-[#050b16] border border-[#0d1e35] rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4">
      {/* Top Header Row matching screenshot */}
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        {/* Left: Icon, Count, My Accounts, Auto Live 2s badge */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#091b31] border border-[#14335a] flex items-center justify-center text-[#38bdf8] shadow-lg shadow-sky-950/40 shrink-0">
            <Layers className="w-6 h-6 stroke-[2.2] text-[#38bdf8]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white tracking-tight">
                {accounts.length}
              </span>
              <span className="text-xs text-slate-400 font-medium">My Accounts</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAutoLiveActive(!autoLiveActive);
                onToast(autoLiveActive ? 'Auto Live 2s paused' : 'Auto Live 2s active');
              }}
              className={`mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer w-fit ${
                autoLiveActive
                  ? 'bg-[#04211d] border border-[#0d594c] text-[#34d399]'
                  : 'bg-[#121927] border border-[#1e293d] text-slate-400 hover:text-slate-200'
              }`}
              title="Click to toggle Auto Live 2s"
            >
              <span>Auto Live 2s</span>
              <Zap className="w-3 h-3 fill-current text-current" />
            </button>
          </div>
        </div>

        {/* Right: 4 Action Buttons in 2x2 grid matching screenshot */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenLiveChecker}
            className="px-3 py-1.5 rounded-lg bg-[#052622] hover:bg-[#073630] border border-[#0d594c] text-[#34d399] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Radio className="w-3.5 h-3.5 text-[#34d399]" />
            <span>Live Checker</span>
          </button>

          <button
            type="button"
            onClick={handleCheckAll}
            disabled={isRefreshingPanel || checkingAll}
            className="px-3 py-1.5 rounded-lg bg-[#052622] hover:bg-[#073630] border border-[#0d594c] text-[#34d399] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#34d399] ${
                isRefreshingPanel || checkingAll ? 'animate-spin' : ''
              }`}
            />
            <span>Check All</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAll}
            className="px-3 py-1.5 rounded-lg bg-[#0a203f] hover:bg-[#0f2d56] border border-[#163d70] text-[#38bdf8] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Copy className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>Copy All</span>
          </button>

          <button
            type="button"
            onClick={onClearAll}
            className="px-3 py-1.5 rounded-lg bg-[#301118] hover:bg-[#451621] border border-[#631e2c] text-[#f87171] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#f87171]" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Account Cards Feed */}
      <div className="flex flex-col gap-3">
        {accounts.length === 0 ? (
          /* Empty / Preview Template matching screenshot style */
          <div className="bg-[#060e1d] border border-dashed border-[#10233f] rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-[#091b31] border border-[#14335a] flex items-center justify-center text-slate-400">
              <Layers className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-white">No Active Accounts Yet</p>
            <p className="text-xs text-slate-400 max-w-sm">
              Enter a phone number above or click &quot;Create Account / Request Live Number&quot; to rent numbers and receive real-time OTPs.
            </p>
          </div>
        ) : (
          accounts.map((acc, idx) => (
            <div
              key={acc.id}
              className="bg-[#060e1d] border border-[#0e213b] rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-lg hover:border-[#15345d] transition-all"
            >
              {/* Row 1: V1, You, Number, Status, Check Button */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#06241e] border border-[#0f5442] text-[#34d399] text-xs font-mono font-bold">
                    V{acc.indexNumber || idx + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#082238] border border-[#124268] text-[#38bdf8] text-xs font-semibold">
                    You
                  </span>
                  <span className="text-white font-mono font-bold text-sm sm:text-base tracking-wider select-all">
                    {acc.number}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status Badge */}
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                      acc.status === 'OTP_RECEIVED'
                        ? 'bg-[#062622] border border-[#0d594c] text-[#34d399]'
                        : acc.status === 'COMPLETED'
                        ? 'bg-[#0c2438] border border-[#17456d] text-[#38bdf8]'
                        : acc.status === 'CANCELLED' || acc.status === 'EXPIRED'
                        ? 'bg-[#2d1117] border border-[#5d1c28] text-rose-400'
                        : 'bg-[#382008] border border-[#7c4409] text-[#f59e0b]'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        acc.status === 'OTP_RECEIVED'
                          ? 'bg-emerald-400 animate-pulse'
                          : acc.status === 'COMPLETED'
                          ? 'bg-sky-400'
                          : acc.status === 'CANCELLED' || acc.status === 'EXPIRED'
                          ? 'bg-rose-400'
                          : 'bg-amber-400'
                      }`}
                    />
                    <span>
                      {acc.status === 'OTP_RECEIVED'
                        ? 'LIVE'
                        : acc.status === 'WAITING_OTP'
                        ? 'CHECKPOINT'
                        : acc.status}
                    </span>
                  </span>

                  {/* Refresh / Check Icon Button */}
                  <button
                    type="button"
                    onClick={() => onCheckOTP(acc.orderId || acc.id)}
                    disabled={checkingOrderId === (acc.orderId || acc.id)}
                    className="w-8 h-8 rounded-xl bg-[#091b33] hover:bg-[#0f2a50] border border-[#143258] text-[#38bdf8] flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                    title="Check incoming SMS"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-[#38bdf8] ${
                        checkingOrderId === (acc.orderId || acc.id)
                          ? 'animate-spin'
                          : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Row 2: OTP Bar matching screenshot */}
              <div className="bg-[#030712] border border-[#0d1d33] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-500 font-mono text-xs shrink-0">OTP:</span>
                  {acc.otpCode ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[#34d399] font-mono text-sm sm:text-base font-extrabold tracking-widest">
                        {acc.otpCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyOTP(acc.otpCode!)}
                        className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded cursor-pointer hover:bg-emerald-900/60"
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[#38bdf8] font-mono text-xs sm:text-sm">
                      <RefreshCw className="w-3.5 h-3.5 text-[#38bdf8] animate-spin shrink-0" />
                      <span className="truncate">Waiting for OTP...</span>
                    </div>
                  )}
                </div>

                {/* Auto-Confirm: ON/OFF toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setAutoConfirmEnabled(!autoConfirmEnabled);
                    onToast(
                      !autoConfirmEnabled
                        ? 'Auto-Confirm: ON'
                        : 'Auto-Confirm: OFF'
                    );
                  }}
                  className="px-3 py-1 rounded-lg bg-[#0c1f38] hover:bg-[#122c50] border border-[#183a66] text-slate-300 text-xs font-mono font-semibold transition-all cursor-pointer shrink-0"
                >
                  Auto-Confirm: {autoConfirmEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Manual OTP Confirm Form (if waiting) */}
              {acc.status === 'WAITING_OTP' && onConfirmManualOTP && (
                <div className="flex items-center gap-2 bg-[#040814] p-1.5 rounded-xl border border-[#0f213b]">
                  <input
                    type="text"
                    value={manualCodes[acc.orderId || acc.id] || ''}
                    onChange={(e) =>
                      setManualCodes({
                        ...manualCodes,
                        [acc.orderId || acc.id]: e.target.value,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleManualConfirm(acc.orderId || acc.id);
                    }}
                    placeholder="Enter received OTP code here..."
                    className="flex-1 bg-transparent px-3 py-1.5 text-xs font-mono text-emerald-300 placeholder:text-slate-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleManualConfirm(acc.orderId || acc.id)}
                    disabled={confirmingId === (acc.orderId || acc.id)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {confirmingId === (acc.orderId || acc.id) ? '...' : 'Confirm'}
                  </button>
                </div>
              )}

              {/* Thin Divider */}
              <div className="border-t border-[#0e1d33] my-0.5" />

              {/* Row 4: Name & Pass */}
              <div className="flex items-center justify-between text-xs sm:text-sm font-mono flex-wrap gap-2">
                <div>
                  <span className="text-slate-500">Name: </span>
                  <span className="text-white font-semibold">
                    {acc.name || 'Trisha Rahman'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Pass: </span>
                  <span className="text-white font-semibold">
                    {acc.password || 'Pass@MUtegNq'}
                  </span>
                </div>
              </div>

              {/* Row 5: UID & Copy Buttons */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="text-xs sm:text-sm font-mono">
                  <span className="text-slate-500">UID: </span>
                  <span className="text-[#38bdf8] font-bold">
                    {acc.uid && acc.uid !== 'N/A' ? acc.uid : 'N/A'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyNumber(acc)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0a203f] hover:bg-[#102d56] border border-[#163b6d] text-[#38bdf8] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span>Number Copy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyUID(acc)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#241235] hover:bg-[#34164c] border border-[#4d1f6e] text-[#c084fc] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#c084fc]" />
                    <span>Uid Copy</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
