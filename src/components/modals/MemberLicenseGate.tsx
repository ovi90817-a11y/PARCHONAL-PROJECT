import React, { useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Smartphone,
  AlertTriangle,
  Lock,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Shield,
  Loader2,
} from 'lucide-react';
import { activateLicenseOnServer, getDeviceInstallationId, StoredLicenseSession } from '../../utils/deviceLicense';

interface MemberLicenseGateProps {
  onSuccess: (session: StoredLicenseSession) => void;
  appName?: string;
  onOpenAdmin?: () => void;
}

export const MemberLicenseGate: React.FC<MemberLicenseGateProps> = ({
  onSuccess,
  appName = 'OXYZ',
  onOpenAdmin,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [memberIdInput, setMemberIdInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [installationId] = useState(() => getDeviceInstallationId());

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setKeyInput(val);
    if (errorMessage) setErrorMessage('');
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setErrorMessage('Please enter your license key.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await activateLicenseOnServer({
        rawKey: keyInput.trim(),
        memberId: memberIdInput.trim() || 'Member',
      });

      if (!result.success || !result.session) {
        setErrorMessage(result.message || 'License activation failed. Please try again.');
        setIsLoading(false);
        return;
      }

      // Success
      onSuccess(result.session);
    } catch (err: any) {
      setErrorMessage('Network connection error. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050811]/95 backdrop-blur-md overflow-y-auto">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg bg-[#0a0f1d] border border-[#1f2c47] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col gap-6">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              <KeyRound className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">{appName}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  Protected
                </span>
              </div>
              <p className="text-xs text-slate-400">License Verification & Device Access Gate</p>
            </div>
          </div>

          {/* Quick Admin Access Icon */}
          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              title="Admin Panel"
              className="w-9 h-9 rounded-xl bg-[#121a2d] hover:bg-[#1a253f] border border-[#23314f] text-slate-400 hover:text-amber-400 flex items-center justify-center transition-all cursor-pointer"
            >
              <Shield className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Security Notice Banner */}
        <div className="p-3.5 rounded-2xl bg-[#0f172a] border border-[#233354] flex items-start gap-3">
          <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <p className="font-semibold text-white">License Authentication Required</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Enter your authorized license key to unlock the automation tools, virtual numbers, and member dashboard.
              Keys are cryptographically bound to this hardware device.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleActivate} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>License Key</span>
              <span className="text-[10px] font-normal text-slate-500">Format: OXYZ-XXXX-XXXX-XXXX-XXXX</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={keyInput}
                onChange={handleKeyChange}
                placeholder="OXYZ-XXXX-XXXX-XXXX-XXXX"
                className="w-full bg-[#050811] border border-[#23314d] rounded-xl px-4 py-3 text-sm font-mono font-bold text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 transition-colors uppercase tracking-wider"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Member Name / Identifier</span>
              <span className="text-[10px] font-normal text-slate-500">Optional</span>
            </label>
            <input
              type="text"
              value={memberIdInput}
              onChange={(e) => setMemberIdInput(e.target.value)}
              placeholder="e.g. Nayeem Ahmed / ovi90817"
              className="w-full bg-[#050811] border border-[#23314d] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {/* Registered Device Badge */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#090e1c] border border-[#1b253b] text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Device ID:</span>
            </div>
            <code className="text-amber-400/80 font-mono text-[10px]">{installationId.slice(0, 16)}...</code>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="leading-tight font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98 mt-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Verifying Cryptographic Key...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                <span>Activate License & Unlock Dashboard</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info & admin contact */}
        <div className="pt-2 border-t border-[#19243b] flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Need a License Key?</span>
          </div>
          <span className="text-slate-400">Contact System Administrator directly</span>
        </div>
      </div>
    </div>
  );
};
