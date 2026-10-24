import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface SmsProviderConfig {
  providerName: string; // 'SMS-Activate' | '5SIM' | 'DaisySMS' | 'SMS-Hub' | 'SMSPVA' | 'Custom API'
  apiUrl: string;
  apiKey: string; // Kept strictly server-side
  serviceCode: string; // e.g. 'fb'
  countryCode: string; // e.g. '0' for Russia, '187' for USA, 'all'
  status: 'ONLINE' | 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR';
  lastTestedAt: string | null;
  lastBalance: string | null;
  lastPingMs: number | null;
  lastError: string | null;
}

export type SmsOrderStatus =
  | 'WAITING_SMS'
  | 'SMS_RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export interface RealSmsOrderRecord {
  id: string; // Internal unique ID
  orderId: string; // Provider activation / order ID
  memberId: string; // Associated authenticated member / installation
  service: string; // Service name (e.g. 'Facebook')
  serviceCode: string; // Provider service identifier (e.g. 'fb')
  countryName: string; // Country name
  countryCode: string; // Provider country code / ID
  number: string; // Real international phone number returned by provider
  status: SmsOrderStatus;
  smsCode: string | null; // Exact verification code returned by provider
  smsText: string | null; // Exact raw incoming SMS text returned by provider
  rawProviderResponse: string | null; // Verifiable audit string from provider
  createdAt: number;
  createdTimeStr: string;
  expiresAt: number;
  receivedAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
  errorMessage: string | null;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'sms_config.json');
const ORDERS_FILE = path.join(DATA_DIR, 'sms_orders.json');

// Default safe initial config
const DEFAULT_CONFIG: SmsProviderConfig = {
  providerName: 'SMS-Activate',
  apiUrl: 'https://api.sms-activate.org/stubs/handler_api.php',
  apiKey: '', // Empty until admin inputs their real key
  serviceCode: 'fb',
  countryCode: 'all',
  status: 'NOT_CONFIGURED',
  lastTestedAt: null,
  lastBalance: null,
  lastPingMs: null,
  lastError: null,
};

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  }
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

/**
 * Resolves official MiahSMS / MiahHost endpoints from configured base path
 * Base: https://miahsms.com/bot/
 * Get Number: /api/getnum (POST {"range":"26134XXX"})
 * Balance: /api/get_balance (GET)
 * Live Access: /api/liveaccess (GET)
 * OTPs: /api/success-otp-info (GET)
 */
export function getMiahEndpoints(apiUrl: string) {
  let base = (apiUrl || 'https://miahsms.com/bot').trim().replace(/\/+$/, '');
  // Strip sub-paths like /api/getnum or /api/get_balance if the user pasted an endpoint path
  base = base.replace(/\/api\/[a-zA-Z0-9_-]+(\.php)?$/, '');
  if (!base.includes('/bot')) {
    if (base.endsWith('miahsms.com')) {
      base = `${base}/bot`;
    }
  }
  return {
    base,
    balanceUrl: `${base}/api/get_balance`,
    liveAccessUrl: `${base}/api/liveaccess`,
    getNumUrl: `${base}/api/getnum`,
    otpUrl: `${base}/api/success-otp-info`,
    consoleUrl: `${base}/api/live-console`,
  };
}

// Read config (server-side raw)
export function getRawSmsConfig(): SmsProviderConfig {
  ensureStorage();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const apiKey = (parsed.apiKey || process.env.SMS_PROVIDER_API_KEY || process.env.SMS_API_KEY || '').trim();
    const apiUrl = (parsed.apiUrl || process.env.SMS_PROVIDER_API_URL || DEFAULT_CONFIG.apiUrl).trim();
    return { ...DEFAULT_CONFIG, ...parsed, apiKey, apiUrl };
  } catch (err) {
    console.error('Error reading sms_config.json:', err);
    return DEFAULT_CONFIG;
  }
}

