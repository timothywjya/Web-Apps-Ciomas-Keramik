import { comparePassword, signToken } from '@/lib/auth';
import { UserRepository } from '@/server/repositories/user.repository';
import type { UserPayload } from '@/types';

export const AuthService = {

  async login(username: string, password: string): Promise<{ token: string; user: UserPayload }> {
    if (!username || !password) throw new Error('Username dan password wajib diisi');

    const user = await UserRepository.findByUsername(username);
    if (!user)            throw new Error('Username tidak ditemukan');
    if (!user.is_active)  throw new Error('Akun tidak aktif, hubungi administrator');

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) throw new Error('Password salah');

    await UserRepository.updateLastLogin(user.id);

    const payload: UserPayload = {
      id       : user.id,
      username : user.username,
      email    : user.email,
      full_name: user.full_name,
      role     : user.role as UserPayload['role'],
    };

    return { token: signToken(payload), user: payload };
  },

};
