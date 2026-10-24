import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  DollarSign,
  Cpu,
  CreditCard,
  Type,
  Globe2,
  ListOrdered,
  Languages,
  Eye,
  EyeOff,
  ShieldAlert,
  LogOut,
  Sparkles,
  Smartphone,
  Server,
  Wifi,
  RefreshCw,
  CheckCircle2,
  Send,
  KeyRound,
  Laptop,
  Copy,
  Check,
  Ban,
  UserCheck,
  PowerOff,
  History,
  Search,
  ShieldCheck,
  Clock,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  AppSettings,
  NumberRange,
  OtpPanelConfig,
  PaymentMethodConfig,
  RegionOption,
  WithdrawRecord,
  LicenseRecord,
  LicenseDuration,
  LicenseStatus,
  DeviceActivationRecord,
  DeviceStatus,
  AuditLogRecord,
} from '../../types';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  numberRanges: NumberRange[];
  onUpdateNumberRanges: (ranges: NumberRange[]) => void;
  regions: RegionOption[];
  onUpdateRegions: (regions: RegionOption[]) => void;
  paymentMethods: PaymentMethodConfig[];
  onUpdatePaymentMethods: (methods: PaymentMethodConfig[]) => void;
  currentBalance: number;
  onSetBalance: (newBalance: number) => void;
  withdrawHistory: WithdrawRecord[];
  onUpdateWithdrawHistory: (history: WithdrawRecord[]) => void;
  onToast: (msg: string) => void;
  onPushCustomOtp?: (phoneNumber: string, code: string) => void;
}

type AdminTab =
  | 'licenses'
  | 'devices'
  | 'otp_panel'
  | 'countries'
  | 'regions'
  | 'rates'
  | 'gateway'
  | 'payments'
  | 'branding'
  | 'withdrawals'
  | 'audit';