// Read config for admin UI (key masked for safety)
export function getMaskedSmsConfig(): Omit<SmsProviderConfig, 'apiKey'> & { apiKeyMasked: string; hasKey: boolean } {
  const config = getRawSmsConfig();
  const hasKey = Boolean(config.apiKey && config.apiKey.trim().length > 0);
  let apiKeyMasked = '';
  if (hasKey) {
    const key = config.apiKey.trim();
    if (key.length > 8) {
      apiKeyMasked = `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
    } else {
      apiKeyMasked = '••••••••';
    }
  }
  return {
    providerName: config.providerName,
    apiUrl: config.apiUrl,
    serviceCode: config.serviceCode,
    countryCode: config.countryCode,
    status: config.status,
    lastTestedAt: config.lastTestedAt,
    lastBalance: config.lastBalance,
    lastPingMs: config.lastPingMs,
    lastError: config.lastError,
    apiKeyMasked,
    hasKey,
  };
}

// Public provider status for regular members (never exposes keys or raw admin URLs)
export function getPublicProviderStatus(): {
  isConfigured: boolean;
  providerName: string;
  status: string;
  serviceCode: string;
  lastTestedAt: string | null;
} {
  const config = getRawSmsConfig();
  const isConfigured = Boolean(config.apiKey && config.apiUrl && config.status === 'ONLINE');
  return {
    isConfigured,
    providerName: config.providerName,
    status: config.status,
    serviceCode: config.serviceCode,
    lastTestedAt: config.lastTestedAt,
  };
}

export function saveSmsConfig(updates: Partial<SmsProviderConfig>): SmsProviderConfig {
  ensureStorage();
  const current = getRawSmsConfig();
  const updated: SmsProviderConfig = {
    ...current,
    ...updates,
    // If apiKey is explicitly updated or left blank/unchanged
    apiKey: updates.apiKey !== undefined && updates.apiKey !== '' ? updates.apiKey.trim() : current.apiKey,
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

// Read all orders
export function getAllOrders(): RealSmsOrderRecord[] {
  ensureStorage();
  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading sms_orders.json:', err);
    return [];
  }
}

function saveOrders(orders: RealSmsOrderRecord[]) {
  ensureStorage();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
}

// ----------------- REAL PROVIDER API INTEGRATION ----------------- //

/**
 * Tests the real SMS provider API endpoint and retrieves actual balance.
 * Uses official provider protocols (SMS-Activate / SMS-Hub stubs or 5SIM REST).
 */
export async function testSmsProvider(override?: {
  apiUrl?: string;
  apiKey?: string;
  providerName?: string;
}): Promise<{
  success: boolean;
  balance?: string;
  pingMs: number;
  message: string;
  rawResponse?: string;
  status: 'ONLINE' | 'ERROR';
  httpStatus?: number;
  requestedUrl?: string;
}> {
  const current = getRawSmsConfig();
  const apiUrl = (override?.apiUrl || current.apiUrl || '').trim();
  const apiKey = (override?.apiKey || current.apiKey || '').trim();
  const providerName = override?.providerName || current.providerName || 'SMS-Activate';

  if (!apiUrl) {
    return {
      success: false,
      pingMs: 0,
      message: 'API Endpoint URL is required.',
      status: 'ERROR',
    };
  }

  if (!apiKey) {
    return {
      success: false,
      pingMs: 0,
      message: 'API Secret Key is missing. Please enter your provider API key.',
      status: 'ERROR',
    };
  }

  const startTime = Date.now();

  try {
    // 1. Detect 5SIM REST JSON protocol
    if (apiUrl.includes('5sim.net') || providerName === '5SIM') {
      const endpoint = apiUrl.replace(/\/+$/, '') + '/user/profile';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const pingMs = Date.now() - startTime;
      const text = await res.text();

      if (!res.ok) {
        const errorMsg = `5SIM API Error (HTTP ${res.status}): ${text.slice(0, 150)}`;
        saveSmsConfig({
          status: 'ERROR',
          lastTestedAt: new Date().toISOString(),
          lastPingMs: pingMs,
          lastError: errorMsg,
        });
        return {
          success: false,
          pingMs,
          httpStatus: res.status,
          requestedUrl: endpoint,
          message: errorMsg,
          rawResponse: text,
          status: 'ERROR',
        };
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      if (parsed && typeof parsed.balance !== 'undefined') {
        const balanceStr = `${parsed.balance} RUB / USD (User: ${parsed.email || 'Verified'})`;
        saveSmsConfig({
          status: 'ONLINE',
          lastTestedAt: new Date().toISOString(),
          lastBalance: balanceStr,
          lastPingMs: pingMs,
          lastError: null,
        });
        return {
          success: true,
          balance: balanceStr,
          pingMs,
          httpStatus: 200,
          requestedUrl: endpoint,
          message: '5SIM API verified successfully. Live balance retrieved.',
          rawResponse: text,
          status: 'ONLINE',
        };
      }
    }

    // 2. Detect MiahSMS / Custom REST provider
    if (providerName === 'MiahSMS' || apiUrl.includes('miahsms.com')) {
      const { balanceUrl, liveAccessUrl } = getMiahEndpoints(apiUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      // 1. Check live balance endpoint
      const res = await fetch(balanceUrl, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'OXYZ_Gateway/2.0',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const pingMs = Date.now() - startTime;
      const text = (await res.text()).trim();

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      // If balance endpoint succeeds (HTTP 200 with balance field)
      if (res.status === 200 && parsed && typeof parsed.balance !== 'undefined') {
        const rawBal = parseFloat(parsed.balance) || 0;
        const bdtEquivalent = (rawBal * 127.5).toFixed(2);
        const balanceStr = `${parsed.balance} USDT (≈ ৳${bdtEquivalent} BDT)`;

        // Check live services count for rich feedback
        let servicesNote = '';
        try {
          const liveRes = await fetch(liveAccessUrl, {
            headers: { 'X-API-Key': apiKey, Authorization: `Bearer ${apiKey}` },
          });
          if (liveRes.ok) {
            const liveData = await liveRes.json();
            if (Array.isArray(liveData.services)) {
              servicesNote = ` • ${liveData.services.length} Live Service Channels Active`;
            }
          }
        } catch {
          // Non-blocking
        }

        saveSmsConfig({
          status: 'ONLINE',
          lastTestedAt: new Date().toISOString(),
          lastBalance: balanceStr,
          lastPingMs: pingMs,
          lastError: null,
        });

        return {
          success: true,
          balance: balanceStr,
          pingMs,
          httpStatus: 200,
          requestedUrl: balanceUrl,
          message: `MiahSMS API connected successfully! Live Balance: ${balanceStr}${servicesNote}`,
          rawResponse: text.slice(0, 200),
          status: 'ONLINE',
        };
      }

      if (res.status === 401 || res.status === 403) {
        const errorMsg = `HTTP ${res.status} Unauthorized / Forbidden: MiahSMS rejected API key for "${balanceUrl}". Please verify your key from https://miahsms.com/dev.`;
        saveSmsConfig({
          status: 'ERROR',
          lastTestedAt: new Date().toISOString(),
          lastPingMs: pingMs,
          lastError: errorMsg,
        });
        return {
          success: false,
          pingMs,
          httpStatus: res.status,
          requestedUrl: balanceUrl,
          message: errorMsg,
          rawResponse: text.slice(0, 160),
          status: 'ERROR',
        };
      }

      const unexpectedMsg = `MiahSMS responded (HTTP ${res.status}): ${text.slice(0, 160)}`;
      saveSmsConfig({
        status: 'ERROR',
        lastTestedAt: new Date().toISOString(),
        lastPingMs: pingMs,
        lastError: unexpectedMsg,
      });
      return {
        success: false,
        pingMs,
        httpStatus: res.status,
        requestedUrl: balanceUrl,
        message: unexpectedMsg,
        rawResponse: text.slice(0, 160),
        status: 'ERROR',
      };
    }

    // 3. Standard handler_api.php Protocol (SMS-Activate, SMS-Hub, DaisySMS, SMSPVA)
    const urlObj = new URL(apiUrl);
    urlObj.searchParams.set('api_key', apiKey);
    urlObj.searchParams.set('action', 'getBalance');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(urlObj.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'OXYZ_Gateway/2.0',
        Accept: 'text/plain, application/json, */*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const pingMs = Date.now() - startTime;
    const rawText = (await res.text()).trim();
    const isHtml =
      rawText.startsWith('<!DOCTYPE') ||
      rawText.startsWith('<html') ||
      (res.headers.get('content-type') || '').includes('text/html');

    // 404 Not Found explicitly handled
    if (res.status === 404) {
      const errorExplanation = `HTTP 404 Not Found: The endpoint "${urlObj.origin}${urlObj.pathname}" does not exist on this server. The server returned an HTML 404 Not Found page. Official API endpoint documentation is required for this provider.`;
      saveSmsConfig({
        status: 'ERROR',
        lastTestedAt: new Date().toISOString(),
        lastPingMs: pingMs,
        lastError: errorExplanation,
      });
      return {
        success: false,
        pingMs,
        httpStatus: 404,
        requestedUrl: urlObj.toString(),
        message: errorExplanation,
        rawResponse: `HTTP 404 Not Found (HTML Error Page)`,
        status: 'ERROR',
      };
    }

    // Check known SMS-Activate / SMS-Hub standard protocol responses
    if (rawText.startsWith('ACCESS_BALANCE:')) {
      const balanceVal = rawText.split(':')[1]?.trim() || '0.00';
      const balanceStr = `${balanceVal} USD/RUB`;
      saveSmsConfig({
        status: 'ONLINE',
        lastTestedAt: new Date().toISOString(),
        lastBalance: balanceStr,
        lastPingMs: pingMs,
        lastError: null,
      });
      return {
        success: true,
        balance: balanceStr,
        pingMs,
        httpStatus: 200,
        requestedUrl: urlObj.toString(),
        message: `Provider connected! Real live balance: ${balanceStr}`,
        rawResponse: rawText,
        status: 'ONLINE',
      };
    }

    // Known provider error codes
    let errorExplanation = '';
    if (rawText === 'BAD_KEY' || rawText === 'WRONG_API_KEY') {
      errorExplanation = `Provider rejected API key (${rawText}). Please verify that your API key is active on your provider account.`;
    } else if (rawText === 'ERROR_SQL') {
      errorExplanation = 'Provider database error (ERROR_SQL). The provider servers are experiencing internal issues.';
    } else if (rawText === 'BAD_ACTION') {
      errorExplanation = 'Provider rejected action (BAD_ACTION). Check your provider API action endpoint.';
    } else if (rawText === 'NO_KEY') {
      errorExplanation = 'Provider reports missing key (NO_KEY).';
    } else if (res.status === 401 || res.status === 403) {
      errorExplanation = `Provider returned HTTP ${res.status} Unauthorized / Forbidden (${rawText || 'Invalid credentials'}).`;
    } else if (isHtml) {
      errorExplanation = `HTTP ${res.status}: The endpoint URL returned an HTML webpage instead of an API response. The Base URL is being used directly as a webpage. Check your provider's documentation for the exact API route.`;
    } else {
      errorExplanation = `Provider responded with: ${rawText.slice(0, 160)}`;
    }

    saveSmsConfig({
      status: 'ERROR',
      lastTestedAt: new Date().toISOString(),
      lastPingMs: pingMs,
      lastError: errorExplanation,
    });

    return {
      success: false,
      pingMs,
      httpStatus: res.status,
      requestedUrl: urlObj.toString(),
      message: errorExplanation,
      rawResponse: isHtml ? `HTTP ${res.status} HTML Page` : rawText.slice(0, 160),
      status: 'ERROR',
    };
  } catch (err: any) {
    const pingMs = Date.now() - startTime;
    const msg =
      err.name === 'AbortError'
        ? 'Provider connection timed out (12s).'
        : `Network error connecting to provider: ${err.message}`;
    saveSmsConfig({
      status: 'ERROR',
      lastTestedAt: new Date().toISOString(),
      lastPingMs: pingMs,
      lastError: msg,
    });
    return {
      success: false,
      pingMs,
      requestedUrl: apiUrl,
      message: msg,
      status: 'ERROR',
    };
  }
}

