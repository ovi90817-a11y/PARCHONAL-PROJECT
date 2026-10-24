import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import {
  activateLicense,
  checkRateLimit,
  createLicense,
  getAdminStats,
  getAllDevices,
  getAllLicenses,
  getAuditLogs,
  revokeLicense,
  deleteLicense,
  deleteMultipleLicenses,
  updateDeviceStatus,
  verifyDeviceSession,
} from './server/licenseStore';
import {
  getMaskedSmsConfig,
  saveSmsConfig,
  testSmsProvider,
  getPublicProviderStatus,
  orderRealNumber,
  checkIncomingSms,
  cancelRealOrder,
  finishRealOrder,
  getAllOrders,
  createCustomNumberOrder,
  confirmOrderOtp,
} from './server/smsProviderStore';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Full CORS support for cross-origin access, dev tunnels, mobile browsers, and webviews
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-installation-id, x-license-id, x-admin-auth'
  );
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Admin credentials
const ADMIN_USER = 'oxz_kira99';
const ADMIN_PASS = 'oxybbz9884';

// Helper to authenticate admin requests
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['x-admin-auth'] as string;
  const authQuery = req.headers.authorization;
  const bodyUser = req.body?.adminUser;
  const bodyPass = req.body?.adminPass;

  let isValid = false;

  if (authHeader) {
    const [u, p] = Buffer.from(authHeader, 'base64').toString('utf-8').split(':');
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      isValid = true;
    }
  } else if (authQuery && authQuery.startsWith('Basic ')) {
    const creds = Buffer.from(authQuery.slice(6), 'base64').toString('utf-8');
    const [u, p] = creds.split(':');
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      isValid = true;
    }
  } else if (bodyUser === ADMIN_USER && bodyPass === ADMIN_PASS) {
    isValid = true;
  }

  if (!isValid) {
    res.status(401).json({ error: 'Unauthorized: Invalid admin credentials' });
    return;
  }

  next();
}

// ----------------- MEMBER LICENSE ENDPOINTS ----------------- //

