import React from 'react';
import { X, Trophy, Medal, Award, Flame, UserCheck } from 'lucide-react';
import { LeaderboardUser } from '../../types';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserStats: {
    accountsCreated: number;
    otps: number;
    balance: number;
  };
}

const SAMPLE_LEADERS: LeaderboardUser[] = [
  {
    rank: 1,
    name: 'Tanvir Hossain',
    location: 'Dhaka',
    accountsToday: 142,
    otpsToday: 138,
    earnings: 2070,
    avatar: '👨‍💻',
    badge: 'Legend',
  },
  {
    rank: 2,
    name: 'Nayeem Ahmed',
    location: 'Sylhet',
    accountsToday: 118,
    otpsToday: 110,
    earnings: 1650,
    avatar: '⚡',
    badge: 'Master',
  },
  {
    rank: 3,
    name: 'Shakil Khan',
    location: 'Chittagong',
    accountsToday: 96,
    otpsToday: 89,
    earnings: 1335,
    avatar: '🔥',
    badge: 'Pro',
  },
  {
    rank: 4,
    name: 'Mehedi Hasan',
    location: 'Rajshahi',
    accountsToday: 74,
    otpsToday: 71,
    earnings: 1065,
    avatar: '🚀',
    badge: 'Expert',
  },
  {
    rank: 5,
    name: 'Rakibul Islam',
    location: 'Khulna',
    accountsToday: 58,
    otpsToday: 55,
    earnings: 825,
    avatar: '🎯',
    badge: 'Star',
  },
  {
    rank: 6,
    name: 'Al-Amin Mollah',
    location: 'Barisal',
    accountsToday: 42,
    otpsToday: 40,
    earnings: 600,
    avatar: '💎',
    badge: 'Rising',
  },
];

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentUserStats,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#0f1422] border border-[#232f45] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1c2538] bg-[#0a0e18]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Trophy className="w-4 h-4 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-none">
                Top Earners Board (লিডারবোর্ড)
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Today&apos;s highest active accounts & payouts
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

        {/* User Card status */}
        <div className="p-3.5 mx-4 mt-4 rounded-xl bg-gradient-to-r from-indigo-950/80 to-[#141d33] border border-indigo-700/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Your Current Rank</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 font-mono">
                  #7
                </span>
              </div>
              <div className="text-[11px] text-slate-300">
                {currentUserStats.accountsCreated} accounts · {currentUserStats.otps} OTPs
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-black text-emerald-400">
              ৳{currentUserStats.balance}
            </span>
            <div className="text-[10px] text-slate-400">Balance</div>
          </div>
        </div>

        {/* Leaderboard List */}
        <div className="p-4 overflow-y-auto flex flex-col gap-2.5 custom-scrollbar">
          {SAMPLE_LEADERS.map((leader) => {
            let rankIcon = (
              <span className="w-6 h-6 rounded-full bg-[#162033] text-slate-400 text-xs font-bold flex items-center justify-center font-mono">
                {leader.rank}
              </span>
            );

            if (leader.rank === 1) {
              rankIcon = (
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center border border-amber-500/40">
                  <Medal className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                </span>
              );
            } else if (leader.rank === 2) {
              rankIcon = (
                <span className="w-6 h-6 rounded-full bg-slate-400/20 text-slate-300 text-xs font-bold flex items-center justify-center border border-slate-400/40">
                  <Medal className="w-3.5 h-3.5 text-slate-300 fill-slate-300" />
                </span>
              );
            } else if (leader.rank === 3) {
              rankIcon = (
                <span className="w-6 h-6 rounded-full bg-amber-800/20 text-amber-600 text-xs font-bold flex items-center justify-center border border-amber-700/40">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                </span>
              );
            }

            return (
              <div
                key={leader.rank}
                className="p-3 rounded-xl bg-[#0a0e18] border border-[#1b2538] flex items-center justify-between hover:border-[#28364f] transition-all"
              >
                <div className="flex items-center gap-3">
                  {rankIcon}
                  <div className="text-lg">{leader.avatar}</div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{leader.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({leader.location})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {leader.accountsToday} accs · {leader.otpsToday} OTPs
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs sm:text-sm font-bold text-emerald-400 flex items-center gap-1 justify-end">
                    <span>৳{leader.earnings}</span>
                  </div>
                  <span className="text-[10px] text-amber-400/90 font-medium flex items-center gap-0.5 justify-end">
                    <Flame className="w-2.5 h-2.5 text-amber-400" />
                    <span>{leader.badge}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
