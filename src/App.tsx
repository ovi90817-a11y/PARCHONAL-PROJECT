import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ConfigPanel } from './components/ConfigPanel';
import { LiveStats } from './components/LiveStats';
import { InboxSection } from './components/InboxSection';
import { ConsoleTerminal } from './components/ConsoleTerminal';
import { WithdrawModal } from './components/modals/WithdrawModal';
import { LeaderboardModal } from './components/modals/LeaderboardModal';
import { LiveCheckerModal } from './components/modals/LiveCheckerModal';
import { ResetModal } from './components/modals/ResetModal';
import { AdminPanelModal } from './components/modals/AdminPanelModal';
import { MemberLicenseGate } from './components/modals/MemberLicenseGate';
import {
  StoredLicenseSession,
  getStoredLicenseSession,
  verifyLicenseSessionOnServer,
  clearLicenseSession,
} from './utils/deviceLicense';
import { NUMBER_RANGES, REGIONS } from './data/numberRanges';
import {
  AccountRecord,
  AppSettings,
  ConsoleLog,
  NumberRange,
  PaymentMethodConfig,
  RegionOption,
  WithdrawRecord,
} from './types';
import {
  formatTimeNow,
  playNotificationSound,
  formatSheetText,
  generatePersonName,
  generateAccountUID,
} from './utils/generators';
import confetti from 'canvas-confetti';
import { CheckCircle2, Download, Megaphone } from 'lucide-react';