// Activate a license key for a member device
app.post('/api/license/activate', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const { rawKey, memberId, installationId, deviceFingerprint, deviceInfo } = req.body;

  if (!rawKey || typeof rawKey !== 'string') {
    res.status(400).json({ success: false, status: 'INVALID', message: 'License key is required.' });
    return;
  }

  if (!installationId || typeof installationId !== 'string') {
    res.status(400).json({ success: false, status: 'INVALID', message: 'Valid device installation identifier is required.' });
    return;
  }

  // Rate limit by IP and installation ID to prevent brute force attacks
  const rateKey = `${ip}_${installationId}`;
  const rate = checkRateLimit(rateKey);

  if (rate.limited) {
    res.status(429).json({
      success: false,
      status: 'RATE_LIMITED',
      message: `Too many failed activation attempts. Please wait ${rate.resetInSec} seconds before trying again.`,
    });
    return;
  }

  try {
    const result = await activateLicense({
      rawKey,
      memberId: memberId || 'Guest_Member',
      installationId,
      deviceFingerprint: deviceFingerprint || 'Unknown Browser',
      deviceInfo,
      ip,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (err: any) {
    console.error('License activation error:', err);
    res.status(500).json({ success: false, status: 'ERROR', message: 'Internal activation failure.' });
  }
});

// Continuous device verification check
app.post('/api/license/verify', (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const { installationId, licenseId } = req.body;

  if (!installationId || !licenseId) {
    res.status(400).json({ valid: false, status: 'INVALID', message: 'Installation ID and License ID required.' });
    return;
  }

  const result = verifyDeviceSession({
    installationId,
    licenseId,
    ip,
  });

  if (!result.valid) {
    res.status(403).json(result);
    return;
  }

  res.json(result);
});

// ----------------- ADMIN DASHBOARD ENDPOINTS ----------------- //

// Admin stats overview
app.get('/api/admin/stats', requireAdmin, (req: Request, res: Response) => {
  const stats = getAdminStats();
  res.json(stats);
});

// List all licenses with filter and search
app.get('/api/admin/licenses', requireAdmin, (req: Request, res: Response) => {
  const filter = (req.query.status as string) || 'ALL';
  const search = (req.query.search as string) || '';
  const list = getAllLicenses(filter, search);
  res.json(list);
});

// Generate a new secure cryptographic license key
app.post('/api/admin/licenses/generate', requireAdmin, (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const { duration, maxDevices, note } = req.body;

  if (!duration || !['1d', '7d', '30d', 'lifetime'].includes(duration)) {
    res.status(400).json({ error: 'Valid duration required: 1d, 7d, 30d, or lifetime' });
    return;
  }

  const result = createLicense({
    duration,
    maxDevices: Number(maxDevices) || 1,
    note: note ? String(note).slice(0, 100) : '',
    adminUser: ADMIN_USER,
    ip,
  });

  res.json(result);
});

// Revoke a license
app.post('/api/admin/licenses/:id/revoke', requireAdmin, (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const { reason } = req.body;
  const success = revokeLicense({
    licenseId: req.params.id,
    reason: reason || 'Revoked via Admin Console',
    adminUser: ADMIN_USER,
    ip,
  });

  if (!success) {
    res.status(404).json({ error: 'License not found' });
    return;
  }

  res.json({ success: true, message: 'License revoked and associated active devices suspended.' });
});

// Delete a single license permanently (remove key option requested by user)
app.delete('/api/admin/licenses/:id', requireAdmin, (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const success = deleteLicense({
    licenseId: req.params.id,
    adminUser: ADMIN_USER,
    ip,
  });

  if (!success) {
    res.status(404).json({ error: 'License not found' });
    return;
  }

  res.json({ success: true, message: 'License key permanently removed.' });
});

// Also support POST /api/admin/licenses/:id/delete
app.post('/api/admin/licenses/:id/delete', requireAdmin, (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const success = deleteLicense({
    licenseId: req.params.id,
    adminUser: ADMIN_USER,
    ip,
  });

  if (!success) {
    res.status(404).json({ error: 'License not found' });
    return;
  }

  res.json({ success: true, message: 'License key permanently removed.' });
});

// Batch delete multiple licenses
app.post('/api/admin/licenses/batch-delete', requireAdmin, (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const { licenseIds } = req.body;

  if (!Array.isArray(licenseIds) || licenseIds.length === 0) {
    res.status(400).json({ error: 'licenseIds array is required' });
    return;
  }

  const result = deleteMultipleLicenses({
    licenseIds,
    adminUser: ADMIN_USER,
    ip,
  });

  res.json({ success: true, deletedCount: result.deletedCount });
});

// List all registered device activations
app.get('/api/admin/devices', requireAdmin, (req: Request, res: Response) => {
  const filter = (req.query.status as string) || 'ALL';
  const search = (req.query.search as string) || '';
  const list = getAllDevices(filter, search);
  res.json(list);
});

// Update device status (e.g. SUSPEND, ACTIVATE, REVOKE, DEACTIVATE)
app.post('/api/admin/devices/:id/status', requireAdmin, (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const { status } = req.body;

  if (!['ACTIVE', 'SUSPENDED', 'REVOKED', 'DEACTIVATED'].includes(status)) {
    res.status(400).json({ error: 'Invalid device status' });
    return;
  }

  const success = updateDeviceStatus({
    deviceId: req.params.id,
    status,
    adminUser: ADMIN_USER,
    ip,
  });

  if (!success) {
    res.status(404).json({ error: 'Device record not found' });
    return;
  }

  res.json({ success: true, message: `Device status changed to ${status}.` });
});

// Audit logs
app.get('/api/admin/audit-logs', requireAdmin, (req: Request, res: Response) => {
  const logs = getAuditLogs(100);
  res.json(logs);
});

// ----------------- SMS PROVIDER & OTP BACKEND ENDPOINTS ----------------- //

// Helper to authenticate member device session
function requireMember(req: Request, res: Response, next: NextFunction) {
  const installationId =
    (req.headers['x-installation-id'] as string) ||
    req.body?.installationId ||
    (req.query?.installationId as string);
  const licenseId =
    (req.headers['x-license-id'] as string) ||
    req.body?.licenseId ||
    (req.query?.licenseId as string);
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  if (!installationId || !licenseId) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Valid member license key session is required to request numbers or receive SMS.',
    });
    return;
  }

  const result = verifyDeviceSession({ installationId, licenseId, ip });
  if (!result.valid) {
    res.status(403).json({
      success: false,
      error: `License access invalid: ${result.message}`,
    });
    return;
  }

  (req as any).memberId = installationId;
  next();
}

