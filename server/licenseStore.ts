import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  LicenseDuration,
  LicenseStatus,
  LicenseRecord,
  DeviceStatus,
  DeviceActivationRecord,
  AuditLogRecord,
} from '../src/types';

interface DatabaseSchema {
  licenses: LicenseRecord[];
  deviceActivations: DeviceActivationRecord[];
  auditLogs: AuditLogRecord[];
  users: Array<{
    id: string;
    memberId: string;
    activeLicenseId?: string;
    createdAt: string;
    lastSeenAt: string;
  }>;
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'license_db.json');

// Ensure directory and initial DB exist
function ensureDb(): DatabaseSchema {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    // Generate an initial seeded available demo key for convenience if none exists
    const initialDb: DatabaseSchema = {
      licenses: [],
      deviceActivations: [],
      auditLogs: [],
      users: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch (err) {
    console.error('Failed reading license_db.json, reinitializing...', err);
    const initialDb: DatabaseSchema = {
      licenses: [],
      deviceActivations: [],
      auditLogs: [],
      users: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }
}

function saveDb(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed saving database:', err);
  }
}

// In-memory mutex locks for atomic key activation
const activationLocks = new Set<string>();

export function hashLicenseKey(rawKey: string): string {
  const normalized = rawKey.trim().toUpperCase().replace(/[\s-]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function maskLicenseKey(rawKey: string): string {
  const clean = rawKey.trim().toUpperCase();
  const parts = clean.split('-');
  if (parts.length >= 4) {
    return `${parts[0]}-****-****-${parts[parts.length - 1]}`;
  }
  if (clean.length > 8) {
    return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
  }
  return 'OXYZ-****-****';
}

// Cryptographically secure unpredictable random key generator
// Format: OXYZ-XXXX-XXXX-XXXX-XXXX (using 2-9, A-H, J-N, P-Z to avoid visually ambiguous characters)
export function generateCryptographicKey(): string {
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const getChunk = (len: number) => {
    const bytes = crypto.randomBytes(len);
    let chunk = '';
    for (let i = 0; i < len; i++) {
      chunk += charset[bytes[i] % charset.length];
    }
    return chunk;
  };

  return `OXYZ-${getChunk(4)}-${getChunk(4)}-${getChunk(4)}-${getChunk(4)}`;
}

// Rate limiter for activation attempts per IP/installation ID
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(identifier: string): { limited: boolean; remaining: number; resetInSec: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return { limited: false, remaining: MAX_ATTEMPTS - 1, resetInSec: Math.ceil(RATE_WINDOW_MS / 1000) };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const resetInSec = Math.ceil((record.resetTime - now) / 1000);
    return { limited: true, remaining: 0, resetInSec };
  }

  record.count += 1;
  const resetInSec = Math.ceil((record.resetTime - now) / 1000);
  return { limited: false, remaining: MAX_ATTEMPTS - record.count, resetInSec };
}

export function resetRateLimit(identifier: string) {
  rateLimitMap.delete(identifier);
}

// Helper to log audit events
export function addAuditLog(
  action: string,
  actor: string,
  target: string,
  details: string,
  ip: string = 'internal'
): AuditLogRecord {
  const db = ensureDb();
  const log: AuditLogRecord = {
    id: `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    action,
    actor,
    target,
    details,
    ip,
  };
  db.auditLogs.unshift(log);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  saveDb(db);
  return log;
}

// Check and update expired licenses and devices
export function refreshExpirations(): void {
  const db = ensureDb();
  let changed = false;
  const now = new Date();

  for (const lic of db.licenses) {
    if (lic.status === 'ACTIVATED' && lic.expiresAt) {
      if (new Date(lic.expiresAt) < now) {
        lic.status = 'EXPIRED';
        changed = true;
        addAuditLog('KEY_EXPIRED', 'system', lic.id, `License ${lic.keyMask} reached expiry date`);
      }
    }
  }

  for (const dev of db.deviceActivations) {
    if (dev.status === 'ACTIVE' && dev.expiresAt) {
      if (new Date(dev.expiresAt) < now) {
        dev.status = 'DEACTIVATED';
        changed = true;
      }
    }
  }

  if (changed) {
    saveDb(db);
  }
}

// Generate new license by Admin
export function createLicense(params: {
  duration: LicenseDuration;
  maxDevices?: number;
  note?: string;
  adminUser: string;
  ip: string;
}): { rawKey: string; license: LicenseRecord } {
  const db = ensureDb();
  const rawKey = generateCryptographicKey();
  const keyHash = hashLicenseKey(rawKey);
  const keyMask = maskLicenseKey(rawKey);

  let durationDays: number | null = null;
  if (params.duration === '1d') durationDays = 1;
  else if (params.duration === '7d') durationDays = 7;
  else if (params.duration === '30d') durationDays = 30;

  const license: LicenseRecord = {
    id: `lic_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    keyHash,
    keyMask,
    duration: params.duration,
    durationDays,
    maxDevices: Math.max(1, params.maxDevices || 1),
    status: 'AVAILABLE',
    createdAt: new Date().toISOString(),
    activatedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    activationCount: 0,
    note: params.note || '',
    assignedMemberId: null,
  };

  db.licenses.unshift(license);
  saveDb(db);

  addAuditLog(
    'KEY_GENERATED',
    params.adminUser,
    license.id,
    `Generated ${params.duration} key (${license.maxDevices} device max) with mask ${keyMask}. Note: ${params.note || 'None'}`,
    params.ip
  );

  return { rawKey, license };
}

// Atomic activation of a key by a Member
export async function activateLicense(params: {
  rawKey: string;
  memberId: string;
  installationId: string;
  deviceFingerprint: string;
  deviceInfo?: { browser?: string; os?: string; platform?: string };
  ip: string;
}): Promise<{
  success: boolean;
  status: string;
  message: string;
  license?: LicenseRecord;
  device?: DeviceActivationRecord;
}> {
  refreshExpirations();
  const keyHash = hashLicenseKey(params.rawKey);

  // Atomic lock check to prevent concurrent redemption race
  if (activationLocks.has(keyHash)) {
    return {
      success: false,
      status: 'BUSY',
      message: 'License activation is currently processing. Please try again in a moment.',
    };
  }

  activationLocks.add(keyHash);
  try {
    const db = ensureDb();
    const license = db.licenses.find((l) => l.keyHash === keyHash);

    if (!license) {
      addAuditLog(
        'ACTIVATION_ATTEMPT_FAILED',
        params.memberId || 'anonymous',
        'unknown',
        `Invalid key attempt for hash prefix ${keyHash.slice(0, 8)}`,
        params.ip
      );
      return {
        success: false,
        status: 'INVALID',
        message: 'Invalid license key. Please verify and re-enter, or contact the admin.',
      };
    }

    if (license.status === 'REVOKED') {
      addAuditLog(
        'ACTIVATION_ATTEMPT_FAILED',
        params.memberId,
        license.id,
        `Attempted activation of revoked license ${license.keyMask}`,
        params.ip
      );
      return {
        success: false,
        status: 'REVOKED',
        message: `This license key has been revoked by the administrator (${license.revocationReason || 'Access cancelled'}).`,
      };
    }

    if (license.status === 'EXPIRED') {
      return {
        success: false,
        status: 'EXPIRED',
        message: 'This license key has expired. Please contact the administrator for a renewed key.',
      };
    }

    // Check if this exact device is already registered under this license
    const existingDevice = db.deviceActivations.find(
      (d) => d.licenseId === license.id && d.installationId === params.installationId
    );

    if (existingDevice) {
      if (existingDevice.status === 'SUSPENDED') {
        return {
          success: false,
          status: 'SUSPENDED',
          message: 'This device registration has been suspended by the administrator.',
        };
      }
      if (existingDevice.status === 'REVOKED') {
        return {
          success: false,
          status: 'REVOKED',
          message: 'This device registration was revoked by the administrator.',
        };
      }

      // Refresh last validated timestamp and grant access
      existingDevice.lastValidatedAt = new Date().toISOString();
      existingDevice.status = 'ACTIVE';
      saveDb(db);

      addAuditLog(
        'DEVICE_REVALIDATED',
        params.memberId,
        existingDevice.id,
        `Device ${existingDevice.installationId.slice(0, 10)} resumed active session`,
        params.ip
      );

      return {
        success: true,
        status: 'ACTIVE',
        message: 'License verified successfully.',
        license,
        device: existingDevice,
      };
    }

    // New device activation: Check device activation capacity
    const activeDevices = db.deviceActivations.filter(
      (d) => d.licenseId === license.id && (d.status === 'ACTIVE' || d.status === 'SUSPENDED')
    );

    if (activeDevices.length >= license.maxDevices) {
      addAuditLog(
        'ACTIVATION_ATTEMPT_FAILED',
        params.memberId,
        license.id,
        `Device limit exceeded (${activeDevices.length}/${license.maxDevices}) for ${license.keyMask}`,
        params.ip
      );
      return {
        success: false,
        status: 'LIMIT_REACHED',
        message: `Activation limit reached! This key permits a maximum of ${license.maxDevices} device(s) (Currently used: ${activeDevices.length}).`,
      };
    }

    // Calculate expiration if activating for the first time
    const now = new Date();
    let expiresAt: string | null = license.expiresAt;

    if (!license.activatedAt) {
      license.activatedAt = now.toISOString();
      if (license.durationDays) {
        const expDate = new Date(now.getTime() + license.durationDays * 24 * 60 * 60 * 1000);
        expiresAt = expDate.toISOString();
        license.expiresAt = expiresAt;
      } else {
        license.expiresAt = null; // Lifetime
      }
    }

    license.status = 'ACTIVATED';
    license.activationCount = activeDevices.length + 1;
    if (!license.assignedMemberId) {
      license.assignedMemberId = params.memberId || 'Member';
    }

    // Register new device activation
    const newDevice: DeviceActivationRecord = {
      id: `dev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      licenseId: license.id,
      licenseMask: license.keyMask,
      memberId: params.memberId || 'Member',
      installationId: params.installationId,
      deviceFingerprint: params.deviceFingerprint,
      deviceInfo: params.deviceInfo,
      ipAddress: params.ip,
      status: 'ACTIVE',
      activatedAt: now.toISOString(),
      expiresAt: license.expiresAt,
      lastValidatedAt: now.toISOString(),
    };

    db.deviceActivations.push(newDevice);

    // Track user record
    let user = db.users.find((u) => u.memberId === params.memberId);
    if (!user) {
      user = {
        id: `usr_${Date.now()}`,
        memberId: params.memberId || 'Member',
        activeLicenseId: license.id,
        createdAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
      };
      db.users.push(user);
    } else {
      user.activeLicenseId = license.id;
      user.lastSeenAt = now.toISOString();
    }

    saveDb(db);

    addAuditLog(
      'KEY_ACTIVATED',
      params.memberId,
      license.id,
      `Key ${license.keyMask} activated on device ${newDevice.installationId.slice(0, 10)} (Duration: ${license.duration})`,
      params.ip
    );

    return {
      success: true,
      status: 'ACTIVE',
      message: 'License activated successfully! Welcome to the dashboard.',
      license,
      device: newDevice,
    };
  } finally {
    activationLocks.delete(keyHash);
  }
}

// Continuous verification endpoint for active clients
export function verifyDeviceSession(params: {
  installationId: string;
  licenseId: string;
  ip: string;
}): {
  valid: boolean;
  status: string;
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
} {
  refreshExpirations();
  const db = ensureDb();

  const device = db.deviceActivations.find(
    (d) => d.installationId === params.installationId && d.licenseId === params.licenseId
  );

  if (!device) {
    return {
      valid: false,
      status: 'NOT_FOUND',
      message: 'No registered device session found for this installation. Please activate your license key.',
    };
  }

  if (device.status === 'SUSPENDED') {
    return {
      valid: false,
      status: 'SUSPENDED',
      message: 'Access for this device has been suspended by the administrator.',
    };
  }

  if (device.status === 'REVOKED' || device.status === 'DEACTIVATED') {
    return {
      valid: false,
      status: 'DEACTIVATED',
      message: 'Device access is deactivated or revoked. Please contact administrator.',
    };
  }

  const license = db.licenses.find((l) => l.id === device.licenseId);
  if (!license) {
    return {
      valid: false,
      status: 'INVALID',
      message: 'Associated license record could not be found.',
    };
  }

  if (license.status === 'REVOKED') {
    return {
      valid: false,
      status: 'REVOKED',
      message: `License has been revoked: ${license.revocationReason || 'Administrative termination'}.`,
    };
  }

  if (license.status === 'EXPIRED') {
    return {
      valid: false,
      status: 'EXPIRED',
      message: 'License key has expired.',
    };
  }

  // Update lastValidatedAt
  device.lastValidatedAt = new Date().toISOString();
  saveDb(db);

  const activeCount = db.deviceActivations.filter(
    (d) => d.licenseId === license.id && d.status === 'ACTIVE'
  ).length;

  return {
    valid: true,
    status: 'ACTIVE',
    message: 'Active license session verified.',
    license: {
      id: license.id,
      keyMask: license.keyMask,
      duration: license.duration,
      expiresAt: license.expiresAt,
      maxDevices: license.maxDevices,
      activeDevices: activeCount,
    },
    device: {
      id: device.id,
      installationId: device.installationId,
      status: device.status,
      expiresAt: device.expiresAt,
    },
  };
}

// Revoke a license by Admin
export function revokeLicense(params: {
  licenseId: string;
  reason?: string;
  adminUser: string;
  ip: string;
}): boolean {
  const db = ensureDb();
  const license = db.licenses.find((l) => l.id === params.licenseId);
  if (!license) return false;

  license.status = 'REVOKED';
  license.revokedAt = new Date().toISOString();
  license.revocationReason = params.reason || 'Revoked by admin';

  // Suspend all associated active devices
  for (const dev of db.deviceActivations) {
    if (dev.licenseId === license.id && dev.status === 'ACTIVE') {
      dev.status = 'REVOKED';
    }
  }

  saveDb(db);

  addAuditLog(
    'KEY_REVOKED',
    params.adminUser,
    license.id,
    `Revoked license ${license.keyMask}. Reason: ${params.reason || 'None provided'}`,
    params.ip
  );

  return true;
}

// Delete a license permanently by Admin (remove key option requested by user)
export function deleteLicense(params: {
  licenseId: string;
  adminUser: string;
  ip: string;
}): boolean {
  const db = ensureDb();
  const index = db.licenses.findIndex((l) => l.id === params.licenseId);
  if (index === -1) return false;

  const [removed] = db.licenses.splice(index, 1);

  // Clean up associated device activations
  db.deviceActivations = db.deviceActivations.filter((dev) => dev.licenseId !== params.licenseId);

  // Clean up user active references
  for (const user of db.users) {
    if (user.activeLicenseId === params.licenseId) {
      delete user.activeLicenseId;
    }
  }

  saveDb(db);

  addAuditLog(
    'KEY_REVOKED',
    params.adminUser,
    params.licenseId,
    `Permanently deleted license key ${removed.keyMask} (${removed.duration})`,
    params.ip
  );

  return true;
}

// Delete multiple licenses in batch (e.g. selected keys or expired/revoked)
export function deleteMultipleLicenses(params: {
  licenseIds: string[];
  adminUser: string;
  ip: string;
}): { deletedCount: number } {
  const db = ensureDb();
  const idSet = new Set(params.licenseIds);

  const initialCount = db.licenses.length;
  db.licenses = db.licenses.filter((l) => !idSet.has(l.id));
  const deletedCount = initialCount - db.licenses.length;

  db.deviceActivations = db.deviceActivations.filter((dev) => !idSet.has(dev.licenseId));

  for (const user of db.users) {
    if (user.activeLicenseId && idSet.has(user.activeLicenseId)) {
      delete user.activeLicenseId;
    }
  }

  saveDb(db);

  addAuditLog(
    'KEY_REVOKED',
    params.adminUser,
    'batch',
    `Permanently deleted ${deletedCount} license key(s)`,
    params.ip
  );

  return { deletedCount };
}

// Update device status by Admin
export function updateDeviceStatus(params: {
  deviceId: string;
  status: DeviceStatus;
  adminUser: string;
  ip: string;
}): boolean {
  const db = ensureDb();
  const device = db.deviceActivations.find((d) => d.id === params.deviceId);
  if (!device) return false;

  const oldStatus = device.status;
  device.status = params.status;
  saveDb(db);

  addAuditLog(
    'DEVICE_STATUS_CHANGED',
    params.adminUser,
    device.id,
    `Changed device ${device.installationId.slice(0, 10)} status from ${oldStatus} to ${params.status}`,
    params.ip
  );

  return true;
}

// Get admin stats & lists
export function getAdminStats() {
  refreshExpirations();
  const db = ensureDb();

  const total = db.licenses.length;
  const available = db.licenses.filter((l) => l.status === 'AVAILABLE').length;
  const activated = db.licenses.filter((l) => l.status === 'ACTIVATED').length;
  const expired = db.licenses.filter((l) => l.status === 'EXPIRED').length;
  const revoked = db.licenses.filter((l) => l.status === 'REVOKED').length;

  const totalDevices = db.deviceActivations.length;
  const activeDevices = db.deviceActivations.filter((d) => d.status === 'ACTIVE').length;
  const suspendedDevices = db.deviceActivations.filter((d) => d.status === 'SUSPENDED').length;

  return {
    totalKeys: total,
    available,
    activated,
    expired,
    revoked,
    totalDevices,
    activeDevices,
    suspendedDevices,
  };
}

export function getAllLicenses(filterStatus?: string, search?: string) {
  refreshExpirations();
  const db = ensureDb();
  let list = db.licenses;

  if (filterStatus && filterStatus !== 'ALL') {
    list = list.filter((l) => l.status === filterStatus);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (l) =>
        l.keyMask.toLowerCase().includes(q) ||
        (l.note && l.note.toLowerCase().includes(q)) ||
        (l.assignedMemberId && l.assignedMemberId.toLowerCase().includes(q))
    );
  }

  return list;
}

export function getAllDevices(filterStatus?: string, search?: string) {
  refreshExpirations();
  const db = ensureDb();
  let list = db.deviceActivations;

  if (filterStatus && filterStatus !== 'ALL') {
    list = list.filter((d) => d.status === filterStatus);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (d) =>
        d.installationId.toLowerCase().includes(q) ||
        d.memberId.toLowerCase().includes(q) ||
        d.licenseMask.toLowerCase().includes(q) ||
        d.ipAddress.toLowerCase().includes(q)
    );
  }

  return list;
}

export function getAuditLogs(limit: number = 100) {
  const db = ensureDb();
  return db.auditLogs.slice(0, limit);
}
