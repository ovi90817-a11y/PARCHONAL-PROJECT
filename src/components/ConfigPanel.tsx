import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Play, Globe, Sparkles, RefreshCw, Languages, PhoneCall, Plus, Check, CheckCircle2 } from 'lucide-react';
import { REGIONS, LANGUAGES } from '../data/numberRanges';
import { NumberRange, RegionOption, LanguageOption } from '../types';

interface ConfigPanelProps {
  numberRanges: NumberRange[];
  selectedRange: NumberRange;
  onSelectRange: (range: NumberRange) => void;
  regions?: RegionOption[];
  selectedRegion: string;
  onSelectRegion: (regId: string) => void;
  languages?: LanguageOption[];
  selectedLanguage?: string;
  onSelectLanguage?: (langId: string) => void;
  password: string;
  onChangePassword: (val: string) => void;
  accountCount: number;
  onChangeAccountCount: (count: number) => void;
  isProcessing: boolean;
  onStartBatch: () => void;
  subBannerText?: string;
  customPhoneInput?: string;
  onChangeCustomPhone?: (val: string) => void;
  lastCreatedNotice?: string;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  numberRanges,
  selectedRange,
  onSelectRange,
  regions = REGIONS,
  selectedRegion,
  onSelectRegion,
  languages = LANGUAGES,
  selectedLanguage = 'bn',
  onSelectLanguage,
  password,
  onChangePassword,
  accountCount,
  onChangeAccountCount,
  isProcessing,
  onStartBatch,
  subBannerText = 'Unlimited Create · যত ইচ্ছা তত তৈরি করুন',
  customPhoneInput = '',
  onChangeCustomPhone,
  lastCreatedNotice = '',
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when a new account is created so the user can immediately paste/type next number
  useEffect(() => {
    if (lastCreatedNotice && phoneInputRef.current) {
      phoneInputRef.current.focus();
    }
  }, [lastCreatedNotice]);