const INITIAL_LOGS: ConsoleLog[] = [
  {
    id: 'log-1',
    time: formatTimeNow(true),
    message: 'OXYZ Virtual Number & SMS Gateway connected. Ready to request live numbers from provider.',
    type: 'info',
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'OXYZ',
  appShortName: 'OXYZ',
  subBannerText: 'Live Virtual Numbers · Real SMS Provider Connected',
  announcement: '',
  accountReward: 5,
  otpReward: 15,
  minWithdraw: 50,
  otpMinDelaySec: 7,
  otpMaxDelaySec: 14,
  serviceTarget: 'Facebook',
  adminPin: '1234',
  otpPanel: {
    providerName: 'SMS-Activate',
    apiUrl: 'https://api.sms-activate.org/stubs/handler_api.php',
    apiKey: '',
    serviceCode: 'fb',
    countryCode: 'all',
    status: 'ONLINE',
    unlimitedMode: true,
    customNumberPool: [],
  },
};

const DEFAULT_PAYMENTS: PaymentMethodConfig[] = [
  { id: 'pay-1', name: 'bKash', badge: 'বিকাশ', enabled: true },
  { id: 'pay-2', name: 'Nagad', badge: 'নগদ', enabled: true },
  { id: 'pay-3', name: 'Rocket', badge: 'রকেট', enabled: true },
  { id: 'pay-4', name: 'Upay', badge: 'উপায়', enabled: true },
];

export default function App() {
  // App Settings from localStorage
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('oxyz_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.appName !== 'OXYZ') {
          parsed.appName = 'OXYZ';
          parsed.appShortName = 'OXYZ';
        }
        return { ...DEFAULT_SETTINGS, ...parsed, appName: 'OXYZ', appShortName: 'OXYZ' };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Country Number Ranges from localStorage
  const [numberRanges, setNumberRanges] = useState<NumberRange[]>(() => {
    try {
      const saved = localStorage.getItem('oxyz_number_ranges');
      return saved ? JSON.parse(saved) : NUMBER_RANGES;
    } catch {
      return NUMBER_RANGES;
    }
  });

  // Regions & Languages from localStorage
  const [regions, setRegions] = useState<RegionOption[]>(() => {
    try {
      const saved = localStorage.getItem('oxyz_regions');
      return saved ? JSON.parse(saved) : REGIONS;
    } catch {
      return REGIONS;
    }
  });

  // Payment methods from localStorage
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(() => {
    try {
      const saved = localStorage.getItem('oxyz_payment_methods');
      return saved ? JSON.parse(saved) : DEFAULT_PAYMENTS;
    } catch {
      return DEFAULT_PAYMENTS;
    }
  });

  // Main interactive states
  const [balance, setBalance] = useState<number>(0);
  const [otpCount, setOtpCount] = useState<number>(0);
  const [selectedRange, setSelectedRange] = useState<NumberRange>(numberRanges[0] || NUMBER_RANGES[0]);
  const [selectedRegion, setSelectedRegion] = useState<string>('bd');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('bn');
  const [password, setPassword] = useState<string>('');
  const [accountCount, setAccountCount] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null);
  const [customPhoneInput, setCustomPhoneInput] = useState<string>('');
  const [isRefreshingOrders, setIsRefreshingOrders] = useState<boolean>(false);
  const [lastCreatedNotice, setLastCreatedNotice] = useState<string>('');

  // Accounts & Terminal logs (Real provider orders only; starts empty)
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [logs, setLogs] = useState<ConsoleLog[]>(INITIAL_LOGS);
  const [withdrawHistory, setWithdrawHistory] = useState<WithdrawRecord[]>(() => {
    try {
      const saved = localStorage.getItem('oxyz_withdraw_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modals
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLiveCheckerOpen, setIsLiveCheckerOpen] = useState(false);
  const [checkerPresetAccount, setCheckerPresetAccount] = useState<AccountRecord | null>(null);
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Member License Session state
  const [licenseSession, setLicenseSession] = useState<StoredLicenseSession | null>(() =>
    getStoredLicenseSession()
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const addLog = (message: string, type: ConsoleLog['type'] = 'info') => {
    const newLog: ConsoleLog = {
      id: `${Date.now()}-${Math.random()}`,
      time: formatTimeNow(true),
      message,
      type,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  // Load existing orders for this authenticated member from the server
  const loadMemberOrders = async () => {
    if (!licenseSession) return;
    try {
      const res = await fetch('/api/sms/my-orders', {
        headers: {
          'x-installation-id': licenseSession.installationId,
          'x-license-id': licenseSession.licenseId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: AccountRecord[] = data.map((o: any, idx: number) => ({
            id: o.id,
            orderId: o.orderId,
            indexNumber: idx + 1,
            regionCode: o.countryCode || 'BD',
            regionName: o.countryName || 'Global',
            number: o.number,
            service: o.service || 'Facebook',
            serviceCode: o.serviceCode || 'fb',
            status:
              o.status === 'SMS_RECEIVED'
                ? 'OTP_RECEIVED'
                : o.status === 'WAITING_SMS'
                ? 'WAITING_OTP'
                : o.status,
            createdAt: o.createdAt,
            createdTimeStr: o.createdTimeStr,
            expiresAt: o.expiresAt,
            otpCode: o.smsCode,
            smsText: o.smsText,
            otpSender: o.service,
            rawProviderResponse: o.rawProviderResponse,
          }));
          setAccounts(mapped);
        }
      }
    } catch (e) {
      console.debug('Failed loading member orders', e);
    }
  };

  // Periodic device & license verification against backend
  useEffect(() => {
    if (!licenseSession) return;

    // Immediate check
    verifyLicenseSessionOnServer(licenseSession).then((res) => {
      if (!res.valid) {
        setLicenseSession(null);
        showToast(res.message || 'License key expired or revoked.');
      } else if (res.session) {
        setLicenseSession(res.session);
        loadMemberOrders();
      }
    });

    // Check every 60 seconds
    const interval = setInterval(() => {
      const current = getStoredLicenseSession();
      if (!current) {
        setLicenseSession(null);
        return;
      }
      verifyLicenseSessionOnServer(current).then((res) => {
        if (!res.valid) {
          setLicenseSession(null);
          showToast(res.message || 'License access invalidated by administrator.');
        } else if (res.session) {
          setLicenseSession(res.session);
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [licenseSession?.licenseId]);

  // Auto-poll SMS Provider for orders in WAITING_OTP state (every 5s)
  useEffect(() => {
    if (!licenseSession) return;
    const waitingOrders = accounts.filter(
      (a) => a.status === 'WAITING_OTP' && a.orderId
    );
    if (waitingOrders.length === 0) return;

    const interval = setInterval(() => {
      waitingOrders.forEach((acc) => {
        if (!acc.orderId) return;
        fetch(`/api/sms/order/${acc.orderId}`, {
          headers: {
            'x-installation-id': licenseSession.installationId,
            'x-license-id': licenseSession.licenseId,
          },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.status === 'SMS_RECEIVED' && data.smsCode) {
              setAccounts((prev) =>
                prev.map((item) => {
                  if (item.orderId === acc.orderId && item.status !== 'OTP_RECEIVED') {
                    playNotificationSound('otp');
                    setBalance((b) => b + (settings.otpReward || 15));
                    setOtpCount((c) => c + 1);
                    try {
                      confetti({ particleCount: 40, spread: 60, origin: { y: 0.65 } });
                    } catch {
                      // ignore
                    }
                    addLog(
                      `📲 [SMS Provider] Inbound SMS received for ${item.number}: Code ${data.smsCode}`,
                      'otp'
                    );
                    showToast(`New SMS Received: ${data.smsCode} for ${item.number}!`);
                    return {
                      ...item,
                      status: 'OTP_RECEIVED',
                      otpCode: data.smsCode,
                      smsText: data.smsText,
                      otpReceivedAt: formatTimeNow(true),
                    };
                  }
                  return item;
                })
              );
            } else if (data.status === 'CANCELLED' || data.status === 'EXPIRED') {
              setAccounts((prev) =>
                prev.map((item) =>
                  item.orderId === acc.orderId ? { ...item, status: data.status } : item
                )
              );
            }
          })
          .catch(() => {});
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [accounts, licenseSession]);

  // Persist settings
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('oxyz_settings', JSON.stringify(newSettings));
  };

  // Persist number ranges
  const handleUpdateNumberRanges = (ranges: NumberRange[]) => {
    setNumberRanges(ranges);
    localStorage.setItem('oxyz_number_ranges', JSON.stringify(ranges));
    if (!ranges.some((r) => r.id === selectedRange.id) && ranges.length > 0) {
      setSelectedRange(ranges[0]);
    }
  };

  // Persist regions
  const handleUpdateRegions = (newRegions: RegionOption[]) => {
    setRegions(newRegions);
    localStorage.setItem('oxyz_regions', JSON.stringify(newRegions));
    if (!newRegions.some((r) => r.id === selectedRegion) && newRegions.length > 0) {
      setSelectedRegion(newRegions[0].id);
    }
  };

  // Persist payment methods
  const handleUpdatePaymentMethods = (methods: PaymentMethodConfig[]) => {
    setPaymentMethods(methods);
    localStorage.setItem('oxyz_payment_methods', JSON.stringify(methods));
  };

  // Persist withdraw history
  const handleUpdateWithdrawHistory = (history: WithdrawRecord[]) => {
    setWithdrawHistory(history);
    localStorage.setItem('oxyz_withdraw_history', JSON.stringify(history));
  };

  // Create account with user-provided number OR request live number from SMS provider
  const handleStartBatch = async () => {
    if (isProcessing) return;
    if (!licenseSession) {
      showToast('Active license key required to create accounts. Please activate your license.');
      return;
    }

    const trimmedCustomPhone = customPhoneInput.trim().replace(/[\s-]/g, '');

    // Case 1: User entered a specific phone number -> create account for this number
    if (trimmedCustomPhone.length >= 6) {
      setIsProcessing(true);
      const targetService = settings.serviceTarget || 'Facebook';
      const targetPassword = password.trim() || Math.random().toString(36).slice(-8) + '!Aa';

      addLog(`⚙️ Creating account for number: ${trimmedCustomPhone} (${targetService})...`, 'info');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const res = await fetch('/api/sms/custom-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            'x-installation-id': licenseSession.installationId,
            'x-license-id': licenseSession.licenseId,
          },
          body: JSON.stringify({
            customNumber: trimmedCustomPhone,
            serviceName: targetService,
            serviceCode: settings.otpPanel?.serviceCode || 'fb',
            countryCode: selectedRange.countryCode || 'BD',
            countryName: selectedRange.country || 'Custom Number',
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const resText = (await res.text()).trim();
        let data: any = null;
        try {
          data = JSON.parse(resText);
        } catch {
          data = null;
        }

        // Handle license authentication failure
        if (res.status === 401 || res.status === 403) {
          const authError = data?.error || 'আপনার ডিভাইস লাইসেন্স সেশনটি পুনরায় ভেরিফিকেশন করা প্রয়োজন।';
          showToast(`লাইসেন্স অথরাইজেশন এরর: ${authError}`);
          addLog(`🔒 License Authentication Error (${res.status}): ${authError}`, 'warn');
          clearLicenseSession();
          setLicenseSession(null);
          return;
        }

        if (res.ok && data?.success && data?.order) {
          const o = data.order;
          const nextIndex = accounts.length + 1;
          const newRecord: AccountRecord = {
            id: o.id,
            orderId: o.orderId,
            indexNumber: nextIndex,
            regionCode: o.countryCode || selectedRange.countryCode || 'BD',
            regionName: o.countryName || selectedRange.country,
            name: generatePersonName(),
            uid: 'N/A',
            number: o.number,
            password: targetPassword || 'Pass@MUtegNq',
            service: targetService,
            serviceCode: settings.otpPanel?.serviceCode || 'fb',
            status: 'WAITING_OTP',
            createdAt: o.createdAt,
            createdTimeStr: o.createdTimeStr,
            expiresAt: o.expiresAt,
            rawProviderResponse: o.rawProviderResponse,
          };

          setAccounts((prev) => [newRecord, ...prev]);
          if (settings.accountReward > 0) {
            setBalance((b) => b + settings.accountReward);
          }

          // Clear input and prompt for the next number continuously!
          setCustomPhoneInput('');
          setLastCreatedNotice(`✅ একাউন্ট #${nextIndex} তৈরি সম্পন্ন (${o.number})! এবার পরবর্তী একাউন্টের জন্য নতুন নাম্বার দিন।`);

          playNotificationSound('success');
          showToast(`একাউন্ট #${nextIndex} তৈরি হয়েছে! এবার পরবর্তী নতুন নাম্বার দিন।`);
          addLog(`📱 Account #${nextIndex} Created: ${o.number} (Order #${o.orderId}). Waiting for OTP code.`, 'otp');
        } else {
          const errMsg = data?.error || data?.message || (resText ? resText.slice(0, 160) : `Server HTTP ${res.status} error`);
          showToast(`Account creation failed: ${errMsg}`);
          addLog(`❌ Account creation failed: ${errMsg}`, 'error');
        }
      } catch (err: any) {
        const errorDetail =
          err?.name === 'AbortError'
            ? 'সার্ভারের সাথে সংযোগ সময়সীমা উত্তীর্ণ হয়েছে (20s timeout)'
            : err?.message || 'Network request failed';
        showToast(`নেটওয়ার্ক ত্রুটি: ${errorDetail}`);
        addLog(`❌ Network error while creating account: ${errorDetail}`, 'error');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Case 2: No phone number entered -> request live number from configured SMS provider
    setIsProcessing(true);
    setLastCreatedNotice('');
    const countToRequest = accountCount;
    const targetService = settings.serviceTarget || 'Facebook';
    const provider = settings.otpPanel?.providerName || 'SMS-Activate';

    addLog(
      `📡 Contacting SMS Provider (${provider}) to order ${countToRequest} live number(s) for ${targetService} [${selectedRange.country}]...`,
      'info'
    );

    let successCount = 0;

    for (let i = 0; i < countToRequest; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const res = await fetch('/api/sms/order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            'x-installation-id': licenseSession.installationId,
            'x-license-id': licenseSession.licenseId,
          },
          body: JSON.stringify({
            serviceCode: settings.otpPanel?.serviceCode || 'fb',
            serviceName: targetService,
            countryCode: selectedRange.providerCountryId || selectedRange.countryCode || 'all',
            countryName: selectedRange.country,
            rangePattern: selectedRange.pattern,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const resText = (await res.text()).trim();
        let data: any = null;
        try {
          data = JSON.parse(resText);
        } catch {
          data = null;
        }

        // Handle license authentication failure
        if (res.status === 401 || res.status === 403) {
          const authError = data?.error || 'আপনার ডিভাইস লাইসেন্স সেশনটি পুনরায় ভেরিফিকেশন করা প্রয়োজন।';
          showToast(`লাইসেন্স অথরাইজেশন এরর: ${authError}`);
          addLog(`🔒 License Authentication Error (${res.status}): ${authError}`, 'warn');
          clearLicenseSession();
          setLicenseSession(null);
          break;
        }

        if (!res.ok || !data?.success || !data?.order) {
          const errMsg = data?.error || data?.message || (resText ? resText.slice(0, 160) : `HTTP ${res.status} error`);
          addLog(`❌ [SMS Provider Error] ${errMsg}`, 'error');
          showToast(errMsg);
          break; // Stop immediately, never substitute fake numbers!
        }

        const realOrder = data.order;
        const newRecord: AccountRecord = {
          id: realOrder.id,
          orderId: realOrder.orderId,
          indexNumber: accounts.length + successCount + 1,
          regionCode: selectedRange.countryCode,
          regionName: selectedRange.country,
          name: generatePersonName(),
          uid: 'N/A',
          number: realOrder.number,
          password: password.trim() || 'Pass@MUtegNq',
          service: targetService,
          serviceCode: settings.otpPanel?.serviceCode || 'fb',
          status: 'WAITING_OTP',
          createdAt: realOrder.createdAt,
          createdTimeStr: realOrder.createdTimeStr,
          expiresAt: realOrder.expiresAt,
          rawProviderResponse: realOrder.rawProviderResponse,
        };

        setAccounts((prev) => [newRecord, ...prev]);
        successCount++;

        addLog(
          `📱 [${provider}] Number Rented: ${realOrder.number} (Order #${realOrder.orderId}). Enter in official ${targetService} to receive SMS.`,
          'otp'
        );
        showToast(`Live Number Rented: ${realOrder.number} (Order #${realOrder.orderId})`);
        playNotificationSound('success');

        if (settings.accountReward > 0) {
          setBalance((b) => b + settings.accountReward);
        }
      } catch (err: any) {
        const errorDetail =
          err?.name === 'AbortError'
            ? 'সার্ভারের সাথে সংযোগ সময়সীমা উত্তীর্ণ হয়েছে (20s timeout)'
            : err?.message || 'Network request failed';
        addLog(`❌ Network error contacting provider: ${errorDetail}`, 'error');
        showToast(`SMS Provider Error: ${errorDetail}`);
        break;
      }
    }

    setIsProcessing(false);
    if (successCount > 0) {
      addLog(
        `✅ Successfully retrieved ${successCount} actual number(s) from SMS provider. Waiting for incoming SMS.`,
        'success'
      );
    }
  };

  // Check incoming SMS on an active order from provider
  const handleCheckOrderSms = async (orderId: string) => {
    if (!licenseSession) {
      showToast('Active license required.');
      return;
    }

    setCheckingOrderId(orderId);
    try {
      const res = await fetch(`/api/sms/order/${orderId}`, {
        headers: {
          'x-installation-id': licenseSession.installationId,
          'x-license-id': licenseSession.licenseId,
        },
      });
      const data = await res.json();
      setCheckingOrderId(null);

      if (!res.ok) {
        showToast(`Provider query failed: ${data.message || 'Error'}`);
        return;
      }

      if (data.status === 'SMS_RECEIVED' && data.smsCode) {
        setAccounts((prev) =>
          prev.map((acc) => {
            if (
              (acc.orderId === orderId || acc.id === orderId) &&
              acc.status !== 'OTP_RECEIVED'
            ) {
              playNotificationSound('otp');
              setBalance((b) => b + (settings.otpReward || 15));
              setOtpCount((c) => c + 1);
              try {
                confetti({ particleCount: 40, spread: 60, origin: { y: 0.65 } });
              } catch {
                // ignore
              }
              return {
                ...acc,
                status: 'OTP_RECEIVED',
                otpCode: data.smsCode,
                smsText: data.smsText,
                otpReceivedAt: formatTimeNow(true),
              };
            }
            return acc;
          })
        );
        addLog(`📲 [SMS Provider] Official SMS Code Received: ${data.smsCode}`, 'otp');
        showToast(`Official SMS Received: ${data.smsCode}`);
      } else if (data.status === 'WAITING_SMS') {
        showToast('Provider: Still waiting for SMS from official service...');
      } else if (data.status === 'CANCELLED' || data.status === 'EXPIRED') {
        setAccounts((prev) =>
          prev.map((acc) =>
            acc.orderId === orderId || acc.id === orderId
              ? { ...acc, status: data.status }
              : acc
          )
        );
        showToast(`Order status on provider: ${data.status}`);
      } else {
        showToast(data.message || `Provider status: ${data.status}`);
      }
    } catch (err: any) {
      setCheckingOrderId(null);
      showToast(`Network error: ${err.message}`);
    }
  };

  // Cancel order on provider (refunds balance)
  const handleCancelOrder = async (orderId: string) => {
    if (!licenseSession) return;
    try {
      const res = await fetch(`/api/sms/order/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'x-installation-id': licenseSession.installationId,
          'x-license-id': licenseSession.licenseId,
        },
      });
      const data = await res.json();
      if (data.success) {
        setAccounts((prev) =>
          prev.map((acc) =>
            acc.orderId === orderId || acc.id === orderId
              ? { ...acc, status: 'CANCELLED' }
              : acc
          )
        );
        addLog(`⚠️ Order #${orderId} cancelled on provider.`, 'warn');
        showToast(`Order #${orderId} cancelled on provider.`);
      } else {
        showToast(`Cancel failed: ${data.message}`);
      }
    } catch {
      showToast('Failed to cancel order.');
    }
  };

  // Finish order on provider (confirms official verification)
  const handleFinishOrder = async (orderId: string) => {
    if (!licenseSession) return;
    try {
      const res = await fetch(`/api/sms/order/${orderId}/finish`, {
        method: 'POST',
        headers: {
          'x-installation-id': licenseSession.installationId,
          'x-license-id': licenseSession.licenseId,
        },
      });
      const data = await res.json();
      if (data.success) {
        setAccounts((prev) =>
          prev.map((acc) =>
            acc.orderId === orderId || acc.id === orderId
              ? { ...acc, status: 'COMPLETED' }
              : acc
          )
        );
        addLog(`✅ Order #${orderId} confirmed and finished on provider.`, 'success');
        showToast(`Official verification confirmed on provider!`);
      } else {
        showToast(`Finish failed: ${data.message}`);
      }
    } catch {
      showToast('Failed to finish order.');
    }
  };

  // Confirm account with received OTP code (manual or incoming verification)
  const handleConfirmManualOTP = async (orderId: string, otpCode: string) => {
    if (!licenseSession) {
      showToast('Active license required.');
      return;
    }

    try {
      const res = await fetch(`/api/sms/order/${orderId}/confirm-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
          'x-installation-id': licenseSession.installationId,
          'x-license-id': licenseSession.licenseId,
        },
        body: JSON.stringify({ otpCode }),
      });

      const resText = (await res.text()).trim();
      let data: any = null;
      try {
        data = JSON.parse(resText);
      } catch {
        data = null;
      }

      if (res.ok && data?.success && data?.order) {
        const updated = data.order;
        setAccounts((prev) =>
          prev.map((acc) => {
            if (acc.orderId === orderId || acc.id === orderId) {
              return {
                ...acc,
                status: 'OTP_RECEIVED',
                otpCode: updated.smsCode || otpCode,
                smsText: updated.smsText || `Verified OTP Code: ${otpCode}`,
                otpReceivedAt: formatTimeNow(true),
              };
            }
            return acc;
          })
        );

        const reward = settings.otpReward || 15;
        setBalance((b) => b + reward);
        setOtpCount((c) => c + 1);

        playNotificationSound('success');
        try {
          confetti({ particleCount: 45, spread: 60, origin: { y: 0.7 } });
        } catch {}

        showToast(`✅ ওটিপি ভেরিফাইড! একাউন্ট কনফার্ম হয়েছে (+৳${reward} যোগ হয়েছে)`);
        addLog(`🎉 Account Confirmed! Number: ${updated.number} | OTP: ${otpCode} (+৳${reward})`, 'success');
      } else {
        const errMsg = data?.error || data?.message || (resText ? resText.slice(0, 160) : 'Failed to verify OTP code.');
        showToast(errMsg);
      }
    } catch (err: any) {
      showToast(`Network error confirming OTP: ${err?.message || 'Connection failed'}`);
    }
  };

  // Refresh OTP Panel and sync orders/incoming messages
  const handleRefreshOTPPanel = async () => {
    setIsRefreshingOrders(true);
    try {
      await loadMemberOrders();
      const waiting = accounts.filter((a) => a.status === 'WAITING_OTP' && a.orderId);
      if (waiting.length > 0) {
        for (const w of waiting.slice(0, 3)) {
          handleCheckOrderSms(w.orderId!);
        }
      }
      showToast('OTP Panel refreshed!');
      addLog('🔄 OTP Panel refreshed. Synchronizing messages...', 'info');
    } catch {
      showToast('Error refreshing panel.');
    } finally {
      setIsRefreshingOrders(false);
    }
  };

  // Reset
  const handleConfirmReset = () => {
    setAccounts([]);
    setLogs([
      {
        id: `reset-${Date.now()}`,
        time: formatTimeNow(true),
        message: 'System reset completed. Inbox cleared.',
        type: 'warn',
      },
    ]);
    showToast('Inbox and console cleared.');
  };

  // Withdraw payout
  const handleConfirmWithdraw = (record: WithdrawRecord) => {
    setBalance((prev) => Math.max(0, prev - record.amount));
    const updated = [record, ...withdrawHistory];
    handleUpdateWithdrawHistory(updated);
    addLog(`💸 Payout of ৳${record.amount} requested to ${record.method} (${record.accountNumber})`, 'success');
    showToast(`Withdrawal of ৳${record.amount} initiated successfully!`);
  };

  // Export full list
  const handleExportAll = () => {
    if (accounts.length === 0) {
      showToast('No orders to export.');
      return;
    }
    const lines = accounts.map((a) => formatSheetText(a));
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${settings.appName}_Orders_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${accounts.length} orders to text file.`);
  };

  return (
    <div className="min-h-screen bg-[#080b12] text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white relative">
      {/* Member License Gate: Blocks unauthorized access until verified by backend */}
      {!licenseSession && (
        <MemberLicenseGate
          appName={settings.appName}
          onSuccess={(newSession) => {
            setLicenseSession(newSession);
            showToast('✅ License activated successfully! Dashboard unlocked.');
          }}
          onOpenAdmin={() => setIsAdminOpen(true)}
        />
      )}

      {/* Top Navigation & Action Bar */}
      <Header
        appName={settings.appName}
        appShortName={settings.appShortName}
        balance={balance}
        otpCount={otpCount}
        licenseSession={licenseSession}
        onOpenLiveChecker={() => {
          setCheckerPresetAccount(null);
          setIsLiveCheckerOpen(true);
        }}
        onOpenBoard={() => setIsBoardOpen(true)}
        onOpenWithdraw={() => setIsWithdrawOpen(true)}
        onReset={() => setIsResetOpen(true)}
        onLogout={() => {
          clearLicenseSession();
          setLicenseSession(null);
          showToast('Device session signed out. Please enter your license key to re-enter.');
        }}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* Top Announcement Bar if set by Admin */}
      {settings.announcement && (
        <div className="bg-amber-950/50 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-300 flex items-center justify-center gap-2">
          <Megaphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-medium truncate">{settings.announcement}</span>
        </div>
      )}

      {/* Main Content Body */}
      <main className="flex-1 px-3 sm:px-6 py-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        {/* Phone — Configuration Section */}
        <ConfigPanel
          numberRanges={numberRanges}
          selectedRange={selectedRange}
          onSelectRange={setSelectedRange}
          regions={regions}
          selectedRegion={selectedRegion}
          onSelectRegion={setSelectedRegion}
          selectedLanguage={selectedLanguage}
          onSelectLanguage={setSelectedLanguage}
          password={password}
          onChangePassword={setPassword}
          accountCount={accountCount}
          onChangeAccountCount={setAccountCount}
          isProcessing={isProcessing}
          onStartBatch={handleStartBatch}
          subBannerText={settings.subBannerText}
          customPhoneInput={customPhoneInput}
          onChangeCustomPhone={setCustomPhoneInput}
          lastCreatedNotice={lastCreatedNotice}
        />

        {/* Live Stats Section */}
        <LiveStats activeCount={accounts.length} otpCount={otpCount} />

        {/* Export / Quick Actions bar */}
        {accounts.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-400">
              Active Numbers: <strong className="text-white">{accounts.length}</strong>
            </span>
            <button
              type="button"
              onClick={handleExportAll}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors cursor-pointer py-1 px-2.5 rounded-lg bg-[#0e1524] border border-[#1e293b]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Orders (.txt)</span>
            </button>
          </div>
        )}

        {/* Inbox — Live Provider Numbers & Incoming SMS */}
        <InboxSection
          accounts={accounts}
          onCheckOTP={handleCheckOrderSms}
          onCancelOrder={handleCancelOrder}
          onFinishOrder={handleFinishOrder}
          onConfirmManualOTP={handleConfirmManualOTP}
          onRefreshPanel={handleRefreshOTPPanel}
          isRefreshingPanel={isRefreshingOrders}
          onToast={showToast}
          checkingOrderId={checkingOrderId}
          onOpenLiveChecker={() => {
            setCheckerPresetAccount(null);
            setIsLiveCheckerOpen(true);
          }}
          onClearAll={() => setIsResetOpen(true)}
          onCopyAll={handleExportAll}
        />

        {/* Console / Terminal Section */}
        <ConsoleTerminal logs={logs} onClearLogs={() => setLogs([])} />

        {/* Footer info */}
        <footer className="text-center py-6 text-slate-600 text-xs flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <span>{settings.appName} Platform</span>
            <span>•</span>
            <span className="text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Live Online
            </span>
          </div>
          <p className="text-[11px] text-slate-700">
            Real SMS provider number gateway & verified incoming message panel
          </p>
        </footer>
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 left-5 sm:left-auto sm:max-w-md z-50 animate-fade-in pointer-events-none">
          <div className="bg-[#101827] text-white px-4 py-3 rounded-xl border border-indigo-500/50 shadow-2xl shadow-indigo-950/80 flex items-center gap-3 backdrop-blur-md">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs sm:text-sm font-medium leading-tight">
              {toastMessage}
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      <AdminPanelModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        numberRanges={numberRanges}
        onUpdateNumberRanges={handleUpdateNumberRanges}
        regions={regions}
        onUpdateRegions={handleUpdateRegions}
        paymentMethods={paymentMethods}
        onUpdatePaymentMethods={handleUpdatePaymentMethods}
        currentBalance={balance}
        onSetBalance={setBalance}
        withdrawHistory={withdrawHistory}
        onUpdateWithdrawHistory={handleUpdateWithdrawHistory}
        onToast={showToast}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        balance={balance}
        onConfirmWithdraw={handleConfirmWithdraw}
        history={withdrawHistory}
        paymentMethods={paymentMethods}
        minWithdraw={settings.minWithdraw}
      />

      {/* Leaderboard Modal */}
      <LeaderboardModal
        isOpen={isBoardOpen}
        onClose={() => setIsBoardOpen(false)}
        currentUserStats={{
          accountsCreated: accounts.length,
          otps: otpCount,
          balance,
        }}
      />

      {/* Live Checker Modal */}
      <LiveCheckerModal
        isOpen={isLiveCheckerOpen}
        onClose={() => {
          setIsLiveCheckerOpen(false);
          setCheckerPresetAccount(null);
        }}
        presetAccount={checkerPresetAccount}
        onToast={showToast}
      />

      {/* Reset Modal */}
      <ResetModal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        onConfirmReset={handleConfirmReset}
      />
    </div>
  );
}
