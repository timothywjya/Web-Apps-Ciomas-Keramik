import { dbQuery, dbQueryOne, dbTransaction } from './base.repository';
import type { Purchase, PurchaseItem } from '@/types';

export type CreatePurchaseData = {
  purchase_number: string;
  supplier_id    ?: string;
  subtotal       : number;
  notes         ?: string;
  created_by     : string;
};

const PO_SELECT = `
  SELECT p.*, s.name AS supplier_name, u.full_name AS created_by_name
  FROM   purchases p
  LEFT   JOIN suppliers s ON s.id = p.supplier_id
  LEFT   JOIN users     u ON u.id = p.created_by
`;

export const PurchaseRepository = {

  async findAll(search = '', status = ''): Promise<Purchase[]> {
    const params: unknown[] = [];
    const where : string[]  = ['1=1'];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(p.purchase_number ILIKE $${params.length} OR s.name ILIKE $${params.length})`);
    }
    if (status) { params.push(status); where.push(`p.status = $${params.length}`); }

    return dbQuery<Purchase>(
      `${PO_SELECT} WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC LIMIT 200`,
      params,
    );
  },

  async findById(id: string): Promise<Purchase | null> {
    return dbQueryOne<Purchase>(`${PO_SELECT} WHERE p.id = $1`, [id]);
  },

  async findItemsById(purchaseId: string): Promise<PurchaseItem[]> {
    return dbQuery<PurchaseItem>(
      `SELECT pi.*, p.name AS product_name, p.sku
       FROM   purchase_items pi
       JOIN   products       p  ON p.id = pi.product_id
       WHERE  pi.purchase_id = $1`,
      [purchaseId],
    );
  },

  async createWithItems(
    data      : CreatePurchaseData,
    items     : PurchaseItem[],
    onEachItem: (item: PurchaseItem, purchaseId: string) => Promise<void>,
  ): Promise<{ id: string; purchase_number: string }> {
    return dbTransaction(async (client) => {
      const { rows } = await client.query<{ id: string; purchase_number: string }>(
        `INSERT INTO purchases
           (purchase_number, supplier_id, purchase_date, status,
            subtotal, total_amount, notes, created_by)
         VALUES ($1,$2,CURRENT_DATE,'received',$3,$3,$4,$5)
         RETURNING id, purchase_number`,
        [data.purchase_number, data.supplier_id ?? null,
         data.subtotal, data.notes ?? null, data.created_by],
      );
      const po = rows[0];

      for (const item of items) {
        await client.query(
          `INSERT INTO purchase_items
             (purchase_id, product_id, quantity, unit_price, subtotal, received_quantity)
           VALUES ($1,$2,$3,$4,$5,$3)`,
          [po.id, item.product_id, item.quantity,
           item.unit_price, item.quantity * item.unit_price],
        );
        await onEachItem(item, po.id);
      }

      return po;
    });
  },

  async createPendingWithItems(
    data : { purchase_number: string; supplier_id?: string; subtotal: number; notes?: string; created_by: string },
    items: { product_id: string; quantity: number; unit_price: number }[],
  ): Promise<{ id: string; purchase_number: string }> {
    return dbTransaction(async (client) => {
      const { rows } = await client.query<{ id: string; purchase_number: string }>(
        `INSERT INTO purchases
           (purchase_number, supplier_id, purchase_date, status,
            subtotal, total_amount, notes, created_by)
         VALUES ($1,$2,CURRENT_DATE,'pending',$3,$3,$4,$5)
         RETURNING id, purchase_number`,
        [data.purchase_number, data.supplier_id ?? null,
         data.subtotal, data.notes ?? null, data.created_by],
      );
      const po = rows[0];
      for (const item of items) {
        await client.query(
          `INSERT INTO purchase_items
             (purchase_id, product_id, quantity, unit_price, subtotal, received_quantity)
           VALUES ($1,$2,$3,$4,$5,0)`,
          [po.id, item.product_id, item.quantity,
           item.unit_price, item.quantity * item.unit_price],
        );
      }
      return po;
    });
  },


};
