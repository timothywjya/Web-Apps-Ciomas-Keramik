export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/server/services/user.service';
import { ok, created, fail, requireRole, handle } from './base.controller';

export const UserController = {

  async list(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin', 'manager');
      if (auth instanceof NextResponse) return auth;
      const search = req.nextUrl.searchParams.get('search') ?? '';
      const users  = await UserService.getAll(search);
      return ok({ users });
    });
  },

  async create(req: NextRequest): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin');
      if (auth instanceof NextResponse) return auth;
      const body = await req.json();
      const user = await UserService.create(body);
      return created({ user });
    });
  },

  async update(req: NextRequest, id: string): Promise<NextResponse> {
    return handle(async () => {
      const auth = await requireRole('admin');
      if (auth instanceof NextResponse) return auth;

      const body = await req.json();

      // Prevent self-deactivation
      if (id === auth.id && body.is_active === false) {
        return fail('Tidak dapat menonaktifkan akun sendiri');
      }

      const user = await UserService.update(id, body);
      return ok({ user });
    });
  },

};
