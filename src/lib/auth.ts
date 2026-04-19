import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import type { UserPayload } from '@/types';

const JWT_SECRET  = process.env.JWT_SECRET ?? 'ciomas-keramik-secret-2024';
const JWT_EXPIRES = '8h';
const COOKIE_NAME = 'auth_token';

// ── Password ──────────────────────────────────────────────────────────────────

export const hashPassword    = (plain: string) => bcrypt.hash(plain, 10);
export const comparePassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// ── JWT ───────────────────────────────────────────────────────────────────────

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

// ── Session (server-side only) ────────────────────────────────────────────────
// Token dibaca dari httpOnly cookie — tidak bisa diakses JS di browser.
// Verifikasi signature JWT dilakukan di sini (Node.js runtime), bukan di middleware.

export async function getSession(): Promise<UserPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return token ? verifyToken(token) : null;
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

const COOKIE_OPTIONS = {
  httpOnly : true,
  secure   : process.env.NODE_ENV === 'production',
  sameSite : 'lax' as const,
  path     : '/',
  maxAge   : 60 * 60 * 3,
};

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, COOKIE_OPTIONS);
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// ── Formatters ────────────────────────────────────────────────────────────────

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
