import { dbQuery, dbQueryOne } from './base.repository';
import type { Customer, CreateCustomerDto } from '@/types';

export const CustomerRepository = {

  async findAll(search = '', type = ''): Promise<Customer[]> {
    const params: unknown[] = [];
    const conditions: string[] = ['1=1'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }
    if (type) {
      params.push(type);
      conditions.push(`customer_type = $${params.length}`);
    }

    return dbQuery<Customer>(
      `SELECT * FROM customers WHERE ${conditions.join(' AND ')} ORDER BY name ASC LIMIT 300`,
      params
    );
  },

  async findById(id: string): Promise<Customer | null> {
    return dbQueryOne<Customer>(`SELECT * FROM customers WHERE id=$1`, [id]);
  },

  async create(dto: CreateCustomerDto): Promise<Customer> {
    const [c] = await dbQuery<Customer>(
      `INSERT INTO customers (name, phone, email, address, city, customer_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [dto.name, dto.phone ?? null, dto.email ?? null,
       dto.address ?? null, dto.city ?? null,
       dto.customer_type ?? 'retail', dto.notes ?? null]
    );
    return c;
  },

  async update(id: string, dto: Partial<Customer>): Promise<Customer | null> {
    const [c] = await dbQuery<Customer>(
      `UPDATE customers
       SET name=$1, phone=$2, email=$3, address=$4, city=$5,
           customer_type=$6, notes=$7, is_active=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [dto.name, dto.phone ?? null, dto.email ?? null,
       dto.address ?? null, dto.city ?? null,
       dto.customer_type ?? 'retail', dto.notes ?? null,
       dto.is_active ?? true, id]
    );
    return c ?? null;
  },

  async incrementPurchases(id: string, amount: number): Promise<void> {
    await dbQuery(
      `UPDATE customers SET total_purchases = total_purchases + $1, updated_at=NOW() WHERE id=$2`,
      [amount, id]
    );
  },

  async setActive(id: string, is_active: boolean): Promise<void> {
    await dbQuery(
      `UPDATE customers SET is_active=$1, updated_at=NOW() WHERE id=$2`,
      [is_active, id]
    );
  },

};
