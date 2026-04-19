import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookie, clearAuthCookie } from '@/lib/auth';
import { AuthService } from '@/server/services/auth.service';
import { ok, fail, handle } from './base.controller';

export const AuthController = {

  async login(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const { username, password } = await req.json();
      const { token, user } = await AuthService.login(username, password);
      await setAuthCookie(token);
      return ok({ user });
    });
  },

  async logout(): Promise<NextResponse> {
    await clearAuthCookie();
    return ok({ message: 'Berhasil keluar' });
  },

  async refresh(): Promise<NextResponse> {
    return handle(async () => {
      const { cookies } = await import('next/headers');
      const store = await cookies();
      const token = store.get('auth_token')?.value;
      if (!token) return fail('Token tidak ditemukan', 401);
      await setAuthCookie(token);
      return ok({ refreshed: true });
    });
  },

};
