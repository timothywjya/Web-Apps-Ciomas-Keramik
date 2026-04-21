import { comparePassword, signToken } from '@/lib/auth';
import { UserRepository }             from '@/server/repositories/user.repository';
import type { UserPayload }           from '@/types';

const GENERIC_AUTH_ERROR = 'Username atau password salah.';

export const AuthService = {

  async login(username: string, password: string): Promise<{ token: string; user: UserPayload }> {
    if (!username || !password) throw new Error(GENERIC_AUTH_ERROR);

    const user = await UserRepository.findByUsername(username);
    const dummyHash = '$2a$12$invalidhashfortimingprotectiononly000000000000000000000';
    const passwordHash = user?.password_hash ?? dummyHash;

    const valid = await comparePassword(password, passwordHash);

    if (!user || !valid) throw new Error(GENERIC_AUTH_ERROR);
    if (!user.is_active)  throw new Error('Akun tidak aktif. Hubungi administrator.');

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
