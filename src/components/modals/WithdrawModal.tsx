import React, { useState } from 'react';
import { X, Wallet, CheckCircle2, ArrowRight, History } from 'lucide-react';
import { PaymentMethodConfig, WithdrawRecord } from '../../types';
import confetti from 'canvas-confetti';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onConfirmWithdraw: (record: WithdrawRecord) => void;
  history: WithdrawRecord[];
  paymentMethods?: PaymentMethodConfig[];
  minWithdraw?: number;
}

const DEFAULT_METHODS: PaymentMethodConfig[] = [
  { id: 'bKash', name: 'bKash', badge: 'বিকাশ', enabled: true },
  { id: 'Nagad', name: 'Nagad', badge: 'নগদ', enabled: true },
  { id: 'Rocket', name: 'Rocket', badge: 'রকেট', enabled: true },
  { id: 'Upay', name: 'Upay', badge: 'উপায়', enabled: true },
];

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  balance,
  onConfirmWithdraw,
  history,
  paymentMethods = DEFAULT_METHODS,
  minWithdraw = 50,
}) => {
  const activeMethods = paymentMethods.filter((m) => m.enabled);
  const [selectedMethod, setSelectedMethod] = useState<string>(
    activeMethods[0]?.name || 'bKash'
  );
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState<number>(minWithdraw);
  const [activeTab, setActiveTab] = useState<'request' | 'history'>('request');
  const [successTrx, setSuccessTrx] = useState<WithdrawRecord | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountNumber || accountNumber.length < 11) {
      alert('Please enter a valid mobile number (e.g., 017XXXXXXXX)');
      return;
    }
    if (amount < minWithdraw) {
      alert(`Minimum withdrawal amount is ৳${minWithdraw}`);
      return;
    }
    if (amount > balance) {
      alert(`Insufficient balance. Current balance is ৳${balance}`);
      return;
    }

    const randomTrx = 'TRX' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const newRecord: WithdrawRecord = {
      id: Date.now().toString(),
      method: selectedMethod,
      accountNumber,
      amount,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      trxId: randomTrx,
      status: 'Completed',
    };

    onConfirmWithdraw(newRecord);
    setSuccessTrx(newRecord);
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#0f1422] border border-[#232f45] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1c2538] bg-[#0a0e18]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-none">
                Withdraw Earnings (উইথড্র)
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Fast payout via Bangladeshi Mobile Banking
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSuccessTrx(null);
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1a2334] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-[#1c2538] bg-[#090d16]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('request');
              setSuccessTrx(null);
            }}
            className={`flex-1 py-2.5 text-xs font-bold transition-colors cursor-pointer text-center ${
              activeTab === 'request'
                ? 'text-indigo-400 border-b-2 border-indigo-500 bg-[#0f1422]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Request Payout
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 text-xs font-bold transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'text-indigo-400 border-b-2 border-indigo-500 bg-[#0f1422]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({history.length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto max-h-[75vh]">
          {activeTab === 'history' ? (
            <div className="flex flex-col gap-3">
              {history.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No payout history yet. Complete a withdrawal request to see records here.
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#0a0e18] border border-[#1d273a] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span className="text-emerald-400">৳{item.amount}</span>
                        <span className="text-slate-500">•</span>
                        <span>{item.method}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {item.accountNumber} · Trx: {item.trxId}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {item.status}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {item.timestamp}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : successTrx ? (
            /* Success confirmation screen */
            <div className="py-4 text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                Withdrawal Successful!
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mb-4">
                ৳{successTrx.amount} sent to {successTrx.method} ({successTrx.accountNumber}).
              </p>
              <div className="w-full bg-[#090d16] p-3 rounded-xl border border-[#1e273a] font-mono text-xs text-left mb-5 flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">TrxID:</span>
                  <span className="text-indigo-300 font-bold">{successTrx.trxId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Method:</span>
                  <span className="text-white">{successTrx.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="text-emerald-400 font-bold">Completed</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSuccessTrx(null)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Make Another Withdrawal
              </button>
            </div>
          ) : (
            /* Form screen */
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Balance display banner */}
              <div className="p-3 rounded-xl bg-[#090d16] border border-[#1e273a] flex items-center justify-between">
                <span className="text-xs text-slate-400">Available Balance:</span>
                <span className="text-lg font-black text-emerald-400">
                  ৳{balance}
                </span>
              </div>

              {/* Payment methods */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {activeMethods.map((m) => {
                    const isSelected = selectedMethod === m.name;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMethod(m.name)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#151c2e] border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                            : 'bg-[#0a0e18] border-[#1d273a] hover:bg-[#121826]'
                        }`}
                      >
                        <span className="text-xs font-bold text-white">
                          {m.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                          {m.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {selectedMethod} Wallet Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="017XXXXXXXX"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full bg-[#090d16] border border-[#232f45] rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Withdrawal Amount (৳)
                </label>
                <input
                  type="number"
                  min={10}
                  max={Math.max(10, balance)}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-[#090d16] border border-[#232f45] rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-indigo-500 mb-2"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {[50, 100, 200, 500, 1000].map((quickAmt) => (
                    <button
                      key={quickAmt}
                      type="button"
                      onClick={() => setAmount(quickAmt)}
                      className="px-2.5 py-1 rounded-lg bg-[#141b2a] hover:bg-[#1f2a40] text-slate-300 text-xs font-mono border border-[#232f45] transition-colors cursor-pointer"
                    >
                      ৳{quickAmt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAmount(balance)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 text-xs font-medium border border-indigo-800 transition-colors cursor-pointer ml-auto"
                  >
                    All (৳{balance})
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={balance < 10 || amount > balance}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-indigo-950 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
              >
                <span>Confirm Withdrawal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
