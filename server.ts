import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = 'youssefeslam906@gmail.com';
const DEFAULT_SMS_TARGET = '201224656839';
const DEFAULT_SENDER_ID = 'RiskUp';

interface FirebaseAppletConfig {
  apiKey?: string;
  projectId?: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8');
    return JSON.parse(raw) as FirebaseAppletConfig;
  } catch {
    return {};
  }
}

interface VerifiedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedUser | null> {
  const { apiKey } = loadFirebaseConfig();
  if (!apiKey || !idToken) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (!user?.localId) return null;
    return {
      uid: user.localId,
      email: user.email ?? '',
      emailVerified: Boolean(user.emailVerified),
    };
  } catch {
    return null;
  }
}

const rateBuckets = new Map<string, number[]>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const prev = (rateBuckets.get(key) ?? []).filter((ts) => now - ts < windowMs);
  if (prev.length >= maxRequests) {
    rateBuckets.set(key, prev);
    return false;
  }
  prev.push(now);
  rateBuckets.set(key, prev);
  return true;
}

function getSmsGatewayStatus() {
  const hasSmsMisr = Boolean(process.env.SMSMISR_USERNAME && process.env.SMSMISR_PASSWORD);
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_FROM || process.env.SMS_SENDER_ID)
  );
  const provider = hasSmsMisr ? 'smsmisr' : hasTwilio ? 'twilio' : 'none';
  return {
    configured: hasSmsMisr || hasTwilio,
    provider,
    senderId: (process.env.SMS_SENDER_ID || DEFAULT_SENDER_ID).slice(0, 11),
  };
}

function normalizeEgyptMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('20') && digits.length === 12) return digits;
  if (digits.startsWith('01') && digits.length === 11) return `2${digits}`;
  return DEFAULT_SMS_TARGET;
}

async function dispatchSms(message: string): Promise<{
  sent: boolean;
  configured: boolean;
  provider: string;
  reason?: string;
}> {
  const status = getSmsGatewayStatus();
  if (!status.configured) {
    return {
      sent: false,
      configured: false,
      provider: 'none',
      reason: 'SMS_GATEWAY_NOT_CONFIGURED',
    };
  }

  const target = normalizeEgyptMobile(process.env.SMS_TARGET_PHONE || DEFAULT_SMS_TARGET);
  const sender = status.senderId;

  if (status.provider === 'smsmisr') {
    const res = await fetch('https://smsmisr.com/api/SMS/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        environment: Number(process.env.SMSMISR_ENVIRONMENT || 1),
        username: process.env.SMSMISR_USERNAME,
        password: process.env.SMSMISR_PASSWORD,
        language: 2,
        sender,
        mobile: target,
        message,
      }),
    });
    if (!res.ok) {
      return { sent: false, configured: true, provider: 'smsmisr', reason: `HTTP_${res.status}` };
    }
    const body = (await res.json()) as { code?: string | number };
    const ok = String(body.code) === '1901' || String(body.code) === '6000';
    return {
      sent: ok,
      configured: true,
      provider: 'smsmisr',
      reason: ok ? undefined : `GATEWAY_CODE_${String(body.code ?? 'UNKNOWN')}`,
    };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
  const token = process.env.TWILIO_AUTH_TOKEN ?? '';
  const from = process.env.TWILIO_FROM || sender;
  const authHeader = Buffer.from(`${sid}:${token}`).toString('base64');

  const params = new URLSearchParams({
    To: `+${target}`,
    From: from,
    Body: message,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    return { sent: false, configured: true, provider: 'twilio', reason: `HTTP_${res.status}` };
  }
  return { sent: true, configured: true, provider: 'twilio' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/sms-status', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const caller = await verifyFirebaseIdToken(token);
    if (!caller || !caller.emailVerified || caller.email !== ADMIN_EMAIL) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    const status = getSmsGatewayStatus();
    res.json({
      configured: status.configured,
      provider: status.provider,
      senderId: status.senderId,
      targetMasked: '0122****839',
    });
  });

  app.post('/api/notify-sms', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const caller = await verifyFirebaseIdToken(token);
    if (!caller || !caller.emailVerified) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    if (!checkRateLimit(`uid:${caller.uid}`, 5, 10 * 60 * 1000)) {
      res.status(429).json({ error: 'RATE_LIMITED' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 30) : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const group = typeof body.group === 'string' ? body.group.trim() : '';
    const ref = typeof body.ref === 'string' ? body.ref.trim().slice(0, 30) : '';
    const playersRaw = Array.isArray(body.players) ? body.players : [];
    const players = playersRaw
      .filter((p): p is string => typeof p === 'string')
      .map((p) => p.trim().slice(0, 30))
      .filter(Boolean)
      .slice(0, 8);

    const isTest = Boolean(body.isTest) && caller.email === ADMIN_EMAIL;

    if (!isTest) {
      if (!name || !/^01[0125]\d{8}$/.test(phone) || !['A', 'B', 'C', 'D'].includes(group) || players.length < 5) {
        res.status(400).json({ error: 'INVALID_PAYLOAD' });
        return;
      }
    }

    const messageLines = isTest
      ? [
          'رسالة اختبار من بطولة RiskUp',
          'نظام إشعارات التسجيل يعمل بنجاح.',
        ]
      : [
          'تسجيل جديد في بطولة RiskUp',
          `الفرقة: ${name}`,
          `المجموعة: ${group}`,
          `الكابتن: ${phone}`,
          `اللاعبون (${players.length}): ${players.join('، ')}`,
          ...(ref ? [`InstaPay: ${ref}`] : []),
        ];

    try {
      const result = await dispatchSms(messageLines.join('\n'));
      res.json(result);
    } catch {
      res.status(502).json({ sent: false, configured: true, provider: 'unknown', reason: 'DISPATCH_FAILED' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Risk Up server running on port ${PORT}`);
  });
}

void startServer();