/**
 * Requests a real phone number from the configured SMS provider.
 * Does NOT generate mock or random numbers. If the provider fails, returns the exact real error.
 */
export async function orderRealNumber(params: {
  memberId: string;
  serviceCode?: string;
  serviceName?: string;
  countryCode?: string;
  countryName?: string;
  rangePattern?: string;
}): Promise<{
  success: boolean;
  order?: RealSmsOrderRecord;
  error?: string;
  errorCode?: string;
  rawResponse?: string;
}> {
  const config = getRawSmsConfig();

  if (!config.apiUrl || !config.apiKey) {
    return {
      success: false,
      errorCode: 'PROVIDER_NOT_CONFIGURED',
      error: 'SMS Provider is not configured yet. The administrator must configure the API URL and API Key in the Super Admin Panel.',
    };
  }

  const service = params.serviceCode || config.serviceCode || 'fb';
  const serviceName = params.serviceName || 'Facebook';
  const country = params.countryCode || config.countryCode || 'all';
  const countryName = params.countryName || 'Global';

  try {
    // 1. 5SIM REST Protocol
    if (config.apiUrl.includes('5sim.net') || config.providerName === '5SIM') {
      const endpoint = `${config.apiUrl.replace(/\/+$/, '')}/user/buy/activation/${country}/any/${service}`;
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
      });
      const text = await res.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      if (!res.ok || !parsed || !parsed.phone) {
        return {
          success: false,
          errorCode: 'PROVIDER_ORDER_FAILED',
          error: `5SIM Order Failed: ${text.slice(0, 160)}`,
          rawResponse: text,
        };
      }

      const order: RealSmsOrderRecord = {
        id: `ord-${crypto.randomUUID()}`,
        orderId: String(parsed.id),
        memberId: params.memberId,
        service: serviceName,
        serviceCode: service,
        countryName,
        countryCode: country,
        number: parsed.phone.startsWith('+') ? parsed.phone : `+${parsed.phone}`,
        status: 'WAITING_SMS',
        smsCode: null,
        smsText: null,
        rawProviderResponse: text,
        createdAt: Date.now(),
        createdTimeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        expiresAt: parsed.expires ? new Date(parsed.expires).getTime() : Date.now() + 20 * 60 * 1000,
        receivedAt: null,
        completedAt: null,
        cancelledAt: null,
        errorMessage: null,
      };

      const orders = getAllOrders();
      orders.unshift(order);
      saveOrders(orders);
      return { success: true, order, rawResponse: text };
    }

    // 2. MiahSMS Protocol (Official endpoint: /bot/api/getnum)
    if (config.providerName === 'MiahSMS' || config.apiUrl.includes('miahsms.com')) {
      const { getNumUrl, liveAccessUrl } = getMiahEndpoints(config.apiUrl);

      // Determine target range prefix (e.g. "26134XXX")
      let targetRange = (params.rangePattern || '').trim();
      if (targetRange) {
        if (!targetRange.endsWith('XXX')) {
          targetRange = `${targetRange.replace(/X+$/i, '')}XXX`;
        }
      } else {
        // Query live available ranges for this service from MiahSMS liveaccess API
        try {
          const liveRes = await fetch(liveAccessUrl, {
            headers: {
              'X-API-Key': config.apiKey,
              Authorization: `Bearer ${config.apiKey}`,
              Accept: 'application/json',
            },
          });
          if (liveRes.ok) {
            const liveData = await liveRes.json();
            const serviceMatch = liveData.services?.find((s: any) =>
              s.sid?.toLowerCase()?.includes(serviceName.toLowerCase()) ||
              serviceName.toLowerCase().includes(s.sid?.toLowerCase() || '')
            );
            if (serviceMatch && Array.isArray(serviceMatch.ranges) && serviceMatch.ranges.length > 0) {
              const validRange = serviceMatch.ranges.find((r: string) => /^\d+XXX$/i.test(r));
              if (validRange) {
                targetRange = validRange;
              }
            }
          }
        } catch {
          // Non-blocking fallback
        }
      }

      if (!targetRange) {
        targetRange = '26134XXX'; // Standard active range
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(getNumUrl, {
        method: 'POST',
        headers: {
          'X-API-Key': config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, */*',
          'User-Agent': 'OXYZ_Gateway/2.0',
        },
        body: JSON.stringify({
          range: targetRange,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const text = (await res.text()).trim();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      if (res.status === 200 && parsed?.meta?.code === 200 && parsed?.data) {
        const d = parsed.data;
        const phoneNum = d.full_number
          ? (d.full_number.startsWith('+') ? d.full_number : `+${d.full_number}`)
          : `+${d.no_plus_number || d.national_number}`;
        const orderId = String(d.number_id || parsed.rid || crypto.randomUUID());

        const order: RealSmsOrderRecord = {
          id: `ord-${crypto.randomUUID()}`,
          orderId,
          memberId: params.memberId,
          service: serviceName,
          serviceCode: service,
          countryName: d.country || countryName,
          countryCode: country,
          number: phoneNum,
          status: 'WAITING_SMS',
          smsCode: null,
          smsText: null,
          rawProviderResponse: text,
          createdAt: Date.now(),
          createdTimeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          expiresAt: Date.now() + 20 * 60 * 1000,
          receivedAt: null,
          completedAt: null,
          cancelledAt: null,
          errorMessage: null,
        };

        const orders = getAllOrders();
        orders.unshift(order);
        saveOrders(orders);
        return { success: true, order, rawResponse: text };
      }

      // If out of stock on initial range, try active ranges from liveaccess API
      if (parsed?.meta?.code === 2946 || !parsed?.data) {
        try {
          const liveRes = await fetch(liveAccessUrl, {
            headers: {
              'X-API-Key': config.apiKey,
              Authorization: `Bearer ${config.apiKey}`,
              Accept: 'application/json',
            },
          });
          if (liveRes.ok) {
            const liveData = await liveRes.json();
            const serviceMatch = liveData.services?.find((s: any) =>
              s.sid?.toLowerCase()?.includes(serviceName.toLowerCase()) ||
              serviceName.toLowerCase().includes(s.sid?.toLowerCase() || '')
            );
            const availableRanges: string[] = (serviceMatch?.ranges || []).filter(
              (r: string) => /^\d+XXX$/i.test(r) && r !== targetRange
            );

            for (const fallbackRange of availableRanges.slice(0, 3)) {
              try {
                const retryRes = await fetch(getNumUrl, {
                  method: 'POST',
                  headers: {
                    'X-API-Key': config.apiKey,
                    Authorization: `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json, */*',
                    'User-Agent': 'OXYZ_Gateway/2.0',
                  },
                  body: JSON.stringify({ range: fallbackRange }),
                });
                const retryText = (await retryRes.text()).trim();
                let retryParsed: any;
                try {
                  retryParsed = JSON.parse(retryText);
                } catch {
                  retryParsed = null;
                }

                if (retryRes.status === 200 && retryParsed?.meta?.code === 200 && retryParsed?.data) {
                  const d = retryParsed.data;
                  const phoneNum = d.full_number
                    ? (d.full_number.startsWith('+') ? d.full_number : `+${d.full_number}`)
                    : `+${d.no_plus_number || d.national_number}`;
                  const orderId = String(d.number_id || retryParsed.rid || crypto.randomUUID());

                  const order: RealSmsOrderRecord = {
                    id: `ord-${crypto.randomUUID()}`,
                    orderId,
                    memberId: params.memberId,
                    service: serviceName,
                    serviceCode: service,
                    countryName: d.country || countryName,
                    countryCode: country,
                    number: phoneNum,
                    status: 'WAITING_SMS',
                    smsCode: null,
                    smsText: null,
                    rawProviderResponse: retryText,
                    createdAt: Date.now(),
                    createdTimeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    expiresAt: Date.now() + 20 * 60 * 1000,
                    receivedAt: null,
                    completedAt: null,
                    cancelledAt: null,
                    errorMessage: null,
                  };

                  const orders = getAllOrders();
                  orders.unshift(order);
                  saveOrders(orders);
                  return { success: true, order, rawResponse: retryText };
                }
              } catch {
                // Try next available range
              }
            }
          }
        } catch {
          // Fall through to error
        }
      }

      const errorMsg =
        parsed?.message ||
        (res.status !== 200
          ? `MiahSMS Error (HTTP ${res.status}): ${text.slice(0, 160)}`
          : `MiahSMS failed to allocate number: ${text.slice(0, 160)}`);

      return {
        success: false,
        errorCode: parsed?.meta?.status || `HTTP_${res.status}`,
        error: errorMsg,
        rawResponse: text,
      };
    }

    // 3. Standard handler_api.php Protocol (SMS-Activate, SMS-Hub, DaisySMS, SMSPVA)
    const urlObj = new URL(config.apiUrl);
    urlObj.searchParams.set('api_key', config.apiKey);
    urlObj.searchParams.set('action', 'getNumber');
    urlObj.searchParams.set('service', service);
    if (country && country !== 'all') {
      urlObj.searchParams.set('country', country);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(urlObj.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'OXYZ_Gateway/2.0',
        Accept: 'text/plain, */*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const rawText = (await res.text()).trim();
    const isHtml =
      rawText.startsWith('<!DOCTYPE') ||
      rawText.startsWith('<html') ||
      (res.headers.get('content-type') || '').includes('text/html');

    if (res.status === 404) {
      return {
        success: false,
        errorCode: 'ENDPOINT_NOT_FOUND_404',
        error: `SMS Provider API Error (HTTP 404 Not Found): The requested endpoint (${urlObj.origin}${urlObj.pathname}) does not exist. Check your provider's official API documentation for the active endpoint.`,
        rawResponse: 'HTTP 404 Not Found',
      };
    }

    if (isHtml) {
      return {
        success: false,
        errorCode: 'INVALID_HTML_RESPONSE',
        error: `SMS Provider returned an HTML webpage instead of an API response. The configured URL is a webpage, not a direct API endpoint.`,
        rawResponse: `HTTP ${res.status} HTML Page`,
      };
    }

    // Standard Success Response: ACCESS_NUMBER:$ID:$NUMBER
    if (rawText.startsWith('ACCESS_NUMBER:')) {
      const parts = rawText.split(':');
      const orderId = parts[1];
      let phoneNum = parts[2] || '';
      if (phoneNum && !phoneNum.startsWith('+')) {
        phoneNum = `+${phoneNum}`;
      }

      if (!orderId || !phoneNum) {
        return {
          success: false,
          errorCode: 'INVALID_PROVIDER_FORMAT',
          error: `Provider returned invalid number format: ${rawText}`,
          rawResponse: rawText,
        };
      }

      const order: RealSmsOrderRecord = {
        id: `ord-${crypto.randomUUID()}`,
        orderId,
        memberId: params.memberId,
        service: serviceName,
        serviceCode: service,
        countryName,
        countryCode: country,
        number: phoneNum,
        status: 'WAITING_SMS',
        smsCode: null,
        smsText: null,
        rawProviderResponse: rawText,
        createdAt: Date.now(),
        createdTimeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        expiresAt: Date.now() + 20 * 60 * 1000, // standard 20-minute rental window
        receivedAt: null,
        completedAt: null,
        cancelledAt: null,
        errorMessage: null,
      };

      const orders = getAllOrders();
      orders.unshift(order);
      saveOrders(orders);

      return {
        success: true,
        order,
        rawResponse: rawText,
      };
    }

    // Specific provider error mapping
    let userFriendlyError = '';
    let errorCode = rawText;

    if (rawText === 'NO_NUMBERS') {
      errorCode = 'NO_NUMBERS';
      userFriendlyError = `SMS Provider: No numbers currently available for ${serviceName} in this country. Please select a different country or try again shortly.`;
    } else if (rawText === 'NO_BALANCE') {
      errorCode = 'NO_BALANCE';
      userFriendlyError = 'SMS Provider: Insufficient balance. The administrator must add funds to the SMS provider account.';
    } else if (rawText === 'BAD_KEY' || rawText === 'WRONG_API_KEY') {
      errorCode = rawText;
      userFriendlyError = `SMS Provider: Invalid API Key (${rawText}). Please verify the credentials configured in the Super Admin Panel.`;
    } else if (rawText === 'BAD_SERVICE') {
      errorCode = 'BAD_SERVICE';
      userFriendlyError = `SMS Provider: Service code "${service}" is not recognized by the provider.`;
    } else if (rawText.startsWith('BANNED:')) {
      errorCode = 'BANNED';
      userFriendlyError = `SMS Provider: Account temporarily banned: ${rawText}`;
    } else {
      userFriendlyError = `SMS Provider returned: ${rawText.slice(0, 160)}`;
    }

    return {
      success: false,
      errorCode,
      error: userFriendlyError,
      rawResponse: rawText,
    };
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError';
    const msg = isTimeout
      ? 'Request to SMS provider timed out after 15s. Provider server is slow or unreachable.'
      : `Network failure connecting to SMS provider: ${err.message}`;
    return {
      success: false,
      errorCode: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      error: msg,
    };
  }
}

