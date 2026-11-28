import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getBillingDb, type BillingDatabase } from '../db/billingDb.ts';

const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function getAdminAuthMode(db: BillingDatabase = getBillingDb()): {
  mode: 'env_passcode' | 'claimed_password' | 'unclaimed_setup';
} {
  if (process.env.ADMIN_PASSCODE?.trim()) {
    return { mode: 'env_passcode' };
  }
  if (db.getAdminCredential()) {
    return { mode: 'claimed_password' };
  }
  return { mode: 'unclaimed_setup' };
}

export function verifyAdminPassword(password: string, db: BillingDatabase = getBillingDb()): boolean {
  const envPass = process.env.ADMIN_PASSCODE?.trim();
  if (envPass) {
    const a = Buffer.from(password, 'utf8');
    const b = Buffer.from(envPass, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
  return db.verifyClaimedAdminPassword(password);
}

export function issueAdminSessionToken(): { token: string; expiresAt: string } {
  const exp = Date.now() + SESSION_TTL_MS;
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp, nonce })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return {
    token: `${payload}.${sig}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

export function verifyAdminSessionToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match || !verifyAdminSessionToken(match[1])) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }
  return next();
}
