import { DeviceActivationRecord, DeviceStatus, LicenseDuration, LicenseRecord, LicenseStatus } from '../types';

const INSTALLATION_KEY = 'oxyz_device_installation_id';
const LICENSE_SESSION_KEY = 'oxyz_license_session';

export interface StoredLicenseSession {
  licenseId: string;
  keyMask: string;
  duration: LicenseDuration;
  expiresAt: string | null;
  installationId: string;
  memberId: string;
  activatedAt: string;
  status: DeviceStatus | LicenseStatus;
}

export function getDeviceInstallationId(): string {
  let id = localStorage.getItem(INSTALLATION_KEY);
  if (!id) {
    const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    id = `dev_${Date.now().toString(36)}_${randomBytes}`;
    localStorage.setItem(INSTALLATION_KEY, id);
  }
  return id;
}

export function getDeviceFingerprint(): {
  fingerprint: string;
  info: { browser: string; os: string; platform: string };
} {
  const nav = window.navigator;
  const screen = window.screen;

  let os = 'Unknown OS';
  if (/Windows/i.test(nav.userAgent)) os = 'Windows';
  else if (/Macintosh|Mac OS/i.test(nav.userAgent)) os = 'macOS';
  else if (/Android/i.test(nav.userAgent)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(nav.userAgent)) os = 'iOS';
  else if (/Linux/i.test(nav.userAgent)) os = 'Linux';

  let browser = 'Unknown Browser';
  if (/Chrome/i.test(nav.userAgent) && !/Edg|OPR/i.test(nav.userAgent)) browser = 'Chrome';
  else if (/Firefox/i.test(nav.userAgent)) browser = 'Firefox';
  else if (/Safari/i.test(nav.userAgent) && !/Chrome/i.test(nav.userAgent)) browser = 'Safari';
  else if (/Edg/i.test(nav.userAgent)) browser = 'Edge';
  else if (/OPR/i.test(nav.userAgent)) browser = 'Opera';

  const rawString = `${nav.userAgent}_${screen.width}x${screen.height}_${screen.colorDepth}_${nav.language}_${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

  // Simple numeric hash converted to hex
  let hash = 0;
  for (let i = 0; i < rawString.length; i++) {
    const chr = rawString.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  const fingerprint = `fp_${Math.abs(hash).toString(16)}_${screen.width}x${screen.height}`;

  return {
    fingerprint,
    info: {
      browser: `${browser} (${nav.language || 'en'})`,
      os,
      platform: nav.platform || 'Web Browser',
    },
  };
}

export function getStoredLicenseSession(): StoredLicenseSession | null {
  try {
    const data = localStorage.getItem(LICENSE_SESSION_KEY);
    if (!data) return null;
    return JSON.parse(data) as StoredLicenseSession;
  } catch {
    return null;
  }
}

export function saveLicenseSession(session: StoredLicenseSession): void {
  localStorage.setItem(LICENSE_SESSION_KEY, JSON.stringify(session));
}

export function clearLicenseSession(): void {
  localStorage.removeItem(LICENSE_SESSION_KEY);
}

// Activate via protected backend
export async function activateLicenseOnServer(params: {
  rawKey: string;
  memberId: string;
}): Promise<{
  success: boolean;
  status: string;
  message: string;
  session?: StoredLicenseSession;
}> {
  const installationId = getDeviceInstallationId();
  const { fingerprint, info } = getDeviceFingerprint();

  try {
    const res = await fetch('/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawKey: params.rawKey.trim().toUpperCase(),
        memberId: params.memberId.trim() || 'Member',
        installationId,
        deviceFingerprint: fingerprint,
        deviceInfo: info,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        status: data.status || 'ERROR',
        message: data.message || 'Activation failed.',
      };
    }

    const session: StoredLicenseSession = {
      licenseId: data.license.id,
      keyMask: data.license.keyMask,
      duration: data.license.duration,
      expiresAt: data.license.expiresAt,
      installationId: data.device.installationId,
      memberId: data.device.memberId,
      activatedAt: data.device.activatedAt,
      status: 'ACTIVE',
    };

    saveLicenseSession(session);

    return {
      success: true,
      status: 'ACTIVE',
      message: data.message || 'License activated successfully.',
      session,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'NETWORK_ERROR',
      message: 'Failed to contact license activation server. Please check your connection.',
    };
  }
}

// Verify current device session with backend
export async function verifyLicenseSessionOnServer(
  session: StoredLicenseSession
): Promise<{ valid: boolean; status: string; message: string; session?: StoredLicenseSession }> {
  try {
    const res = await fetch('/api/license/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installationId: session.installationId,
        licenseId: session.licenseId,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.valid) {
      // Clear invalid session
      clearLicenseSession();
      return {
        valid: false,
        status: data.status || 'INVALID',
        message: data.message || 'License authorization expired or invalidated.',
      };
    }

    // Refresh expiry if updated
    const updatedSession: StoredLicenseSession = {
      ...session,
      expiresAt: data.license?.expiresAt || session.expiresAt,
      status: data.device?.status || 'ACTIVE',
    };
    saveLicenseSession(updatedSession);

    return {
      valid: true,
      status: 'ACTIVE',
      message: 'Session valid',
      session: updatedSession,
    };
  } catch (err) {
    // If backend cannot be reached temporarily, don't immediately lock if not expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      clearLicenseSession();
      return {
        valid: false,
        status: 'EXPIRED',
        message: 'Your license key has expired.',
      };
    }
    return {
      valid: true,
      status: 'ACTIVE',
      message: 'Offline verification fallback',
      session,
    };
  }
}
