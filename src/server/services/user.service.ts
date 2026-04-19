import { hashPassword } from '@/lib/auth';
import { UserRepository } from '@/server/repositories/user.repository';
import type { User, CreateUserDto, UpdateUserDto } from '@/types';

export const UserService = {

  async getAll(search = ''): Promise<User[]> {
    return UserRepository.findAll(search);
  },

  async getById(id: string): Promise<User> {
    const user = await UserRepository.findById(id);
    if (!user) throw new Error('User tidak ditemukan');
    return user;
  },

  async create(dto: CreateUserDto): Promise<User> {
    if (!dto.username || !dto.email || !dto.full_name || !dto.password) {
      throw new Error('Username, email, nama lengkap, dan password wajib diisi');
    }

    const existing = await UserRepository.findByUsernameOrEmail(dto.username, dto.email);
    if (existing) throw new Error('Username atau email sudah digunakan');

    const password_hash = await hashPassword(dto.password);
    return UserRepository.create({ ...dto, password_hash });
  },

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const existing = await UserRepository.findById(id);
    if (!existing) throw new Error('User tidak ditemukan');

    const updateData: UpdateUserDto & { password_hash?: string } = { ...dto };
    if (dto.password) {
      updateData.password_hash = await hashPassword(dto.password);
    }

    const updated = await UserRepository.update(id, updateData);
    if (!updated) throw new Error('Gagal memperbarui user');
    return updated;
  },

  async setActive(id: string, is_active: boolean): Promise<void> {
    const existing = await UserRepository.findById(id);
    if (!existing) throw new Error('User tidak ditemukan');
    await UserRepository.setActive(id, is_active);
  },

};