const ADMIN_USERNAME = 'oxz_kira99';
const ADMIN_PASSWORD = 'oxybbz9884';

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  numberRanges,
  onUpdateNumberRanges,
  regions,
  onUpdateRegions,
  paymentMethods,
  onUpdatePaymentMethods,
  currentBalance,
  onSetBalance,
  withdrawHistory,
  onUpdateWithdrawHistory,
  onToast,
  onPushCustomOtp,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('licenses');

  // Security gate states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  // License & Device states
  const [licensesList, setLicensesList] = useState<LicenseRecord[]>([]);
  const [devicesList, setDevicesList] = useState<DeviceActivationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [adminStats, setAdminStats] = useState<{
    totalKeys: number;
    available: number;
    activated: number;
    expired: number;
    revoked: number;
    totalDevices: number;
    activeDevices: number;
    suspendedDevices: number;
  } | null>(null);

  const [licenseStatusFilter, setLicenseStatusFilter] = useState<'ALL' | LicenseStatus>('ALL');
  const [licenseSearch, setLicenseSearch] = useState('');
  const [deviceStatusFilter, setDeviceStatusFilter] = useState<'ALL' | DeviceStatus>('ALL');
  const [deviceSearch, setDeviceSearch] = useState('');

  // Key generator states
  const [newKeyDuration, setNewKeyDuration] = useState<LicenseDuration>('30d');
  const [newKeyMaxDevices, setNewKeyMaxDevices] = useState<number>(1);
  const [newKeyNote, setNewKeyNote] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [generatedKeyModal, setGeneratedKeyModal] = useState<{ rawKey: string; license: LicenseRecord } | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingLicense, setIsDeletingLicense] = useState(false);

  // Local settings draft
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  // OTP Panel states
  const [bulkNumberInput, setBulkNumberInput] = useState('');
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiPingResult, setApiPingResult] = useState<{
    status: string;
    balance: string;
    ping: number;
    raw?: string;
    isError?: boolean;
    message?: string;
    httpStatus?: number;
    requestedUrl?: string;
  } | null>(null);
  const [realProviderOrders, setRealProviderOrders] = useState<any[]>([]);

  // Manual push OTP states
  const [pushPhoneInput, setPushPhoneInput] = useState('');
  const [pushCodeInput, setPushCodeInput] = useState('');

  // Country form states
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryCode, setNewCountryCode] = useState('');
  const [newFlag, setNewFlag] = useState('🌐');
  const [newPrefix, setNewPrefix] = useState('+');
  const [newPattern, setNewPattern] = useState('');
  const [newDigits, setNewDigits] = useState(10);
  const [alsoAddToRegions, setAlsoAddToRegions] = useState(true);

  // Region / Language form states
  const [newRegCountry, setNewRegCountry] = useState('');
  const [newRegFlag, setNewRegFlag] = useState('🌐');
  const [newRegLang, setNewRegLang] = useState('');
  const [newRegCode, setNewRegCode] = useState('');

  // Quick balance state
  const [customBalanceInput, setCustomBalanceInput] = useState(currentBalance.toString());

  // Payment method form
  const [newPayName, setNewPayName] = useState('');
  const [newPayBadge, setNewPayBadge] = useState('');

  const getAdminHeaders = () => ({
    'Content-Type': 'application/json',
    'x-admin-auth': btoa(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`),
  });

  const fetchAdminData = async () => {
    try {
      const headers = getAdminHeaders();
      const [statsRes, licRes, devRes, auditRes, smsCfgRes, smsOrdRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/licenses', { headers }),
        fetch('/api/admin/devices', { headers }),
        fetch('/api/admin/audit-logs', { headers }),
        fetch('/api/admin/sms/config', { headers }),
        fetch('/api/admin/sms/orders', { headers }),
      ]);
      if (statsRes.ok) setAdminStats(await statsRes.json());
      if (licRes.ok) setLicensesList(await licRes.json());
      if (devRes.ok) setDevicesList(await devRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
      if (smsCfgRes.ok) {
        const smsCfg = await smsCfgRes.json();
        setLocalSettings((prev) => ({
          ...prev,
          otpPanel: {
            ...prev.otpPanel,
            providerName: smsCfg.providerName || prev.otpPanel?.providerName || 'SMS-Activate',
            apiUrl: smsCfg.apiUrl || prev.otpPanel?.apiUrl || '',
            serviceCode: smsCfg.serviceCode || prev.otpPanel?.serviceCode || 'fb',
            countryCode: smsCfg.countryCode || prev.otpPanel?.countryCode || 'all',
            status: smsCfg.status || prev.otpPanel?.status || 'NOT_CONFIGURED',
            apiKey: smsCfg.apiKeyMasked || prev.otpPanel?.apiKey || '',
          },
        }));
      }
      if (smsOrdRes.ok) setRealProviderOrders(await smsOrdRes.json());
    } catch (err) {
      console.error('Failed to load admin license and SMS data:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isOpen) {
      fetchAdminData();
    }
  }, [isAuthenticated, isOpen]);

  // Tab navigation scroll reference & smooth controls
  const tabNavRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabNavRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      tabNavRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Keep active tab centered in horizontal view on mobile/tablet/desktop
  useEffect(() => {
    if (tabNavRef.current && isAuthenticated) {
      const activeBtn = tabNavRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`);
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab, isAuthenticated]);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingKey(true);
    try {
      const res = await fetch('/api/admin/licenses/generate', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          duration: newKeyDuration,
          maxDevices: newKeyMaxDevices,
          note: newKeyNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(`Error generating key: ${data.error || 'Failed'}`);
        setIsGeneratingKey(false);
        return;
      }
      setGeneratedKeyModal(data);
      setNewKeyNote('');
      onToast('✅ New cryptographic license key created!');
      fetchAdminData();
    } catch {
      onToast('Failed to contact server for key generation');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleRevokeLicense = async (id: string, keyMask: string) => {
    if (
      !window.confirm(
        `Are you sure you want to revoke license ${keyMask}? All active device sessions using this key will immediately be suspended.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/licenses/${id}/revoke`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ reason: 'Revoked by administrator' }),
      });
      if (res.ok) {
        onToast(`License ${keyMask} revoked successfully.`);
        fetchAdminData();
      } else {
        const data = await res.json();
        onToast(`Failed to revoke: ${data.error || 'Unknown error'}`);
      }
    } catch {
      onToast('Network error while revoking license');
    }
  };

  const handleDeleteLicense = async (id: string, keyMask: string) => {
    setIsDeletingLicense(true);
    try {
      const res = await fetch(`/api/admin/licenses/${id}/delete`, {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        onToast(`License ${keyMask} permanently deleted.`);
        setConfirmDeleteId(null);
        fetchAdminData();
      } else {
        const data = await res.json();
        onToast(`Failed to delete: ${data.error || 'Unknown error'}`);
      }
    } catch {
      onToast('Network error while deleting license');
    } finally {
      setIsDeletingLicense(false);
    }
  };

  const handleClearInactiveLicenses = async () => {
    const inactiveIds = licensesList
      .filter((l) => l.status === 'REVOKED' || l.status === 'EXPIRED')
      .map((l) => l.id);

    if (inactiveIds.length === 0) {
      onToast('No expired or revoked licenses to remove.');
      return;
    }

    try {
      const res = await fetch('/api/admin/licenses/batch-delete', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ licenseIds: inactiveIds }),
      });
      if (res.ok) {
        const data = await res.json();
        onToast(`Removed ${data.deletedCount || inactiveIds.length} inactive licenses.`);
        fetchAdminData();
      } else {
        onToast('Failed to batch delete licenses.');
      }
    } catch {
      onToast('Network error while clearing licenses.');
    }
  };

  const handleUpdateDeviceStatus = async (deviceId: string, status: DeviceStatus) => {
    try {
      const res = await fetch(`/api/admin/devices/${deviceId}/status`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        onToast(`Device status changed to ${status}`);
        fetchAdminData();
      } else {
        onToast('Failed to update device status');
      }
    } catch {
      onToast('Network error updating device');
    }
  };

  const handleCopyKey = (keyString: string, id: string) => {
    navigator.clipboard.writeText(keyString);
    setCopiedKeyId(id);
    onToast(`Copied: ${keyString}`);
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  if (!isOpen) return null;

  // Handle Admin Login Verification
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUsername.trim() === ADMIN_USERNAME && inputPassword.trim() === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError('');
      onToast('Admin verified! Welcome, oxz_kira.');
    } else {
      setAuthError('ভুল ইউজারনেম বা পাসওয়ার্ড! প্রবেশাধিকার বাতিল (Access Denied).');
    }
  };

  const handleAdminLogout = () => {
    setIsAuthenticated(false);
    setInputUsername('');
    setInputPassword('');
    setAuthError('');
    onToast('Admin locked.');
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/admin/sms/config', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          providerName: localSettings.otpPanel?.providerName,
          apiUrl: localSettings.otpPanel?.apiUrl,
          apiKey: localSettings.otpPanel?.apiKey,
          serviceCode: localSettings.otpPanel?.serviceCode,
          countryCode: localSettings.otpPanel?.countryCode,
        }),
      });
      if (res.ok) {
        onUpdateSettings(localSettings);
        onToast('Settings saved & synced to secure server!');
        fetchAdminData();
      } else {
        onUpdateSettings(localSettings);
        onToast('Settings saved locally.');
      }
    } catch {
      onUpdateSettings(localSettings);
      onToast('Settings saved locally.');
    }
  };

  // Test Real SMS Gateway API
  const handleTestSmsApi = async () => {
    setIsTestingApi(true);
    setApiPingResult(null);
    try {
      const res = await fetch('/api/admin/sms/test', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          apiUrl: localSettings.otpPanel?.apiUrl,
          apiKey: localSettings.otpPanel?.apiKey,
          providerName: localSettings.otpPanel?.providerName,
        }),
      });
      const data = await res.json();
      setIsTestingApi(false);
      setApiPingResult({
        status: data.status || (data.success ? 'ONLINE' : 'ERROR'),
        balance: data.balance || (data.success ? 'Connected' : 'Unavailable'),
        ping: data.pingMs || 0,
        raw: data.rawResponse || '',
        isError: !data.success,
        message: data.message,
        httpStatus: data.httpStatus,
        requestedUrl: data.requestedUrl || localSettings.otpPanel?.apiUrl,
      });
      if (data.success) {
        onToast(`API Connected! Live Balance: ${data.balance}`);
      } else {
        onToast(`Provider Test: ${data.httpStatus ? `HTTP ${data.httpStatus} - ` : ''}${data.message}`);
      }
      fetchAdminData();
    } catch (err: any) {
      setIsTestingApi(false);
      setApiPingResult({
        status: 'ERROR',
        balance: 'Failed',
        ping: 0,
        isError: true,
        message: `Network error reaching backend: ${err.message}`,
      });
      onToast('Failed to reach backend test route');
    }
  };

  // Add numbers to pool (manual SIM reserve)
  const handleAddBulkNumbers = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkNumberInput.trim()) return;

    const lines = bulkNumberInput
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length >= 8);

    if (lines.length === 0) {
      alert('Please enter valid numbers (e.g., +12025550198 or +88017XXXXXXXX).');
      return;
    }

    const currentPool = localSettings.otpPanel?.customNumberPool || [];
    const updatedPool = Array.from(new Set([...currentPool, ...lines]));

    const updatedSettings: AppSettings = {
      ...localSettings,
      otpPanel: {
        ...localSettings.otpPanel,
        customNumberPool: updatedPool,
      },
    };

    setLocalSettings(updatedSettings);
    onUpdateSettings(updatedSettings);
    setBulkNumberInput('');
    onToast(`Added ${lines.length} numbers to the reserve pool!`);
  };

  // Remove number from pool
  const handleRemoveNumberFromPool = (numToRemove: string) => {
    const currentPool = localSettings.otpPanel?.customNumberPool || [];
    const updatedPool = currentPool.filter((n) => n !== numToRemove);

    const updatedSettings: AppSettings = {
      ...localSettings,
      otpPanel: {
        ...localSettings.otpPanel,
        customNumberPool: updatedPool,
      },
    };

    setLocalSettings(updatedSettings);
    onUpdateSettings(updatedSettings);
    onToast('Number removed from pool.');
  };

  // Add new country range
  const handleAddCountry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCountryName.trim() || !newPattern.trim()) {
      alert('Please fill out Country Name and Pattern.');
      return;
    }

    const rangeId = `custom-${Date.now()}`;
    const cleanCode = newCountryCode.toUpperCase() || 'XX';
    const newRange: NumberRange = {
      id: rangeId,
      country: `${newCountryName}-${cleanCode}`,
      countryCode: cleanCode,
      flag: newFlag.trim() || '🌐',
      prefix: newPrefix.startsWith('+') ? newPrefix : `+${newPrefix}`,
      pattern: newPattern.trim(),
      totalDigits: Number(newDigits) || 10,
      enabled: true,
    };

    onUpdateNumberRanges([newRange, ...numberRanges]);

    if (alsoAddToRegions) {
      const regId = `${cleanCode.toLowerCase()}-${Date.now().toString().slice(-4)}`;
      const newReg: RegionOption = {
        id: regId,
        label: `${newCountryName}`,
        flag: newFlag.trim() || '🌐',
        lang: newCountryName,
        country: newCountryName,
        countryCode: cleanCode,
      };
      if (!regions.some((r) => r.country.toLowerCase() === newCountryName.toLowerCase())) {
        onUpdateRegions([...regions, newReg]);
      }
    }

    onToast(`Added new country range: ${newRange.country}`);
    setNewCountryName('');
    setNewCountryCode('');
    setNewPattern('');
  };

  const handleDeleteCountry = (id: string) => {
    if (numberRanges.length <= 1) {
      alert('You must keep at least 1 country range.');
      return;
    }
    const filtered = numberRanges.filter((r) => r.id !== id);
    onUpdateNumberRanges(filtered);
    onToast('Country range removed.');
  };

  // Add new Region
  const handleAddRegion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegCountry.trim()) {
      alert('Please fill out Country.');
      return;
    }

    const cleanCode = newRegCode.toUpperCase() || 'XX';
    const newReg: RegionOption = {
      id: `reg-${Date.now()}`,
      label: `${newRegCountry}`,
      flag: newRegFlag.trim() || '🌐',
      lang: newRegLang.trim() || 'Default',
      country: newRegCountry.trim(),
      countryCode: cleanCode,
    };

    onUpdateRegions([...regions, newReg]);
    onToast(`Added Region: ${newReg.label}`);
    setNewRegCountry('');
    setNewRegLang('');
    setNewRegCode('');
  };

  const handleDeleteRegion = (id: string) => {
    if (regions.length <= 1) {
      alert('At least 1 region must remain.');
      return;
    }
    onUpdateRegions(regions.filter((r) => r.id !== id));
    onToast('Region removed.');
  };

  // Update payment methods
  const handleTogglePaymentMethod = (id: string) => {
    const updated = paymentMethods.map((m) =>
      m.id === id ? { ...m, enabled: !m.enabled } : m
    );
    onUpdatePaymentMethods(updated);
    onToast('Payment method updated.');
  };

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayName.trim()) return;
    const newM: PaymentMethodConfig = {
      id: `pay-${Date.now()}`,
      name: newPayName.trim(),
      badge: newPayBadge.trim() || newPayName.trim(),
      enabled: true,
    };
    onUpdatePaymentMethods([...paymentMethods, newM]);
    setNewPayName('');
    setNewPayBadge('');
    onToast(`Added payment method: ${newM.name}`);
  };

  const handleDeletePaymentMethod = (id: string) => {
    if (paymentMethods.length <= 1) {
      alert('At least 1 payment method required.');
      return;
    }
    onUpdatePaymentMethods(paymentMethods.filter((m) => m.id !== id));
  };

  // Update withdrawal status
  const handleUpdateWithdrawStatus = (trxId: string, status: WithdrawRecord['status']) => {
    const updated = withdrawHistory.map((w) =>
      w.trxId === trxId ? { ...w, status } : w
    );
    onUpdateWithdrawHistory(updated);
    onToast(`Transaction ${trxId} marked as ${status}`);
  };

  const pool = localSettings.otpPanel?.customNumberPool || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl h-[95vh] sm:h-[90vh] max-h-[96dvh] bg-[#0d121f] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative z-10">
        {/* Top Header */}
        <div className="shrink-0 z-20 flex items-center justify-between px-3 sm:px-5 py-3 border-b border-[#1f293d] bg-[#090d17]">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <h3 className="text-xs sm:text-base font-extrabold text-white truncate">
                Super Admin Panel
              </h3>
              {isAuthenticated ? (
                <span className="shrink-0 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Unlocked: oxz_kira99
                </span>
              ) : (
                <span className="shrink-0 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Protected
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1.5">
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleAdminLogout}
                title="Lock Admin Panel"
                className="text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-900/50 px-2 sm:px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Lock</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1a2334] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 shrink-0" />
            </button>
          </div>
        </div>

        {/* SECURITY AUTHENTICATION GATE */}
        {!isAuthenticated ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-8 flex flex-col items-center justify-center text-center my-auto custom-scrollbar">
            <h3 className="text-lg font-black text-white tracking-tight mb-1">
              Admin Access Verification
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6">
              প্যানেলে প্রবেশ করতে আপনার সিক্রেট অ্যাডমিন ইউজারনেম ও পাসওয়ার্ড লিখুন।
            </p>

            <form onSubmit={handleAdminLogin} className="w-full max-w-xs flex flex-col gap-3 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter username"
                  value={inputUsername}
                  onChange={(e) => {
                    setInputUsername(e.target.value);
                    setAuthError('');
                  }}
                  className="w-full bg-[#050810] border border-[#23314d] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password"
                    value={inputPassword}
                    onChange={(e) => {
                      setInputPassword(e.target.value);
                      setAuthError('');
                    }}
                    className="w-full bg-[#050810] border border-[#23314d] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-sm shadow-lg shadow-amber-950/60 transition-all cursor-pointer mt-2 active:scale-95"
              >
                Verify & Enter Admin
              </button>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED ADMIN DASHBOARD */
          <>
            {/* Navigation Tabs */}
            <div className="relative shrink-0 z-20 border-b border-[#1f293d] bg-[#070b14] w-full min-w-0">
              {/* Left scroll chevron button */}
              <button
                type="button"
                onClick={() => scrollTabs('left')}
                aria-label="Scroll tabs left"
                className="hidden sm:flex absolute left-0 top-0 bottom-0 z-20 items-center justify-center px-2 bg-gradient-to-r from-[#070b14] via-[#070b14]/90 to-transparent text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div
                ref={tabNavRef}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-9 py-2 overflow-x-auto scroll-smooth custom-scrollbar touch-scroll-x select-none w-full min-w-0"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {[
                  { id: 'licenses', label: `🔑 License Keys (${adminStats?.totalKeys ?? licensesList.length})`, icon: KeyRound },
                  { id: 'devices', label: `💻 Devices (${adminStats?.activeDevices ?? devicesList.length})`, icon: Laptop },
                  { id: 'otp_panel', label: `📱 OTP SMS Panel (${pool.length})`, icon: Smartphone },
                  { id: 'countries', label: 'Country Ranges', icon: Globe2 },
                  { id: 'regions', label: `Regions (${regions.length})`, icon: Languages },
                  { id: 'rates', label: 'Rates & Balance', icon: DollarSign },
                  { id: 'gateway', label: 'Gateway Settings', icon: Cpu },
                  { id: 'payments', label: 'Payments', icon: CreditCard },
                  { id: 'branding', label: 'Branding', icon: Type },
                  { id: 'withdrawals', label: `Payouts (${withdrawHistory.length})`, icon: ListOrdered },
                  { id: 'audit', label: `📜 Audit Logs (${auditLogs.length})`, icon: History },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      data-tab-id={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as AdminTab)}
                      className={`shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold whitespace-nowrap rounded-lg transition-all cursor-pointer border ${
                        isActive
                          ? 'border-amber-400/80 text-amber-400 bg-[#0f1524] shadow-sm shadow-amber-500/10'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#0c101d]'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className="shrink-0">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Right scroll chevron button */}
              <button
                type="button"
                onClick={() => scrollTabs('right')}
                aria-label="Scroll tabs right"
                className="hidden sm:flex absolute right-0 top-0 bottom-0 z-20 items-center justify-center px-2 bg-gradient-to-l from-[#070b14] via-[#070b14]/90 to-transparent text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 custom-scrollbar bg-[#0b101c]/50">
              {/* TAB: LICENSE KEY MANAGEMENT */}
              {activeTab === 'licenses' && (
                <div className="flex flex-col gap-5 text-xs">
                  {/* Status Overview Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3 rounded-xl bg-[#090e1c] border border-[#1b253b] flex flex-col">
                      <span className="text-[11px] text-slate-400">Total Keys</span>
                      <span className="text-xl font-black text-white mt-1">
                        {adminStats?.totalKeys ?? licensesList.length}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#08151f] border border-cyan-900/40 flex flex-col">
                      <span className="text-[11px] text-cyan-400 font-semibold">Available</span>
                      <span className="text-xl font-black text-cyan-300 mt-1">
                        {adminStats?.available ?? licensesList.filter((l) => l.status === 'AVAILABLE').length}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#081a14] border border-emerald-900/40 flex flex-col">
                      <span className="text-[11px] text-emerald-400 font-semibold">Activated</span>
                      <span className="text-xl font-black text-emerald-300 mt-1">
                        {adminStats?.activated ?? licensesList.filter((l) => l.status === 'ACTIVATED').length}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#14151b] border border-slate-800 flex flex-col">
                      <span className="text-[11px] text-slate-400 font-semibold">Expired</span>
                      <span className="text-xl font-black text-slate-300 mt-1">
                        {adminStats?.expired ?? licensesList.filter((l) => l.status === 'EXPIRED').length}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#1d0b10] border border-rose-900/40 flex flex-col col-span-2 sm:col-span-1">
                      <span className="text-[11px] text-rose-400 font-semibold">Revoked</span>
                      <span className="text-xl font-black text-rose-300 mt-1">
                        {adminStats?.revoked ?? licensesList.filter((l) => l.status === 'REVOKED').length}
                      </span>
                    </div>
                  </div>

                  {/* KEY GENERATOR SECTION */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0c1324] to-[#0a0f1d] border border-amber-500/30 flex flex-col gap-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-amber-400" />
                        <h4 className="font-extrabold text-white text-sm">
                          Generate Cryptographically Secure License Key
                        </h4>
                      </div>
                      <span className="text-[10px] text-amber-300/80 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/20">
                        Server-Side CSPRNG
                      </span>
                    </div>

                    <form onSubmit={handleGenerateKey} className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Duration Option */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                            Key Duration
                          </label>
                          <div className="grid grid-cols-4 gap-1.5 bg-[#050811] p-1 rounded-xl border border-[#1f2c47]">
                            {[
                              { id: '1d', label: '1 Day' },
                              { id: '7d', label: '7 Days' },
                              { id: '30d', label: '30 Days' },
                              { id: 'lifetime', label: 'Lifetime' },
                            ].map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => setNewKeyDuration(d.id as LicenseDuration)}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                                  newKeyDuration === d.id
                                    ? 'bg-amber-400 text-black shadow'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Device Limit */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                            <span>Permitted Devices</span>
                            <span className="text-[10px] text-slate-500">Default: 1 (Single-use)</span>
                          </label>
                          <select
                            value={newKeyMaxDevices}
                            onChange={(e) => setNewKeyMaxDevices(Number(e.target.value))}
                            className="w-full bg-[#050811] border border-[#1f2c47] rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-400"
                          >
                            <option value={1}>1 Device (Strict Single-Use)</option>
                            <option value={2}>2 Devices</option>
                            <option value={3}>3 Devices</option>
                            <option value={5}>5 Devices</option>
                            <option value={10}>10 Devices</option>
                          </select>
                        </div>

                        {/* Note / Member Tag */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                            Client / Note (Optional)
                          </label>
                          <input
                            type="text"
                            value={newKeyNote}
                            onChange={(e) => setNewKeyNote(e.target.value)}
                            placeholder="e.g. VIP Member / Ovi"
                            className="w-full bg-[#050811] border border-[#1f2c47] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                        <span className="text-[11px] text-slate-400">
                          Keys are generated with 128-bit high entropy and stored as salted SHA-256 hashes.
                        </span>
                        <button
                          type="submit"
                          disabled={isGeneratingKey}
                          className="shrink-0 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs shadow-lg shadow-amber-950/60 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isGeneratingKey ? 'Generating...' : 'Generate License Key'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* SEARCH AND FILTERS */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={licenseSearch}
                        onChange={(e) => setLicenseSearch(e.target.value)}
                        placeholder="Search by key mask, client note, member ID..."
                        className="w-full bg-[#050811] border border-[#1f2c47] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* Status filter tabs */}
                    <div className="flex items-center gap-1 bg-[#050811] p-1 rounded-xl border border-[#1f2c47] overflow-x-auto">
                      {(['ALL', 'AVAILABLE', 'ACTIVATED', 'EXPIRED', 'REVOKED'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setLicenseStatusFilter(st)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap ${
                            licenseStatusFilter === st
                              ? 'bg-[#1b2742] text-amber-300'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {st}
                        </button>
                      ))}

                      {licensesList.some((l) => l.status === 'REVOKED' || l.status === 'EXPIRED') && (
                        <button
                          type="button"
                          onClick={handleClearInactiveLicenses}
                          className="ml-auto px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                          title="Remove all expired and revoked keys permanently"
                        >
                          <Trash2 className="w-3 h-3 text-rose-400" />
                          <span>Clear Inactive ({licensesList.filter((l) => l.status === 'REVOKED' || l.status === 'EXPIRED').length})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* LICENSE KEYS TABLE / LIST */}
                  <div className="flex flex-col gap-2">
                    {licensesList
                      .filter((lic) => {
                        if (licenseStatusFilter !== 'ALL' && lic.status !== licenseStatusFilter) return false;
                        if (licenseSearch.trim()) {
                          const q = licenseSearch.trim().toLowerCase();
                          return (
                            lic.keyMask.toLowerCase().includes(q) ||
                            (lic.note && lic.note.toLowerCase().includes(q)) ||
                            (lic.assignedMemberId && lic.assignedMemberId.toLowerCase().includes(q))
                          );
                        }
                        return true;
                      })
                      .map((lic) => {
                        const isRevoked = lic.status === 'REVOKED';
                        const isExpired = lic.status === 'EXPIRED';
                        const isActivated = lic.status === 'ACTIVATED';

                        return (
                          <div
                            key={lic.id}
                            className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                              isRevoked
                                ? 'bg-[#12080a] border-rose-900/30 opacity-75'
                                : isExpired
                                ? 'bg-[#0d1017] border-slate-800 opacity-80'
                                : isActivated
                                ? 'bg-[#091122] border-blue-900/40'
                                : 'bg-[#0a0f1d] border-[#1b2742]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isRevoked
                                    ? 'bg-rose-950/60 text-rose-400'
                                    : isActivated
                                    ? 'bg-emerald-950/60 text-emerald-400'
                                    : 'bg-amber-950/60 text-amber-400'
                                }`}
                              >
                                <KeyRound className="w-4 h-4" />
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-white text-sm tracking-wider">
                                    {lic.keyMask}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyKey(lic.keyMask, lic.id)}
                                    title="Copy masked identifier"
                                    className="text-slate-500 hover:text-white transition-colors"
                                  >
                                    {copiedKeyId === lic.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  {lic.note && (
                                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-medium">
                                      {lic.note}
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-1">
                                  <span>
                                    Duration: <strong className="text-slate-200">{lic.duration}</strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Devices:{' '}
                                    <strong className="text-slate-200">
                                      {lic.activationCount} / {lic.maxDevices}
                                    </strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {lic.expiresAt
                                      ? `Expires: ${new Date(lic.expiresAt).toLocaleDateString()}`
                                      : 'Lifetime Access'}
                                  </span>
                                  {lic.assignedMemberId && (
                                    <>
                                      <span>•</span>
                                      <span className="text-indigo-400 font-mono">
                                        Member: {lic.assignedMemberId}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions and Status Badge */}
                            <div className="flex items-center gap-2.5 self-end sm:self-center">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  lic.status === 'AVAILABLE'
                                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                                    : lic.status === 'ACTIVATED'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : lic.status === 'EXPIRED'
                                    ? 'bg-slate-700/30 text-slate-400 border border-slate-700'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {lic.status}
                              </span>

                              {!isRevoked && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeLicense(lic.id, lic.keyMask)}
                                  className="px-2 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Revoke Key & Suspend Devices"
                                >
                                  <Ban className="w-3 h-3 text-amber-400" />
                                  <span>Revoke</span>
                                </button>
                              )}

                              {confirmDeleteId === lic.id ? (
                                <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-500/60 px-2 py-0.5 rounded-lg animate-in fade-in">
                                  <span className="text-[10px] text-rose-300 font-bold">মুছবেন?</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLicense(lic.id, lic.keyMask)}
                                    disabled={isDeletingLicense}
                                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] transition-colors cursor-pointer"
                                  >
                                    {isDeletingLicense ? '...' : 'হ্যাঁ'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors cursor-pointer"
                                  >
                                    না
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(lic.id)}
                                  className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Delete / Remove this license key permanently"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-400" />
                                  <span>Remove</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                    {licensesList.length === 0 && (
                      <div className="text-center py-10 text-slate-500">
                        <KeyRound className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                        <p>No license keys generated yet. Use the generator above to create one.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: DEVICE MANAGEMENT */}
              {activeTab === 'devices' && (
                <div className="flex flex-col gap-5 text-xs">
                  {/* Status Overview Metric Cards */}
                  <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-2.5 sm:gap-3">
                    <div className="p-3 rounded-xl bg-[#090e1c] border border-[#1b253b] flex flex-col">
                      <span className="text-[11px] text-slate-400">Total Registered Devices</span>
                      <span className="text-xl font-black text-white mt-1">
                        {adminStats?.totalDevices ?? devicesList.length}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#081a14] border border-emerald-900/40 flex flex-col">
                      <span className="text-[11px] text-emerald-400 font-semibold">Active Authorized</span>
                      <span className="text-xl font-black text-emerald-300 mt-1">
                        {adminStats?.activeDevices ?? devicesList.filter((d) => d.status === 'ACTIVE').length}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#1d0b10] border border-rose-900/40 flex flex-col">
                      <span className="text-[11px] text-rose-400 font-semibold">Suspended / Revoked</span>
                      <span className="text-xl font-black text-rose-300 mt-1">
                        {adminStats?.suspendedDevices ??
                          devicesList.filter((d) => d.status === 'SUSPENDED' || d.status === 'REVOKED').length}
                      </span>
                    </div>
                  </div>

                  {/* SEARCH AND FILTERS */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={deviceSearch}
                        onChange={(e) => setDeviceSearch(e.target.value)}
                        placeholder="Search by Device ID, Member ID, IP, or Key..."
                        className="w-full bg-[#050811] border border-[#1f2c47] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* Status filter tabs */}
                    <div className="flex items-center gap-1 bg-[#050811] p-1 rounded-xl border border-[#1f2c47] overflow-x-auto">
                      {(['ALL', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'DEACTIVATED'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setDeviceStatusFilter(st)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap ${
                            deviceStatusFilter === st
                              ? 'bg-[#1b2742] text-amber-300'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* DEVICES TABLE / LIST */}
                  <div className="flex flex-col gap-2">
                    {devicesList
                      .filter((dev) => {
                        if (deviceStatusFilter !== 'ALL' && dev.status !== deviceStatusFilter) return false;
                        if (deviceSearch.trim()) {
                          const q = deviceSearch.trim().toLowerCase();
                          return (
                            dev.installationId.toLowerCase().includes(q) ||
                            dev.memberId.toLowerCase().includes(q) ||
                            dev.licenseMask.toLowerCase().includes(q) ||
                            dev.ipAddress.toLowerCase().includes(q)
                          );
                        }
                        return true;
                      })
                      .map((dev) => {
                        const isActive = dev.status === 'ACTIVE';
                        const isSuspended = dev.status === 'SUSPENDED';

                        return (
                          <div
                            key={dev.id}
                            className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                              isActive
                                ? 'bg-[#091122] border-blue-900/40'
                                : isSuspended
                                ? 'bg-[#18150a] border-amber-900/40'
                                : 'bg-[#12080a] border-rose-900/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isActive
                                    ? 'bg-emerald-950/60 text-emerald-400'
                                    : isSuspended
                                    ? 'bg-amber-950/60 text-amber-400'
                                    : 'bg-rose-950/60 text-rose-400'
                                }`}
                              >
                                <Laptop className="w-4 h-4" />
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-sm">{dev.memberId}</span>
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                    ID: {dev.installationId.slice(0, 14)}...
                                  </span>
                                  <span className="text-[10px] font-mono text-amber-400/80 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/30">
                                    Key: {dev.licenseMask}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-1">
                                  <span>
                                    Client:{' '}
                                    <strong className="text-slate-300">
                                      {dev.deviceInfo?.browser || 'Browser'} on {dev.deviceInfo?.os || 'OS'}
                                    </strong>
                                  </span>
                                  <span>•</span>
                                  <span>IP: {dev.ipAddress}</span>
                                  <span>•</span>
                                  <span>
                                    Activated: {new Date(dev.activatedAt).toLocaleDateString()}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {dev.expiresAt
                                      ? `Expires: ${new Date(dev.expiresAt).toLocaleDateString()}`
                                      : 'Lifetime'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Actions & Status */}
                            <div className="flex items-center gap-2 self-end sm:self-center">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  isActive
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : isSuspended
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {dev.status}
                              </span>

                              {isActive ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateDeviceStatus(dev.id, 'SUSPENDED')}
                                  className="px-2.5 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Suspend access for this hardware device"
                                >
                                  <PowerOff className="w-3 h-3 text-amber-400" />
                                  <span>Suspend</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateDeviceStatus(dev.id, 'ACTIVE')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/40 text-emerald-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Restore and activate device"
                                >
                                  <UserCheck className="w-3 h-3 text-emerald-400" />
                                  <span>Activate</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleUpdateDeviceStatus(dev.id, 'REVOKED')}
                                className="px-2 py-1 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/30 text-rose-400 text-[11px] font-semibold transition-colors cursor-pointer"
                                title="Revoke Device"
                              >
                                <Ban className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    {devicesList.length === 0 && (
                      <div className="text-center py-10 text-slate-500">
                        <Laptop className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                        <p>No member devices registered yet. Devices are registered when keys are activated.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: AUDIT LOGS */}
              {activeTab === 'audit' && (
                <div className="flex flex-col gap-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-amber-400" />
                      <h4 className="font-bold text-white text-sm">License & Device Security Audit Logs</h4>
                    </div>
                    <span className="text-[11px] text-slate-400">Total Logs: {auditLogs.length}</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-[#090d18] border border-[#1b2539] flex flex-col gap-1 font-mono text-[11px]"
                      >
                        <div className="flex items-center justify-between text-slate-400">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/30 text-[10px]">
                              {log.action}
                            </span>
                            <span className="text-slate-300 font-bold">{log.actor}</span>
                          </div>
                          <span>{new Date(log.timestamp).toLocaleTimeString()} · {new Date(log.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-200 mt-1 font-sans">{log.details}</p>
                        <span className="text-[10px] text-slate-500">Target: {log.target} · IP: {log.ip}</span>
                      </div>
                    ))}

                    {auditLogs.length === 0 && (
                      <div className="text-center py-10 text-slate-500">
                        <History className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                        <p>No audit events logged yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: OTP SMS PANEL & VIRTUAL NUMBERS */}
              {activeTab === 'otp_panel' && (
                <div className="flex flex-col gap-5 text-xs">
                  {/* Feature Highlight Banner & Unlimited Stream Status */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/60 to-[#0d162b] border border-blue-500/40 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">
                          SMS Gateway & Unlimited Numbers Stream (আনলিমিটেড নাম্বার)
                        </h4>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        UNLIMITED ACTIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-200/90 leading-relaxed">
                      SMS প্যানেল থেকে <strong>বিরতিহীনভাবে আনলিমিটেড ভার্চুয়াল নাম্বার</strong> স্বয়ংক্রিয়ভাবে সরবরাহ করা হবে। প্রতিটি তৈরি হওয়া Facebook অ্যাকাউন্টে <strong>Phone/UID, Password, 2FA Secret এবং Cookie</strong> স্বয়ংক্রিয়ভাবে জেনারেট হবে এবং সরাসরি Facebook-এ লগইন করা যাবে।
                    </p>

                    {/* Quick 50 / 100 Unlimited Numbers generator */}
                    <div className="flex items-center gap-2 pt-1 border-t border-blue-900/40">
                      <span className="text-[11px] text-slate-300 font-semibold">Quick Unlimited Actions:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const countries = ['2010', '23762', '22465', '22507', '23274', '22901', '22897', '88017'];
                          const generated: string[] = [];
                          for (let i = 0; i < 50; i++) {
                            const p = countries[i % countries.length];
                            generated.push(`+${p}${Math.floor(100000 + Math.random() * 900000)}`);
                          }
                          const updated = Array.from(new Set([...pool, ...generated]));
                          const updatedSettings: AppSettings = {
                            ...localSettings,
                            otpPanel: { ...localSettings.otpPanel, customNumberPool: updated, unlimitedMode: true },
                          };
                          setLocalSettings(updatedSettings);
                          onUpdateSettings(updatedSettings);
                          onToast('50 Unlimited Virtual Numbers added to pool!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        +50 Numbers
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const countries = ['2010', '23762', '22465', '22507', '23274', '22901', '22897', '88017'];
                          const generated: string[] = [];
                          for (let i = 0; i < 100; i++) {
                            const p = countries[i % countries.length];
                            generated.push(`+${p}${Math.floor(100000 + Math.random() * 900000)}`);
                          }
                          const updated = Array.from(new Set([...pool, ...generated]));
                          const updatedSettings: AppSettings = {
                            ...localSettings,
                            otpPanel: { ...localSettings.otpPanel, customNumberPool: updated, unlimitedMode: true },
                          };
                          setLocalSettings(updatedSettings);
                          onUpdateSettings(updatedSettings);
                          onToast('100 Unlimited Virtual Numbers added to pool!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        +100 Numbers
                      </button>
                    </div>
                  </div>

                  {/* SMS Provider Connection Box */}
                  <div className="p-4 rounded-xl bg-[#090d18] border border-[#1f2a3f] flex flex-col gap-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white flex items-center gap-1.5">
                        <Server className="w-4 h-4 text-amber-400" />
                        <span>SMS Gateway / Provider Settings</span>
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {localSettings.otpPanel?.status || 'ONLINE'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Provider Service</label>
                        <select
                          value={localSettings.otpPanel?.providerName || 'SMS-Activate'}
                          onChange={(e) => {
                            const p = e.target.value;
                            let url = localSettings.otpPanel?.apiUrl || '';
                            if (p === 'MiahSMS') url = 'https://miahsms.com/bot/';
                            else if (p === 'SMS-Activate') url = 'https://api.sms-activate.org/stubs/handler_api.php';
                            else if (p === '5SIM') url = 'https://5sim.net/v1';
                            else if (p === 'DaisySMS') url = 'https://daisysms.com/stubs/handler_api.php';
                            else if (p === 'SMS-Hub') url = 'https://smshub.org/stubs/handler_api.php';
                            else if (p === 'SMSPVA') url = 'https://smspva.com/priemnik.php';
                            setLocalSettings({
                              ...localSettings,
                              otpPanel: { ...localSettings.otpPanel, providerName: p, apiUrl: url },
                            });
                          }}
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-2 text-white"
                        >
                          <option value="MiahSMS">MiahSMS (miahsms.com)</option>
                          <option value="SMS-Activate">SMS-Activate.org (handler_api.php)</option>
                          <option value="5SIM">5SIM.net (REST v1 API)</option>
                          <option value="DaisySMS">DaisySMS.com (handler_api.php)</option>
                          <option value="SMSPVA">SMSPVA.com (handler_api)</option>
                          <option value="SMS-Hub">SMS-Hub.org (handler_api.php)</option>
                          <option value="Custom API">Custom HTTP SMS Gateway</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Target Service Code</label>
                        <input
                          type="text"
                          value={localSettings.otpPanel?.serviceCode || 'fb'}
                          onChange={(e) =>
                            setLocalSettings({
                              ...localSettings,
                              otpPanel: { ...localSettings.otpPanel, serviceCode: e.target.value },
                            })
                          }
                          placeholder="e.g. fb (Facebook), tg, wa, go, ig"
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-2 text-white font-mono"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-slate-400 mb-1">API Endpoint URL</label>
                        <input
                          type="text"
                          value={localSettings.otpPanel?.apiUrl || ''}
                          onChange={(e) =>
                            setLocalSettings({
                              ...localSettings,
                              otpPanel: { ...localSettings.otpPanel, apiUrl: e.target.value },
                            })
                          }
                          placeholder="https://api.sms-activate.org/stubs/handler_api.php"
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-2 text-white font-mono"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-slate-400 mb-1 flex items-center justify-between">
                          <span>API Secret Key / Token</span>
                          <span className="text-[10px] text-amber-400">Strictly Stored Server-Side</span>
                        </label>
                        <input
                          type="password"
                          value={localSettings.otpPanel?.apiKey || ''}
                          onChange={(e) =>
                            setLocalSettings({
                              ...localSettings,
                              otpPanel: { ...localSettings.otpPanel, apiKey: e.target.value },
                            })
                          }
                          placeholder="Enter your provider secret API key"
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-2 text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleTestSmsApi}
                        disabled={isTestingApi}
                        className="py-2 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isTestingApi ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Wifi className="w-3.5 h-3.5" />
                        )}
                        <span>Test API & Fetch Balance</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveSettings}
                        className="py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors cursor-pointer sm:ml-auto text-center"
                      >
                        Save API Settings
                      </button>
                    </div>

                    {apiPingResult && (
                      <div
                        className={`p-3 rounded-xl border flex flex-col gap-2 font-mono text-xs ${
                          apiPingResult.isError
                            ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                            : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {apiPingResult.isError ? (
                              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                            <span className="font-bold">Status: {apiPingResult.status}</span>
                            {apiPingResult.httpStatus && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  apiPingResult.httpStatus === 200
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-200 border border-rose-500/30'
                                }`}
                              >
                                HTTP {apiPingResult.httpStatus}
                              </span>
                            )}
                            <span>•</span>
                            <span>{apiPingResult.balance}</span>
                          </div>
                          <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded text-slate-300">
                            {apiPingResult.ping}ms
                          </span>
                        </div>

                        {apiPingResult.requestedUrl && (
                          <div className="text-[11px] bg-black/40 px-2.5 py-1.5 rounded border border-white/5 break-all text-slate-300 font-mono">
                            <span className="text-slate-400">Target URL:</span> {apiPingResult.requestedUrl}
                          </div>
                        )}

                        {apiPingResult.message && (
                          <div className="text-[11px] text-slate-200 font-sans leading-relaxed">
                            {apiPingResult.message}
                          </div>
                        )}

                        {apiPingResult.httpStatus === 404 && (
                          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-[11px] font-sans flex flex-col gap-1">
                            <span className="font-bold flex items-center gap-1.5 text-amber-300">
                              ℹ️ কেন 404 Not Found এরর আসছে এবং কীভাবে ঠিক করবেন:
                            </span>
                            <p className="text-slate-300 text-[11px] leading-relaxed">
                              সার্ভার <strong>{apiPingResult.requestedUrl}</strong> লিংকে কোনো সরাসরি API খুঁজে পাচ্ছে না এবং একটি 404 HTML পেজ রিটার্ন করছে।
                              সঠিক API রুট পেতে আপনার <strong>miahsms.com</strong> অ্যাকাউন্টে লগইন করে তাদের ডেভেলপার পেজ (<code className="text-amber-300 font-mono">/dev</code>) বা সাপোর্ট থেকে সঠিক API এন্ডপয়েন্ট কপি করে এখানে বসান।
                            </p>
                          </div>
                        )}

                        {apiPingResult.raw && (
                          <div className="text-[10px] bg-black/50 p-2 rounded border border-white/5 text-slate-400 font-mono break-all">
                            Provider Raw: {apiPingResult.raw}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Official Provider Integration Protocol Guide */}
                  <div className="p-4 rounded-xl bg-[#090d18] border border-[#1f2a3f] flex flex-col gap-2.5">
                    <h4 className="font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Official Provider API Specifications & Verification</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      All number requests, incoming SMS checks, and cancellations communicate directly with your configured provider.
                      Tokens are strictly kept server-side and are never exposed to members or logged client-side.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono text-slate-400 pt-1">
                      <div className="p-2.5 rounded-lg bg-[#050810] border border-[#182337]">
                        <span className="text-emerald-400 font-bold block mb-1">MiahSMS Protocol</span>
                        <div>Bearer Token in Headers</div>
                        <div>getNumber: POST /getNumber</div>
                        <div>getStatus: GET /getStatus?id=...</div>
                        <div>Docs: miahsms.com/dev</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#050810] border border-[#182337]">
                        <span className="text-amber-400 font-bold block mb-1">handler_api.php Protocol</span>
                        <div>getBalance: ?action=getBalance</div>
                        <div>getNumber: ?action=getNumber&service=fb</div>
                        <div>getStatus: ?action=getStatus&id=$ID</div>
                        <div>setStatus: ?action=setStatus&status=6/8</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#050810] border border-[#182337]">
                        <span className="text-blue-400 font-bold block mb-1">5SIM REST API Protocol</span>
                        <div>Profile: GET /v1/user/profile</div>
                        <div>Buy: GET /v1/user/buy/activation/...</div>
                        <div>Check SMS: GET /v1/user/check/$ID</div>
                        <div>Cancel: GET /v1/user/cancel/$ID</div>
                      </div>
                    </div>
                  </div>

                  {/* Real Provider Orders Audit Table */}
                  <div className="p-4 rounded-xl bg-[#090d18] border border-[#1f2a3f] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-white flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-emerald-400" />
                          <span>Real SMS Provider Orders ({realProviderOrders.length})</span>
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Active and historical number rentals dispatched from the real SMS provider
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={fetchAdminData}
                        className="px-2.5 py-1 rounded-lg bg-[#141b2a] hover:bg-[#1a2336] text-slate-300 border border-[#232f45] text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Refresh</span>
                      </button>
                    </div>

                    {realProviderOrders.length === 0 ? (
                      <div className="py-6 text-center text-slate-500 border border-[#162032] rounded-xl bg-[#050810]">
                        No provider orders placed yet. When members request numbers, real orders appear here.
                      </div>
                    ) : (
                      <div className="overflow-x-auto custom-scrollbar border border-[#1c263a] rounded-xl">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="bg-[#0b101c] text-slate-400 border-b border-[#1c263a]">
                            <tr>
                              <th className="p-2.5">Order ID</th>
                              <th className="p-2.5">Service</th>
                              <th className="p-2.5">Phone Number</th>
                              <th className="p-2.5">Status</th>
                              <th className="p-2.5">Inbound Code</th>
                              <th className="p-2.5">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#172033] bg-[#070b15]">
                            {realProviderOrders.map((ord: any) => (
                              <tr key={ord.id} className="hover:bg-[#0e1424]">
                                <td className="p-2.5 text-amber-300">#{ord.orderId}</td>
                                <td className="p-2.5 text-slate-300 font-sans">{ord.service} ({ord.countryName})</td>
                                <td className="p-2.5 text-emerald-400 font-bold">{ord.number}</td>
                                <td className="p-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      ord.status === 'SMS_RECEIVED'
                                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                        : ord.status === 'WAITING_SMS'
                                        ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                                        : ord.status === 'COMPLETED'
                                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                                    }`}
                                  >
                                    {ord.status}
                                  </span>
                                </td>
                                <td className="p-2.5 font-bold text-white">
                                  {ord.smsCode || <span className="text-slate-600 font-normal">Waiting...</span>}
                                </td>
                                <td className="p-2.5 text-slate-500 text-[11px]">{ord.createdTimeStr || 'Just now'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: COUNTRIES & NUMBER RANGES */}
              {activeTab === 'countries' && (
                <div className="flex flex-col gap-5 text-xs">
                  {/* Form to add a new country */}
                  <div className="p-3.5 rounded-xl bg-[#090e1a] border border-[#1e2a42]">
                    <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-emerald-400" />
                      <span>Add New Country Range (নতুন দেশ ও নাম্বার রেঞ্জ)</span>
                    </h4>
                    <form onSubmit={handleAddCountry} className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Country Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Egypt"
                          value={newCountryName}
                          onChange={(e) => setNewCountryName(e.target.value)}
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-1.5 text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Country Code (2 letters)</label>
                        <input
                          type="text"
                          placeholder="e.g. EG"
                          value={newCountryCode}
                          onChange={(e) => setNewCountryCode(e.target.value)}
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-1.5 text-white"
                          maxLength={4}
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Flag Emoji</label>
                        <input
                          type="text"
                          placeholder="e.g. 🇪🇬"
                          value={newFlag}
                          onChange={(e) => setNewFlag(e.target.value)}
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Phone Prefix</label>
                        <input
                          type="text"
                          placeholder="e.g. +20"
                          value={newPrefix}
                          onChange={(e) => setNewPrefix(e.target.value)}
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-1.5 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Pattern (with XXX)</label>
                        <input
                          type="text"
                          placeholder="e.g. 2010XXXX"
                          value={newPattern}
                          onChange={(e) => setNewPattern(e.target.value)}
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-1.5 text-white font-mono"
                          required
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-300 mb-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={alsoAddToRegions}
                            onChange={(e) => setAlsoAddToRegions(e.target.checked)}
                            className="rounded bg-[#050810] border-[#23314d]"
                          />
                          <span>Add to Region Dropdown</span>
                        </label>
                        <button
                          type="submit"
                          className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Save Country</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Existing country list */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-slate-300">
                        Existing Countries & Ranges ({numberRanges.length})
                      </h4>
                      <span className="text-[10px] text-slate-500">
                        Click delete to remove any country
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                      {numberRanges.map((r) => (
                        <div
                          key={r.id}
                          className="p-2.5 rounded-xl bg-[#090d18] border border-[#1b2539] flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base">{r.flag}</span>
                            <div className="truncate">
                              <div className="font-bold text-white truncate">{r.country}</div>
                              <div className="text-[11px] font-mono text-indigo-400">
                                {r.prefix} · {r.pattern}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCountry(r.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Delete Country"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: REGIONS */}
              {activeTab === 'regions' && (
                <div className="flex flex-col gap-5 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#090e1a] border border-[#1e2a42]">
                    <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span>Add Region (ড্রপডাউনে নতুন রিজিয়ন যোগ করুন)</span>
                    </h4>
                    <form onSubmit={handleAddRegion} className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Country Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Egypt"
                          value={newRegCountry}
                          onChange={(e) => setNewRegCountry(e.target.value)}
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-1.5 text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Flag Emoji</label>
                        <input
                          type="text"
                          placeholder="e.g. 🇪🇬"
                          value={newRegFlag}
                          onChange={(e) => setNewRegFlag(e.target.value)}
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-1.5 text-white"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Region</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-2">
                      Active Regions in Dropdown ({regions.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                      {regions.map((reg) => (
                        <div
                          key={reg.id}
                          className="p-2.5 rounded-xl bg-[#090d18] border border-[#1b2539] flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{reg.flag}</span>
                            <div className="font-bold text-white">{reg.country}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteRegion(reg.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: RATES & BALANCE */}
              {activeTab === 'rates' && (
                <div className="flex flex-col gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/30 to-[#0d1822] border border-emerald-500/40">
                    <h4 className="text-xs font-bold text-emerald-400 mb-2">
                      Direct Live Balance Override (ব্যালেন্স সেট করুন)
                    </h4>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 font-bold font-mono">
                          ৳
                        </span>
                        <input
                          type="number"
                          value={customBalanceInput}
                          onChange={(e) => setCustomBalanceInput(e.target.value)}
                          className="w-full bg-[#050810] border border-[#23314d] rounded-xl pl-8 pr-3 py-2 text-sm font-mono text-white font-bold"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const val = Number(customBalanceInput) || 0;
                          onSetBalance(val);
                          onToast(`Balance set to ৳${val}`);
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
                      >
                        Apply Balance
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[#090d18] border border-[#1f2a3f]">
                      <label className="block text-slate-300 font-semibold mb-1">
                        Reward per Account Created (৳)
                      </label>
                      <input
                        type="number"
                        value={localSettings.accountReward}
                        onChange={(e) =>
                          setLocalSettings({ ...localSettings, accountReward: Number(e.target.value) })
                        }
                        className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-3 py-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-[#090d18] border border-[#1f2a3f]">
                      <label className="block text-slate-300 font-semibold mb-1">
                        Reward per OTP Received (৳)
                      </label>
                      <input
                        type="number"
                        value={localSettings.otpReward}
                        onChange={(e) =>
                          setLocalSettings({ ...localSettings, otpReward: Number(e.target.value) })
                        }
                        className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-3 py-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-[#090d18] border border-[#1f2a3f]">
                      <label className="block text-slate-300 font-semibold mb-1">
                        Minimum Withdrawal Limit (৳)
                      </label>
                      <input
                        type="number"
                        value={localSettings.minWithdraw}
                        onChange={(e) =>
                          setLocalSettings({ ...localSettings, minWithdraw: Number(e.target.value) })
                        }
                        className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors cursor-pointer shadow-md"
                  >
                    Save Rate Settings
                  </button>
                </div>
              )}

              {/* TAB 5: GATEWAY */}
              {activeTab === 'gateway' && (
                <div className="flex flex-col gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#090d18] border border-[#1f2a3f] flex flex-col gap-3">
                    <h4 className="font-bold text-white">Target Service & Console Text</h4>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Service Name
                      </label>
                      <input
                        type="text"
                        value={localSettings.serviceTarget}
                        onChange={(e) =>
                          setLocalSettings({ ...localSettings, serviceTarget: e.target.value })
                        }
                        className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-3 py-2 text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#182338]">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Min OTP Delay (sec)
                        </label>
                        <input
                          type="number"
                          value={localSettings.otpMinDelaySec}
                          onChange={(e) =>
                            setLocalSettings({ ...localSettings, otpMinDelaySec: Number(e.target.value) })
                          }
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-3 py-1.5 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Max OTP Delay (sec)
                        </label>
                        <input
                          type="number"
                          value={localSettings.otpMaxDelaySec}
                          onChange={(e) =>
                            setLocalSettings({ ...localSettings, otpMaxDelaySec: Number(e.target.value) })
                          }
                          className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-3 py-1.5 text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors cursor-pointer shadow-md"
                  >
                    Save Gateway Settings
                  </button>
                </div>
              )}

              {/* TAB 6: PAYMENTS */}
              {activeTab === 'payments' && (
                <div className="flex flex-col gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#090d18] border border-[#1f2a3f]">
                    <h4 className="font-bold text-white mb-2">Add New Payment Method</h4>
                    <form onSubmit={handleAddPaymentMethod} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Method Name (e.g. Cellfin)"
                        value={newPayName}
                        onChange={(e) => setNewPayName(e.target.value)}
                        className="flex-1 bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-1.5 text-white"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Badge (e.g. সেলফিন)"
                        value={newPayBadge}
                        onChange={(e) => setNewPayBadge(e.target.value)}
                        className="w-full sm:w-32 bg-[#050810] border border-[#23314d] rounded-lg px-2.5 py-1.5 text-white"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 sm:py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer text-center"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h4 className="font-bold text-slate-300">Active Methods</h4>
                    {paymentMethods.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-xl bg-[#090d18] border border-[#1b2539] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{m.name}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#162033] text-slate-300">
                            {m.badge}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTogglePaymentMethod(m.id)}
                            className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                              m.enabled
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {m.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePaymentMethod(m.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 7: BRANDING */}
              {activeTab === 'branding' && (
                <div className="flex flex-col gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#090d18] border border-[#1f2a3f] flex flex-col gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        App Name
                      </label>
                      <input
                        type="text"
                        value={localSettings.appName}
                        onChange={(e) =>
                          setLocalSettings({ ...localSettings, appName: e.target.value })
                        }
                        className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-3 py-2 text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Logo Badge (Max 3 chars)
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={localSettings.appShortName}
                        onChange={(e) =>
                          setLocalSettings({ ...localSettings, appShortName: e.target.value })
                        }
                        className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-3 py-2 text-white font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Sub-banner Text
                      </label>
                      <input
                        type="text"
                        value={localSettings.subBannerText}
                        onChange={(e) =>
                          setLocalSettings({ ...localSettings, subBannerText: e.target.value })
                        }
                        className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Announcement Bar
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 📢 Facebook Account Creation is 100% active!"
                        value={localSettings.announcement}
                        onChange={(e) =>
                          setLocalSettings({ ...localSettings, announcement: e.target.value })
                        }
                        className="w-full bg-[#050810] border border-[#23314d] rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors cursor-pointer shadow-md"
                  >
                    Save Branding & Notice
                  </button>
                </div>
              )}

              {/* TAB 8: WITHDRAWAL REQUESTS */}
              {activeTab === 'withdrawals' && (
                <div className="flex flex-col gap-3 text-xs">
                  <h4 className="font-bold text-white">
                    User Withdrawal Requests ({withdrawHistory.length})
                  </h4>

                  {withdrawHistory.length === 0 ? (
                    <div className="py-12 text-center text-slate-500">
                      No withdrawal requests submitted yet.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {withdrawHistory.map((w) => (
                        <div
                          key={w.id}
                          className="p-3 rounded-xl bg-[#090d18] border border-[#1b2539] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span className="text-emerald-400 font-mono text-sm">৳{w.amount}</span>
                              <span>•</span>
                              <span>{w.method}</span>
                              <span className="text-slate-400 text-[11px] font-mono">({w.accountNumber})</span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              Trx: {w.trxId} · {w.timestamp}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <select
                              value={w.status}
                              onChange={(e) =>
                                handleUpdateWithdrawStatus(w.trxId, e.target.value as WithdrawRecord['status'])
                              }
                              className="bg-[#050810] border border-[#23314d] rounded px-2 py-1 text-[11px] font-semibold text-slate-200"
                            >
                              <option value="Completed">Completed</option>
                              <option value="Pending">Pending</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 z-20 p-2.5 sm:px-5 sm:py-3 border-t border-[#1f293d] bg-[#070b14] flex items-center justify-between gap-2.5 text-xs">
              <span className="text-slate-400 text-[10px] sm:text-[11px] truncate">
                License, device & system settings are synchronized with the secure backend.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors cursor-pointer text-xs"
              >
                Close Panel
              </button>
            </div>

            {/* NEWLY GENERATED KEY POPUP MODAL */}
            {generatedKeyModal && (
              <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-[#0a0f1d] border border-amber-500/50 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-scale-up">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-base">License Key Generated</h4>
                      <p className="text-xs text-amber-300/80">Unpredictable Cryptographic CSPRNG Key</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#050811] border border-amber-500/40 flex items-center justify-between">
                    <span className="font-mono font-black text-amber-300 text-base tracking-widest select-all">
                      {generatedKeyModal.rawKey}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(generatedKeyModal.rawKey, 'modal-key')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all"
                    >
                      {copiedKeyId === 'modal-key' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-300 flex flex-col gap-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Duration:</span>
                      <strong className="text-white uppercase">{generatedKeyModal.license.duration}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Permitted Devices:</span>
                      <strong className="text-white">{generatedKeyModal.license.maxDevices} Device(s)</strong>
                    </div>
                    {generatedKeyModal.license.note && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Client Note:</span>
                        <span className="text-amber-200">{generatedKeyModal.license.note}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300/90 text-[11px] leading-relaxed">
                    ⚠️ <strong>Important:</strong> Copy and deliver this raw key to your member now. For zero-trust security, only the SHA-256 hash is preserved on the server.
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleCopyKey(generatedKeyModal.rawKey, 'modal-key');
                      setGeneratedKeyModal(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors cursor-pointer shadow-lg shadow-amber-950/60"
                  >
                    Copy Key & Close Window
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
