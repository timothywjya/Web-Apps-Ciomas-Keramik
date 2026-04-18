import { dbQuery, dbQueryOne } from './base.repository';
import type { Supplier, CreateSupplierDto } from '@/types';

export const SupplierRepository = {

  async findAll(search = ''): Promise<Supplier[]> {
    if (search) {
      return dbQuery<Supplier>(
        `SELECT * FROM suppliers
         WHERE is_active=true
           AND (name ILIKE $1 OR contact_person ILIKE $1 OR phone ILIKE $1)
         ORDER BY name ASC`,
        [`%${search}%`]
      );
    }
    return dbQuery<Supplier>(
      `SELECT * FROM suppliers WHERE is_active=true ORDER BY name ASC`
    );
  },

  async findById(id: string): Promise<Supplier | null> {
    return dbQueryOne<Supplier>(`SELECT * FROM suppliers WHERE id=$1`, [id]);
  },

  async create(dto: CreateSupplierDto): Promise<Supplier> {
    const [s] = await dbQuery<Supplier>(
      `INSERT INTO suppliers (name, contact_person, phone, email, address, city, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [dto.name, dto.contact_person ?? null, dto.phone ?? null,
       dto.email ?? null, dto.address ?? null, dto.city ?? null, dto.notes ?? null]
    );
    return s;
  },

  async update(id: string, dto: Partial<Supplier>): Promise<Supplier | null> {
    const [s] = await dbQuery<Supplier>(
      `UPDATE suppliers
       SET name=$1, contact_person=$2, phone=$3, email=$4,
           address=$5, city=$6, notes=$7, is_active=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [dto.name, dto.contact_person ?? null, dto.phone ?? null,
       dto.email ?? null, dto.address ?? null, dto.city ?? null,
       dto.notes ?? null, dto.is_active ?? true, id]
    );
    return s ?? null;
  },

  async setActive(id: string, is_active: boolean): Promise<void> {
    await dbQuery(
      `UPDATE suppliers SET is_active=$1, updated_at=NOW() WHERE id=$2`,
      [is_active, id]
    );
  },

};