  const handleGeneratePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
    let res = '';
    for (let i = 0; i < 9; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    onChangePassword(res);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      {/* Ready / Unlimited Create Sub-banner */}
      <div className="text-center py-2">
        <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-0.5">
          Ready
        </div>
        <div className="text-sm sm:text-base font-semibold text-emerald-400/90 flex items-center justify-center gap-1.5">
          <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>{subBannerText}</span>
        </div>
      </div>

      {/* Main Configuration Card */}
      <div className="rounded-2xl bg-[#0f1422] border border-[#1e2738] p-4 sm:p-5 shadow-xl shadow-black/40">
        <div className="text-base font-bold text-slate-100 mb-4 tracking-tight flex items-center justify-between">
          <span>Phone — Configuration</span>
          <span className="text-[11px] font-normal text-emerald-400/80 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-md">
            Gateway Online
          </span>
        </div>

        {/* Password Field */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-300">
              Password
            </label>
            <button
              type="button"
              onClick={handleGeneratePassword}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Random</span>
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => onChangePassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full bg-[#090d16] border border-[#232f45] rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 transition-all pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Region & Language Fields (Separate Options) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* 1. Region Selector */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>Region (অঞ্চল / দেশ)</span>
            </label>
            <div className="relative">
              <select
                value={selectedRegion}
                onChange={(e) => onSelectRegion(e.target.value)}
                className="w-full bg-[#090d16] border border-[#232f45] rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 appearance-none cursor-pointer pr-8"
              >
                {regions.map((reg) => (
                  <option key={reg.id} value={reg.id} className="bg-[#0f1422] text-slate-200">
                    {reg.flag} {reg.country}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* 2. Language Selector */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-teal-400" />
              <span>Language (ভাষা)</span>
            </label>
            <div className="relative">
              <select
                value={selectedLanguage}
                onChange={(e) => onSelectLanguage && onSelectLanguage(e.target.value)}
                className="w-full bg-[#090d16] border border-[#232f45] rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 appearance-none cursor-pointer pr-8"
              >
                {languages.map((lang) => (
                  <option key={lang.id} value={lang.id} className="bg-[#0f1422] text-slate-200">
                    {lang.flag} {lang.name} ({lang.nativeName})
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Number Ranges */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs sm:text-sm font-medium text-slate-300">
              Number Ranges
            </label>
            <button
              type="button"
              onClick={() => setAutoRotate(!autoRotate)}
              className={`text-[11px] font-mono px-2 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer ${
                autoRotate
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <span>auto 3s</span>
              {autoRotate && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>}
            </button>
          </div>

          {/* Grid of Country Chips matching screenshot layout */}
          <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
            {numberRanges.map((range) => {
              const isSelected = selectedRange.id === range.id;
              return (
                <button
                  key={range.id}
                  type="button"
                  onClick={() => onSelectRange(range)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#4f46e5] to-[#4338ca] text-white border-indigo-400 shadow-md shadow-indigo-900/40 font-medium'
                      : 'bg-[#090d16]/90 hover:bg-[#141b2b] text-slate-300 border-[#1f293d]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    <span className="text-sm shrink-0">{range.flag}</span>
                    <span className="text-xs truncate">{range.country}</span>
                  </div>
                  <span
                    className={`text-[11px] font-mono shrink-0 ${
                      isSelected ? 'text-indigo-100 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {range.pattern}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Phone Number Input for Account Creation (নাম্বার রেঞ্জের নিচে একাউন্ট তৈরির নাম্বার) */}
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-b from-[#0f172a] to-[#090e1a] border-2 border-indigo-500/40 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5">
              <PhoneCall className="w-4 h-4 text-amber-400" />
              <span>Enter Phone Number for Account (একাউন্ট তৈরির নাম্বার দিন)</span>
            </label>
            <span className="text-[10px] text-amber-300 font-mono bg-amber-950/60 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {customPhoneInput.trim().length >= 6 ? 'Ready to Create' : 'Waiting for Number'}
            </span>
          </div>

          <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
            এখানে যে নাম্বারটি দেবেন, সেই নাম্বার দিয়ে সাথে সাথে একাউন্ট তৈরি হয়ে যাবে এবং কোড আসার পর তা দিয়ে একাউন্ট কনফার্ম করতে পারবেন। প্রতিবার একাউন্ট তৈরি সম্পন্ন হওয়ার পর স্বয়ংক্রিয়ভাবে পরবর্তী নতুন নাম্বার চাইবে।
          </p>

          <div className="flex flex-col gap-2">
            <div className="relative">
              <input
                ref={phoneInputRef}
                type="text"
                value={customPhoneInput}
                onChange={(e) => onChangeCustomPhone && onChangeCustomPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customPhoneInput.trim().length >= 6 && !isProcessing) {
                    onStartBatch();
                  }
                }}
                placeholder="পরবর্তী একাউন্টের জন্য নাম্বার দিন (যেমন: +88017xxxxxxxx বা 017xxxxxxxx)"
                className="w-full bg-[#060912] border-2 border-indigo-500/50 focus:border-emerald-400 rounded-xl px-4 py-3 text-sm sm:text-base font-mono text-emerald-300 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all pr-10 shadow-inner"
              />
              {customPhoneInput && (
                <button
                  type="button"
                  onClick={() => onChangeCustomPhone && onChangeCustomPhone('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-sm px-1 cursor-pointer"
                  title="Clear number"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Notification / Prompt for next number */}
            {lastCreatedNotice ? (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{lastCreatedNotice}</span>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                <span>নাম্বার লিখে নিচের বাটনে চাপুন অথবা কীবোর্ডে Enter প্রেস করুন।</span>
              </div>
            )}
          </div>
        </div>

        {/* How many accounts? */}
        <div className="mb-5">
          <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">
            How many accounts?
          </label>
          <div className="grid grid-cols-3 gap-2 bg-[#090d16] p-1 rounded-xl border border-[#232f45]">
            {[1, 2, 3].map((count) => {
              const isActive = accountCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => onChangeAccountCount(count)}
                  className={`py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#4f46e5] text-white shadow-md shadow-indigo-950'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#151c2e]'
                  }`}
                >
                  {count}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Create Account / Action Button */}
        <button
          onClick={onStartBatch}
          disabled={isProcessing}
          type="button"
          className={`w-full py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-extrabold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
            isProcessing
              ? 'bg-[#312e81] text-indigo-300 cursor-not-allowed opacity-80'
              : customPhoneInput.trim().length >= 6
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/60 active:scale-[0.99] border border-emerald-400/40'
              : 'bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-indigo-950/60 active:scale-[0.99]'
          }`}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
              <span>Creating Account with Number...</span>
            </>
          ) : customPhoneInput.trim().length >= 6 ? (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Create Account with {customPhoneInput} (একাউন্ট তৈরি করুন)</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Create Account / Request Live Number {accountCount > 1 ? `(${accountCount})` : ''}</span>
            </>
          )}
        </button>

        {!customPhoneInput && (
          <p className="text-center text-[11px] text-slate-400 -mt-2">
            💡 উপরে আপনার নাম্বার লিখলে সেই নাম্বারে সরাসরি একাউন্ট তৈরি হবে এবং কোড চাওয়া হবে।
          </p>
        )}
      </div>
    </div>
  );
};
