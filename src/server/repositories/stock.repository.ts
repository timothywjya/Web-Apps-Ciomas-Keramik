import { dbQuery } from './base.repository';
import type { StockMovement } from '@/types';

export const StockRepository = {

  async findAll(type = '', productId = ''): Promise<StockMovement[]> {
    const params: unknown[] = [];
    const conditions: string[] = ['1=1'];

    if (type) { params.push(type); conditions.push(`sm.movement_type=$${params.length}`); }
    if (productId) { params.push(productId); conditions.push(`sm.product_id=$${params.length}`); }

    return dbQuery<StockMovement>(
      `SELECT sm.*, p.name AS product_name, p.sku, u.full_name AS created_by_name
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       LEFT JOIN users u ON u.id = sm.created_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY sm.created_at DESC
       LIMIT 300`,
      params
    );
  },

  async create(data: {
    product_id: string;
    movement_type: string;
    quantity: number;
    quantity_before: number;
    quantity_after: number;
    reference_type?: string;
    reference_id?: string;
    notes?: string;
    created_by?: string;
  }): Promise<StockMovement> {
    const [m] = await dbQuery<StockMovement>(
      `INSERT INTO stock_movements
         (product_id, movement_type, quantity, quantity_before, quantity_after,
          reference_type, reference_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        data.product_id, data.movement_type, data.quantity,
        data.quantity_before, data.quantity_after,
        data.reference_type ?? null, data.reference_id ?? null,
        data.notes ?? null, data.created_by ?? null,
      ]
    );
    return m;
  },

};
