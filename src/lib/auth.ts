import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { createHmac } from 'crypto';
import type { UserPayload } from '@/types';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(
      `[auth] Environment variable "${key}" is missing or empty. ` +
      `Set a strong random value (≥32 chars) in .env.local`,
    );
  }
  return val;
}

const JWT_SECRET  = requireEnv('JWT_SECRET');
const JWT_EXPIRES = '8h';
const CONTENT_KEY_SECRET = process.env.CONTENT_KEY_SECRET ?? JWT_SECRET;
const COOKIE_NAME = '__Host-auth_token';

export const hashPassword    = (plain: string) => bcrypt.hash(plain, 12); // bumped from 10→12
export const comparePassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export function signToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
}

export function verifyTokenStrict(token: string): UserPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch (err) {
    throw new Error('Token tidak valid atau sudah kedaluwarsa.');
  }
}

export async function getSession(): Promise<UserPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return token ? verifyToken(token) : null;
}

const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours — matches JWT_EXPIRES

const COOKIE_OPTIONS = {
  httpOnly : true,
  secure   : true,                        // __Host- requires secure=true always
  sameSite : 'strict' as const,           // upgraded from lax → strict
  path     : '/',
  maxAge   : SESSION_MAX_AGE,
};

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, COOKIE_OPTIONS);
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export function generateContentKey(resourceId: string, userId: string): string {
  const payload = `${resourceId}:${userId}:${Math.floor(Date.now() / (1000 * 60 * 15))}`; // 15-min bucket
  return createHmac('sha256', CONTENT_KEY_SECRET).update(payload).digest('hex').slice(0, 32);
}

export function verifyContentKey(
  key       : string,
  resourceId: string,
  userId    : string,
): boolean {
  const current  = generateContentKey(resourceId, userId);
  const prevPayload = `${resourceId}:${userId}:${Math.floor(Date.now() / (1000 * 60 * 15)) - 1}`;
  const previous = createHmac('sha256', CONTENT_KEY_SECRET).update(prevPayload).digest('hex').slice(0, 32);
  return key === current || key === previous;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style                : 'currency',
    currency             : 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day  : '2-digit',
    month: 'long',
    year : 'numeric',
  }).format(new Date(date));
}

export function generateInvoiceNumber(prefix = 'INV'): string {
  const now = new Date();
  const yy  = now.getFullYear().toString().slice(-2);
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${yy}${mm}-${seq}`;
}
