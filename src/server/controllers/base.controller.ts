import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import type { UserPayload } from '@/types';

type Role = UserPayload['role'];

// ── Response helpers ──────────────────────────────────────────────────────────

export function ok<T extends object>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export const created = <T extends object>(data: T) => ok(data, 201);

export const noContent = () => new NextResponse(null, { status: 204 });

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export const unauthorized = (msg = 'Sesi tidak ditemukan, silakan login kembali') => fail(msg, 401);
export const forbidden     = (msg = 'Akses ditolak')                               => fail(msg, 403);

export function serverError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : 'Terjadi kesalahan server';
  console.error('[SERVER ERROR]', err);
  return fail(message, 500);
}

// ── Auth guards ───────────────────────────────────────────────────────────────

export async function requireAuth(): Promise<UserPayload | NextResponse> {
  const session = await getSession();
  return session ?? unauthorized();
}

export async function requireRole(...roles: Role[]): Promise<UserPayload | NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!roles.includes(session.role)) {
    return forbidden(`Hanya ${roles.join(' / ')} yang dapat mengakses fitur ini`);
  }
  return session;
}

// ── Error boundary wrapper ────────────────────────────────────────────────────

export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    return serverError(err);
  }
}