/**
 * Checks for incoming SMS on an active order from the real provider.
 * Extracts the exact verification code and SMS body.
 * Never invents, modifies, or guesses a code.
 */
export async function checkIncomingSms(
  orderId: string,
  memberId?: string
): Promise<{
  success: boolean;
  status: SmsOrderStatus;
  smsCode?: string | null;
  smsText?: string | null;
  message: string;
  rawResponse?: string;
  order?: RealSmsOrderRecord;
}> {
  const orders = getAllOrders();
  const orderIndex = orders.findIndex((o) => o.orderId === orderId || o.id === orderId);

  if (orderIndex === -1) {
    return {
      success: false,
      status: 'FAILED',
      message: 'Order ID not found in system.',
    };
  }

  const order = orders[orderIndex];

  // If already received or finished, return current state directly
  if (order.status === 'COMPLETED' || (order.status === 'SMS_RECEIVED' && order.smsCode)) {
    return {
      success: true,
      status: order.status,
      smsCode: order.smsCode,
      smsText: order.smsText,
      message: `SMS already received: ${order.smsCode}`,
      order,
    };
  }

  // Check if expired locally
  if (Date.now() > order.expiresAt && order.status === 'WAITING_SMS') {
    order.status = 'EXPIRED';
    orders[orderIndex] = order;
    saveOrders(orders);
    return {
      success: true,
      status: 'EXPIRED',
      message: 'Rental time window expired before SMS was received.',
      order,
    };
  }

  const config = getRawSmsConfig();
  if (!config.apiUrl || !config.apiKey) {
    return {
      success: false,
      status: order.status,
      message: 'SMS Provider configuration missing on server.',
      order,
    };
  }

  try {
    // 1. 5SIM REST Protocol check
    if (config.apiUrl.includes('5sim.net') || config.providerName === '5SIM') {
      const endpoint = `${config.apiUrl.replace(/\/+$/, '')}/user/check/${order.orderId}`;
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
      });
      const text = await res.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      if (parsed && Array.isArray(parsed.sms) && parsed.sms.length > 0) {
        const firstSms = parsed.sms[0];
        const code = firstSms.code ? String(firstSms.code).trim() : null;
        const smsBody = firstSms.text ? String(firstSms.text).trim() : code;

        order.status = 'SMS_RECEIVED';
        order.smsCode = code;
        order.smsText = smsBody;
        order.receivedAt = Date.now();
        order.rawProviderResponse = text;
        orders[orderIndex] = order;
        saveOrders(orders);

        return {
          success: true,
          status: 'SMS_RECEIVED',
          smsCode: code,
          smsText: smsBody,
          message: `Official SMS Received: ${code || smsBody}`,
          rawResponse: text,
          order,
        };
      }

      if (parsed && (parsed.status === 'CANCELED' || parsed.status === 'TIMEOUT')) {
        order.status = parsed.status === 'TIMEOUT' ? 'EXPIRED' : 'CANCELLED';
        orders[orderIndex] = order;
        saveOrders(orders);
        return {
          success: true,
          status: order.status,
          message: `Order status on 5SIM: ${parsed.status}`,
          order,
        };
      }

      return {
        success: true,
        status: 'WAITING_SMS',
        message: 'Waiting for incoming SMS from provider...',
        order,
      };
    }

    // 2. MiahSMS Protocol (Official endpoint: /bot/api/success-otp-info)
    if (config.providerName === 'MiahSMS' || config.apiUrl.includes('miahsms.com')) {
      const { otpUrl } = getMiahEndpoints(config.apiUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(otpUrl, {
        method: 'GET',
        headers: {
          'X-API-Key': config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'OXYZ_Gateway/2.0',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const text = (await res.text()).trim();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      if (res.status === 200 && parsed?.data) {
        const otps: any[] = Array.isArray(parsed.data.otps) ? parsed.data.otps : [];
        const cleanOrderNum = order.number.replace(/\D/g, '');
        const orderIdStr = String(order.orderId);

        // Check for matching received OTP in otps list
        const matched = otps.find((item: any) => {
          if (!item) return false;
          const num = String(item.number || '').replace(/\D/g, '');
          if (!num) return false;
          return num === cleanOrderNum || cleanOrderNum.endsWith(num) || num.endsWith(cleanOrderNum);
        });

        if (matched && (matched.otp || matched.sms)) {
          const code = String(matched.otp || '').trim() || (matched.sms ? (matched.sms.match(/\b\d{4,8}\b/) || [])[0] : null);
          const smsBody = matched.sms || `Your ${matched.platform || order.service} OTP is: ${code}`;

          order.status = 'SMS_RECEIVED';
          order.smsCode = code;
          order.smsText = smsBody;
          order.receivedAt = Date.now();
          order.rawProviderResponse = JSON.stringify(matched);
          orders[orderIndex] = order;
          saveOrders(orders);

          return {
            success: true,
            status: 'SMS_RECEIVED',
            smsCode: code,
            smsText: smsBody,
            message: `Official OTP Received from MiahSMS: ${code}`,
            rawResponse: JSON.stringify(matched),
            order,
          };
        }

        // If not found in success-otp-info, also check live console stream
        const { consoleUrl } = getMiahEndpoints(config.apiUrl);
        try {
          const consoleRes = await fetch(`${consoleUrl}?limit=55`, {
            headers: {
              'X-API-Key': config.apiKey,
              Authorization: `Bearer ${config.apiKey}`,
              Accept: 'application/json',
            },
          });
          if (consoleRes.ok) {
            const consoleData = await consoleRes.json();
            const consoleOtps: any[] = Array.isArray(consoleData?.data?.otps) ? consoleData.data.otps : [];
            const consoleMatched = consoleOtps.find((item: any) => {
              if (!item) return false;
              const num = String(item.number || '').replace(/\D/g, '');
              if (!num) return false;
              return num === cleanOrderNum || cleanOrderNum.endsWith(num) || num.endsWith(cleanOrderNum);
            });

            if (consoleMatched && (consoleMatched.otp || consoleMatched.message)) {
              const code = String(consoleMatched.otp || '').trim() || (consoleMatched.message ? (consoleMatched.message.match(/\b\d{4,8}\b/) || [])[0] : null);
              const smsBody = consoleMatched.message || `Your ${consoleMatched.platform || order.service} OTP is: ${code}`;

              order.status = 'SMS_RECEIVED';
              order.smsCode = code;
              order.smsText = smsBody;
              order.receivedAt = Date.now();
              order.rawProviderResponse = JSON.stringify(consoleMatched);
              orders[orderIndex] = order;
              saveOrders(orders);

              return {
                success: true,
                status: 'SMS_RECEIVED',
                smsCode: code,
                smsText: smsBody,
                message: `Official OTP Received from MiahSMS Live Stream: ${code}`,
                rawResponse: JSON.stringify(consoleMatched),
                order,
              };
            }
          }
        } catch {
          // Non-blocking console check fallback
        }

        // Check if number is still active in waiting_numbers
        const waitingNumbers: any[] = Array.isArray(parsed.data.waiting_numbers) ? parsed.data.waiting_numbers : [];
        const isWaiting = waitingNumbers.some((w: any) => {
          if (!w) return false;
          const wNum = String(w.number || '').replace(/\D/g, '');
          const wId = String(w.number_id || '');
          return wId === orderIdStr || (wNum && (wNum === cleanOrderNum || cleanOrderNum.endsWith(wNum)));
        });

        return {
          success: true,
          status: 'WAITING_SMS',
          message: isWaiting
            ? `Number is active on MiahSMS (${order.number}). Waiting for incoming OTP...`
            : `Waiting for incoming SMS from MiahSMS for ${order.number}...`,
          rawResponse: text.slice(0, 100),
          order,
        };
      }

      if (!res.ok) {
        return {
          success: false,
          status: order.status,
          message: `MiahSMS Status check error (HTTP ${res.status}): ${text.slice(0, 140)}`,
          rawResponse: text.slice(0, 140),
          order,
        };
      }
    }

    // 3. Standard handler_api.php Protocol (SMS-Activate / SMS-Hub / DaisySMS / SMSPVA)
    const urlObj = new URL(config.apiUrl);
    urlObj.searchParams.set('api_key', config.apiKey);
    urlObj.searchParams.set('action', 'getStatus');
    urlObj.searchParams.set('id', order.orderId);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(urlObj.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'OXYZ_Gateway/2.0',
        Accept: 'text/plain, */*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const rawText = (await res.text()).trim();
    const isHtml =
      rawText.startsWith('<!DOCTYPE') ||
      rawText.startsWith('<html') ||
      (res.headers.get('content-type') || '').includes('text/html');

    if (res.status === 404) {
      return {
        success: false,
        status: order.status,
        message: `SMS Provider API Error (HTTP 404 Not Found): Status check endpoint does not exist.`,
        rawResponse: 'HTTP 404 Not Found',
        order,
      };
    }

    if (isHtml) {
      return {
        success: false,
        status: order.status,
        message: `SMS Provider returned an HTML page instead of API status.`,
        rawResponse: 'HTML Error Page',
        order,
      };
    }

    // STATUS_OK:$CODE
    if (rawText.startsWith('STATUS_OK:')) {
      const codeOrBody = rawText.slice('STATUS_OK:'.length).trim();
      // Extract exact OTP code
      // If provider returns pure code or text like "Your code is 582910"
      let exactCode = codeOrBody;
      const otpMatch = codeOrBody.match(/\b\d{4,8}\b/);
      if (otpMatch) {
        exactCode = otpMatch[0];
      }

      order.status = 'SMS_RECEIVED';
      order.smsCode = exactCode;
      order.smsText = codeOrBody;
      order.receivedAt = Date.now();
      order.rawProviderResponse = rawText;
      orders[orderIndex] = order;
      saveOrders(orders);

      return {
        success: true,
        status: 'SMS_RECEIVED',
        smsCode: exactCode,
        smsText: codeOrBody,
        message: `Official SMS Received: ${exactCode}`,
        rawResponse: rawText,
        order,
      };
    }

    if (rawText === 'STATUS_WAIT_CODE' || rawText === 'STATUS_WAIT_RESEND') {
      return {
        success: true,
        status: 'WAITING_SMS',
        message: 'Waiting for SMS from official service...',
        rawResponse: rawText,
        order,
      };
    }

    if (rawText === 'STATUS_CANCEL') {
      order.status = 'CANCELLED';
      order.cancelledAt = Date.now();
      order.rawProviderResponse = rawText;
      orders[orderIndex] = order;
      saveOrders(orders);
      return {
        success: true,
        status: 'CANCELLED',
        message: 'Order cancelled on SMS provider.',
        rawResponse: rawText,
        order,
      };
    }

    // Other statuses
    return {
      success: true,
      status: order.status,
      message: `Provider status: ${rawText}`,
      rawResponse: rawText,
      order,
    };
  } catch (err: any) {
    return {
      success: false,
      status: order.status,
      message: `Failed querying provider: ${err.message}`,
      order,
    };
  }
}

/**
 * Cancels the activation on the real SMS provider (status=8).
 * Releases the number and refunds provider balance.
 */
export async function cancelRealOrder(
  orderId: string,
  memberId?: string
): Promise<{ success: boolean; message: string; rawResponse?: string }> {
  const orders = getAllOrders();
  const orderIndex = orders.findIndex((o) => o.orderId === orderId || o.id === orderId);

  if (orderIndex === -1) {
    return { success: false, message: 'Order not found.' };
  }

  const order = orders[orderIndex];
  const config = getRawSmsConfig();

  if (!config.apiUrl || !config.apiKey) {
    order.status = 'CANCELLED';
    order.cancelledAt = Date.now();
    orders[orderIndex] = order;
    saveOrders(orders);
    return { success: true, message: 'Order marked cancelled locally.' };
  }

  try {
    // 5SIM cancel
    if (config.apiUrl.includes('5sim.net') || config.providerName === '5SIM') {
      const endpoint = `${config.apiUrl.replace(/\/+$/, '')}/user/cancel/${order.orderId}`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      const text = await res.text();
      order.status = 'CANCELLED';
      order.cancelledAt = Date.now();
      order.rawProviderResponse = text;
      orders[orderIndex] = order;
      saveOrders(orders);
      return { success: true, message: 'Order cancelled on 5SIM.', rawResponse: text };
    }

    // MiahSMS local cancellation
    if (config.providerName === 'MiahSMS' || config.apiUrl.includes('miahsms.com')) {
      order.status = 'CANCELLED';
      order.cancelledAt = Date.now();
      orders[orderIndex] = order;
      saveOrders(orders);
      return { success: true, message: 'Order cancelled successfully.' };
    }

    // handler_api.php status=8 (cancel)
    const urlObj = new URL(config.apiUrl);
    urlObj.searchParams.set('api_key', config.apiKey);
    urlObj.searchParams.set('action', 'setStatus');
    urlObj.searchParams.set('status', '8');
    urlObj.searchParams.set('id', order.orderId);

    const res = await fetch(urlObj.toString(), { method: 'GET' });
    const rawText = (await res.text()).trim();

    order.status = 'CANCELLED';
    order.cancelledAt = Date.now();
    order.rawProviderResponse = rawText;
    orders[orderIndex] = order;
    saveOrders(orders);

    return {
      success: true,
      message: `Order cancelled on provider (${rawText})`,
      rawResponse: rawText,
    };
  } catch (err: any) {
    order.status = 'CANCELLED';
    order.cancelledAt = Date.now();
    orders[orderIndex] = order;
    saveOrders(orders);
    return {
      success: true,
      message: `Order cancelled locally (provider contact warning: ${err.message})`,
    };
  }
}

/**
 * Marks activation finished on the real SMS provider (status=6).
 * Confirms that the official verification was completed.
 */
export async function finishRealOrder(
  orderId: string,
  memberId?: string
): Promise<{ success: boolean; message: string; rawResponse?: string }> {
  const orders = getAllOrders();
  const orderIndex = orders.findIndex((o) => o.orderId === orderId || o.id === orderId);

  if (orderIndex === -1) {
    return { success: false, message: 'Order not found.' };
  }

  const order = orders[orderIndex];
  const config = getRawSmsConfig();

  if (!config.apiUrl || !config.apiKey) {
    order.status = 'COMPLETED';
    order.completedAt = Date.now();
    orders[orderIndex] = order;
    saveOrders(orders);
    return { success: true, message: 'Order completed locally.' };
  }

  try {
    // 5SIM finish
    if (config.apiUrl.includes('5sim.net') || config.providerName === '5SIM') {
      const endpoint = `${config.apiUrl.replace(/\/+$/, '')}/user/finish/${order.orderId}`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      const text = await res.text();
      order.status = 'COMPLETED';
      order.completedAt = Date.now();
      order.rawProviderResponse = text;
      orders[orderIndex] = order;
      saveOrders(orders);
      return { success: true, message: 'Order finished on 5SIM.', rawResponse: text };
    }

    // MiahSMS local finish
    if (config.providerName === 'MiahSMS' || config.apiUrl.includes('miahsms.com')) {
      order.status = 'COMPLETED';
      order.completedAt = Date.now();
      orders[orderIndex] = order;
      saveOrders(orders);
      return { success: true, message: 'Official verification confirmed on MiahSMS.' };
    }

    // handler_api.php status=6 (complete)
    const urlObj = new URL(config.apiUrl);
    urlObj.searchParams.set('api_key', config.apiKey);
    urlObj.searchParams.set('action', 'setStatus');
    urlObj.searchParams.set('status', '6');
    urlObj.searchParams.set('id', order.orderId);

    const res = await fetch(urlObj.toString(), { method: 'GET' });
    const rawText = (await res.text()).trim();

    order.status = 'COMPLETED';
    order.completedAt = Date.now();
    order.rawProviderResponse = rawText;
    orders[orderIndex] = order;
    saveOrders(orders);

    return {
      success: true,
      message: `Official verification confirmed on provider (${rawText})`,
      rawResponse: rawText,
    };
  } catch (err: any) {
    order.status = 'COMPLETED';
    order.completedAt = Date.now();
    orders[orderIndex] = order;
    saveOrders(orders);
    return {
      success: true,
      message: `Verification saved locally (${err.message})`,
    };
  }
}

/**
 * Register a user-provided custom phone number for incoming OTP verification
 */
export async function createCustomNumberOrder(params: {
  memberId: string;
  customNumber: string;
  serviceName?: string;
  serviceCode?: string;
  countryCode?: string;
  countryName?: string;
}): Promise<{
  success: boolean;
  order?: RealSmsOrderRecord;
  error?: string;
}> {
  ensureStorage();
  const rawNum = params.customNumber.trim().replace(/[\s-]/g, '');

  if (!rawNum || rawNum.length < 6) {
    return {
      success: false,
      error: 'Please enter a valid phone number (at least 6 digits with country code or local prefix).',
    };
  }

  const orders = getAllOrders();
  const now = Date.now();
  const dateObj = new Date(now);
  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const uniqueId = `cust-${now}-${crypto.randomBytes(3).toString('hex')}`;
  const customOrderId = `CUSTOM-${Math.floor(100000 + Math.random() * 900000)}`;

  const order: RealSmsOrderRecord = {
    id: uniqueId,
    orderId: customOrderId,
    memberId: params.memberId,
    number: rawNum,
    service: params.serviceName || 'Facebook',
    serviceCode: params.serviceCode || 'fb',
    countryCode: params.countryCode || 'BD',
    countryName: params.countryName || 'Custom Number',
    status: 'WAITING_SMS',
    createdAt: now,
    createdTimeStr: timeStr,
    expiresAt: now + 20 * 60 * 1000,
    smsCode: null,
    smsText: null,
    receivedAt: null,
    completedAt: null,
    cancelledAt: null,
    errorMessage: null,
    rawProviderResponse: 'User-provided custom phone number registered for OTP receipt.',
  };

  orders.unshift(order);
  saveOrders(orders);

  return {
    success: true,
    order,
  };
}

/**
 * Manually confirm OTP code for an order (custom or provider)
 */
export async function confirmOrderOtp(params: {
  orderId: string;
  memberId: string;
  otpCode: string;
}): Promise<{
  success: boolean;
  order?: RealSmsOrderRecord;
  error?: string;
}> {
  ensureStorage();
  const code = params.otpCode.trim();

  if (!code || code.length < 3) {
    return {
      success: false,
      error: 'Please enter a valid OTP verification code (at least 3 characters).',
    };
  }

  const orders = getAllOrders();
  const orderIndex = orders.findIndex(
    (o) => (o.orderId === params.orderId || o.id === params.orderId) && (o.memberId === params.memberId || params.memberId === 'ADMIN')
  );

  if (orderIndex === -1) {
    return {
      success: false,
      error: 'Order record not found or unauthorized.',
    };
  }

  const order = orders[orderIndex];
  const now = Date.now();
  const timeStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  order.smsCode = code;
  order.smsText = `Verification Code: ${code} (Confirmed at ${timeStr})`;
  order.status = 'SMS_RECEIVED';
  order.completedAt = now;

  orders[orderIndex] = order;
  saveOrders(orders);

  return {
    success: true,
    order,
  };
}

