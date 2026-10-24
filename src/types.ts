export interface AccountRecord {
  id: string;
  batchId?: string;
  orderId?: string; // Real Provider Activation / Order ID
  indexNumber: number;
  regionCode: string;
  regionName: string;
  name?: string;
  number: string; // Real number returned by provider
  uid?: string;
  password?: string;
  cookie?: string;
  service?: string; // e.g. 'Facebook'
  serviceCode?: string; // e.g. 'fb'
  status: 'ACTIVE' | 'WAITING_OTP' | 'OTP_RECEIVED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  createdAt: number;
  createdTimeStr: string;
  expiresAt?: number;
  otpCode?: string; // Exact OTP code returned by provider
  smsText?: string; // Exact raw incoming message returned by provider
  otpSender?: string;
  otpReceivedAt?: string;
  rawProviderResponse?: string;
  isLive?: boolean;
  twoFactorSecret?: string;
  completedAt?: number;
}

export interface NumberRange {
  id: string;
  country: string;
  countryCode: string;
  providerCountryId?: string; // Mapped provider country ID for handler_api.php (e.g. '187' for US, '60' for BD)
  flag: string;
  prefix: string;
  pattern: string;
  totalDigits: number;
  enabled?: boolean;
}

export interface RegionOption {
  id: string;
  label: string;
  flag: string;
  lang: string;
  country: string;
  countryCode: string;
}

export interface LanguageOption {
  id: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface ConsoleLog {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'otp';
}

export interface WithdrawRecord {
  id: string;
  method: string;
  accountNumber: string;
  amount: number;
  timestamp: string;
  trxId: string;
  status: 'Completed' | 'Pending' | 'Rejected';
}

export interface LeaderboardUser {
  rank: number;
  name: string;
  location: string;
  accountsToday: number;
  otpsToday: number;
  earnings: number;
  avatar: string;
  badge: string;
  isCurrentUser?: boolean;
}

export interface OtpPanelConfig {
  providerName: string; // e.g. 'SMS-Activate', '5SIM', 'DaisySMS', 'SMS-Hub', 'Custom Gateway'
  apiUrl: string;
  apiKey: string;
  serviceCode: string; // e.g. 'fb' for Facebook
  countryCode: string;
  status: 'ONLINE' | 'CONNECTED' | 'DEMO';
  unlimitedMode: boolean; // Continuous unlimited numbers stream
  customNumberPool: string[]; // Numbers fed by the admin
  dispatchedCount?: number;
  lastTestedAt?: string;
}

export interface AppSettings {
  appName: string;
  appShortName: string;
  subBannerText: string;
  announcement: string;
  accountReward: number; // ৳ per account created
  otpReward: number; // ৳ per OTP received
  minWithdraw: number; // Min withdrawal amount
  otpMinDelaySec: number;
  otpMaxDelaySec: number;
  serviceTarget: string; // e.g., 'Facebook', 'Gmail', 'Telegram'
  adminPin: string;
  otpPanel: OtpPanelConfig;
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  badge: string;
  enabled: boolean;
}

export type LicenseDuration = '1d' | '7d' | '30d' | 'lifetime';
export type LicenseStatus = 'AVAILABLE' | 'ACTIVATED' | 'EXPIRED' | 'REVOKED';
export type DeviceStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'DEACTIVATED';

export interface LicenseRecord {
  id: string;
  keyHash: string;
  keyMask: string;
  duration: LicenseDuration;
  durationDays: number | null;
  maxDevices: number;
  status: LicenseStatus;
  createdAt: string;
  activatedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revocationReason?: string | null;
  activationCount: number;
  note?: string;
  assignedMemberId?: string | null;
}

export interface DeviceActivationRecord {
  id: string;
  licenseId: string;
  licenseMask: string;
  memberId: string;
  installationId: string;
  deviceFingerprint: string;
  deviceInfo?: {
    browser?: string;
    os?: string;
    platform?: string;
  };
  ipAddress: string;
  status: DeviceStatus;
  activatedAt: string;
  expiresAt: string | null;
  lastValidatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  target: string;
  details: string;
  ip: string;
}

export interface LicenseVerificationResult {
  valid: boolean;
  status: LicenseStatus | DeviceStatus | 'INVALID' | 'LIMIT_REACHED' | 'RATE_LIMITED';
  message: string;
  license?: {
    id: string;
    keyMask: string;
    duration: LicenseDuration;
    expiresAt: string | null;
    maxDevices: number;
    activeDevices: number;
  };
  device?: {
    id: string;
    installationId: string;
    status: DeviceStatus;
    expiresAt: string | null;
  };
}
