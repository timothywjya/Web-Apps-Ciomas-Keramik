import { dbQuery, dbQueryOne } from './base.repository';
import type { User, CreateUserDto, UpdateUserDto } from '@/types';

const SELECT_SAFE = `
  SELECT id, username, email, full_name, role, phone,
         is_active, last_login, created_at, updated_at
  FROM users
`;

export const UserRepository = {

  async findAll(search = ''): Promise<User[]> {
    if (search) {
      return dbQuery<User>(
        `${SELECT_SAFE}
         WHERE (full_name ILIKE $1 OR username ILIKE $1 OR email ILIKE $1)
         ORDER BY created_at DESC`,
        [`%${search}%`]
      );
    }
    return dbQuery<User>(`${SELECT_SAFE} ORDER BY created_at DESC`);
  },

  async findById(id: string): Promise<User | null> {
    return dbQueryOne<User>(`${SELECT_SAFE} WHERE id = $1`, [id]);
  },

  async findByUsername(username: string): Promise<(User & { password_hash: string }) | null> {
    return dbQueryOne<User & { password_hash: string }>(
      `SELECT * FROM users WHERE username = $1`,
      [username]
    );
  },

  async findByUsernameOrEmail(username: string, email: string): Promise<User | null> {
    return dbQueryOne<User>(
      `${SELECT_SAFE} WHERE username = $1 OR email = $2`,
      [username, email]
    );
  },

  async create(dto: CreateUserDto & { password_hash: string }): Promise<User> {
    const [user] = await dbQuery<User>(
      `INSERT INTO users (username, email, password_hash, full_name, role, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, full_name, role, phone, is_active, created_at`,
      [dto.username, dto.email, dto.password_hash, dto.full_name, dto.role || 'kasir', dto.phone ?? null]
    );
    return user;
  },

  async update(id: string, dto: UpdateUserDto & { password_hash?: string }): Promise<User | null> {
    if (dto.password_hash) {
      await dbQuery(
        `UPDATE users
         SET full_name=$1, email=$2, role=$3, phone=$4, is_active=$5, password_hash=$6, updated_at=NOW()
         WHERE id=$7`,
        [dto.full_name, dto.email, dto.role, dto.phone ?? null, dto.is_active ?? true, dto.password_hash, id]
      );
    } else {
      await dbQuery(
        `UPDATE users
         SET full_name=$1, email=$2, role=$3, phone=$4, is_active=$5, updated_at=NOW()
         WHERE id=$6`,
        [dto.full_name, dto.email, dto.role, dto.phone ?? null, dto.is_active ?? true, id]
      );
    }
    return this.findById(id);
  },

  async setActive(id: string, is_active: boolean): Promise<void> {
    await dbQuery(
      `UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2`,
      [is_active, id]
    );
  },

  async updateLastLogin(id: string): Promise<void> {
    await dbQuery(`UPDATE users SET last_login=NOW() WHERE id=$1`, [id]);
  },

  async softDelete(id: string): Promise<void> {
    await dbQuery(
      `UPDATE users SET deleted_at=NOW(), is_active=false, updated_at=NOW() WHERE id=$1`,
      [id]
    );
  },

  async findAllActive(search = ''): Promise<User[]> {
    const base = `SELECT id, username, email, full_name, role, phone, is_active, last_login, created_at, updated_at FROM users WHERE deleted_at IS NULL`;
    if (search) {
      return dbQuery<User>(
        `${base} AND (full_name ILIKE $1 OR username ILIKE $1 OR email ILIKE $1) ORDER BY created_at DESC`,
        [`%${search}%`]
      );
    }
    return dbQuery<User>(`${base} ORDER BY created_at DESC`);
  },

};
