import React from 'react';
import { X, AlertTriangle, RotateCcw } from 'lucide-react';

interface ResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: () => void;
}

export const ResetModal: React.FC<ResetModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-[#0f1422] border border-[#232f45] rounded-2xl shadow-2xl overflow-hidden p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1c2538]">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-sm font-bold text-white">Reset Batch & Inbox</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1a2334] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Are you sure you want to reset? This will clear the current created accounts list and console logs. Your balance will be preserved.
        </p>

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-[#151c2e] hover:bg-[#1e273f] text-slate-300 text-xs font-semibold border border-[#26334d] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmReset();
              onClose();
            }}
            className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-950"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