// Admin: Get current SMS provider config (masked secret key)
app.get('/api/admin/sms/config', requireAdmin, (_req: Request, res: Response) => {
  const config = getMaskedSmsConfig();
  res.json(config);
});

// Admin: Save SMS provider configuration
app.post('/api/admin/sms/config', requireAdmin, (req: Request, res: Response) => {
  const { providerName, apiUrl, apiKey, serviceCode, countryCode } = req.body;
  const updated = saveSmsConfig({
    providerName,
    apiUrl,
    apiKey,
    serviceCode,
    countryCode,
  });
  res.json({
    success: true,
    message: 'SMS Provider configuration updated successfully.',
    config: getMaskedSmsConfig(),
  });
});

// Admin: Test SMS Provider API and fetch live balance
app.post('/api/admin/sms/test', requireAdmin, async (req: Request, res: Response) => {
  const { apiUrl, apiKey, providerName } = req.body || {};
  const result = await testSmsProvider({ apiUrl, apiKey, providerName });
  res.json(result);
});

// Admin: List all real provider orders
app.get('/api/admin/sms/orders', requireAdmin, (_req: Request, res: Response) => {
  const orders = getAllOrders();
  res.json(orders);
});

// Member/Public: Get provider operational status (never leaks API secrets)
app.get('/api/sms/status', (_req: Request, res: Response) => {
  const status = getPublicProviderStatus();
  res.json(status);
});

// Member: Request an actual available number from configured SMS provider
app.post('/api/sms/order', requireMember, async (req: Request, res: Response) => {
  const memberId = (req as any).memberId;
  const { serviceCode, serviceName, countryCode, countryName, rangePattern } = req.body;

  const result = await orderRealNumber({
    memberId,
    serviceCode,
    serviceName,
    countryCode,
    countryName,
    rangePattern,
  });

  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

// Member: Check for incoming SMS on an active order from real provider
app.get('/api/sms/order/:orderId', requireMember, async (req: Request, res: Response) => {
  const memberId = (req as any).memberId;
  const orderId = req.params.orderId;

  const result = await checkIncomingSms(orderId, memberId);
  res.json(result);
});

// Member: Cancel order on real provider (releases number and refunds balance)
app.post('/api/sms/order/:orderId/cancel', requireMember, async (req: Request, res: Response) => {
  const memberId = (req as any).memberId;
  const orderId = req.params.orderId;

  const result = await cancelRealOrder(orderId, memberId);
  res.json(result);
});

// Member: Finish order on real provider (marks official activation completed)
app.post('/api/sms/order/:orderId/finish', requireMember, async (req: Request, res: Response) => {
  const memberId = (req as any).memberId;
  const orderId = req.params.orderId;

  const result = await finishRealOrder(orderId, memberId);
  res.json(result);
});

// Member: Register user's custom phone number to receive OTP
app.post('/api/sms/custom-order', requireMember, async (req: Request, res: Response) => {
  const memberId = (req as any).memberId;
  const { customNumber, serviceName, serviceCode, countryCode, countryName } = req.body;

  const result = await createCustomNumberOrder({
    memberId,
    customNumber,
    serviceName,
    serviceCode,
    countryCode,
    countryName,
  });

  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

// Member: Confirm account with received OTP code (manual or incoming verification)
app.post('/api/sms/order/:orderId/confirm-otp', requireMember, async (req: Request, res: Response) => {
  const memberId = (req as any).memberId;
  const orderId = req.params.orderId;
  const { otpCode } = req.body;

  const result = await confirmOrderOtp({
    orderId,
    memberId,
    otpCode,
  });

  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

// Member: List their active/historical orders
app.get('/api/sms/my-orders', requireMember, (req: Request, res: Response) => {
  const memberId = (req as any).memberId;
  const all = getAllOrders();
  const mine = all.filter((o) => o.memberId === memberId);
  res.json(mine);
});

// ----------------- VITE MIDDLEWARE / STATIC ASSETS ----------------- //

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server boot error:', err);
  process.exit(1);
});
