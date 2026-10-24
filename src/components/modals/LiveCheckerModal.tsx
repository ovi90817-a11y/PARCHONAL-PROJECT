import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, CheckCircle2, XCircle, Loader2, Play } from 'lucide-react';
import { AccountRecord } from '../../types';

interface LiveCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetAccount?: AccountRecord | null;
  onToast: (msg: string) => void;
}

interface CheckResult {
  target: string;
  isLive: boolean;
  status: string;
  details: string;
  checkedAt: string;
}

export const LiveCheckerModal: React.FC<LiveCheckerModalProps> = ({
  isOpen,
  onClose,
  presetAccount,
  onToast,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    if (presetAccount) {
      const val = presetAccount.orderId || presetAccount.number || presetAccount.id;
      setInputVal(val);
      runCheck(val);
    } else {
      setResult(null);
    }
  }, [presetAccount, isOpen]);

  if (!isOpen) return null;

  const runCheck = async (target: string) => {
    if (!target.trim()) return;
    setIsChecking(true);
    setResult(null);

    try {
      const res = await fetch(`/api/sms/order/${encodeURIComponent(target.trim().replace(/^#/, ''))}`);
      const data = await res.json();
      setIsChecking(false);

      if (res.ok && data.order) {
        const isLive =
          data.status === 'SMS_RECEIVED' ||
          data.status === 'WAITING_SMS' ||
          data.status === 'COMPLETED';
        setResult({
          target: `${data.order.number} (Order #${data.order.orderId})`,
          isLive,
          status: data.status,
          details: data.smsCode
            ? `Official SMS Code: ${data.smsCode}`
            : data.message || `Provider Status: ${data.status}`,
          checkedAt: new Date().toLocaleTimeString(),
        });
        onToast(`Order #${data.order.orderId}: ${data.status}`);
      } else {
        setResult({
          target: target.trim(),
          isLive: false,
          status: 'NOT_FOUND_OR_PENDING',
          details: data.message || 'No active provider rental order found matching this identifier.',
          checkedAt: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      setIsChecking(false);
      setResult({
        target: target.trim(),
        isLive: false,
        status: 'NETWORK_ERROR',
        details: `Connection error: ${err.message}`,
        checkedAt: new Date().toLocaleTimeString(),
      });
    }
  };

  const handleManualCheck = (e: React.FormEvent) => {
    e.preventDefault();
    runCheck(inputVal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#0f1422] border border-[#232f45] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1c2538] bg-[#0a0e18]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-none">
                Provider Status Verifier
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Real SMS Provider Order & Inbound Message Inspector
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1a2334] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          <form onSubmit={handleManualCheck} className="flex flex-col gap-3">
            <label className="text-xs font-medium text-slate-300">
              Enter Provider Order ID or Phone Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="e.g. 198273645 or +12025550198"
                className="flex-1 bg-[#090d16] border border-[#232f45] rounded-xl px-3.5 py-2 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                disabled={isChecking || !inputVal.trim()}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                {isChecking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white" />
                )}
                <span>Verify</span>
              </button>
            </div>
          </form>

          {/* Result card */}
          {isChecking && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
              <span className="text-xs font-mono">Querying real SMS provider API...</span>
            </div>
          )}

          {!isChecking && result && (
            <div
              className={`p-4 rounded-xl border flex flex-col gap-2.5 ${
                result.isLive
                  ? 'bg-teal-950/30 border-teal-500/40'
                  : 'bg-rose-950/30 border-rose-500/40'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-xs font-bold text-slate-200">
                  {result.target}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    result.isLive
                      ? 'bg-teal-900 text-teal-200'
                      : 'bg-rose-900 text-rose-200'
                  }`}
                >
                  {result.status}
                </span>
              </div>

              <div className="flex flex-col gap-1 text-xs font-mono">
                <div className="text-slate-300 font-sans">
                  {result.details}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Checked at: {result.checkedAt}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
