import { dbQuery, dbQueryOne, dbTransaction } from './base.repository';
import type { Sale, SaleItem, SaleFilter, UpdateSaleDto } from '@/types';

export type CreateSaleData = {
  invoice_number : string;
  customer_id   ?: string;
  payment_method : string;
  subtotal       : number;
  discount_amount: number;
  total_amount   : number;
  notes         ?: string;
  salesperson_id : string;
};

const SALE_SELECT = `
  SELECT s.*, c.name AS customer_name, u.full_name AS salesperson_name
  FROM   sales s
  LEFT   JOIN customers c ON c.id = s.customer_id
  LEFT   JOIN users     u ON u.id = s.salesperson_id
`;

export const SaleRepository = {

  async findAll(filter: SaleFilter = {}): Promise<Sale[]> {
    const params: unknown[]     = [];
    const where : string[]      = ['1=1'];

    if (filter.search) {
      params.push(`%${filter.search}%`);
      where.push(`(s.invoice_number ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }
    if (filter.status) { params.push(filter.status); where.push(`s.status = $${params.length}`); }
    if (filter.from)   { params.push(filter.from);   where.push(`s.sales_date >= $${params.length}`); }
    if (filter.to)     { params.push(filter.to);     where.push(`s.sales_date <= $${params.length}`); }

    return dbQuery<Sale>(
      `${SALE_SELECT} WHERE ${where.join(' AND ')} ORDER BY s.created_at DESC LIMIT 200`,
      params,
    );
  },

  async findById(id: string): Promise<Sale | null> {
    return dbQueryOne<Sale>(
      `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone,
              u.full_name AS salesperson_name
       FROM   sales s
       LEFT   JOIN customers c ON c.id = s.customer_id
       LEFT   JOIN users     u ON u.id = s.salesperson_id
       WHERE  s.id = $1`,
      [id],
    );
  },

  async findItemsById(saleId: string): Promise<SaleItem[]> {
    return dbQuery<SaleItem>(
      `SELECT si.*, p.name AS product_name, p.sku, p.unit
       FROM   sale_items si
       JOIN   products   p  ON p.id = si.product_id
       WHERE  si.sale_id = $1`,
      [saleId],
    );
  },

  async update(id: string, dto: UpdateSaleDto): Promise<Sale | null> {
    await dbQuery(
      `UPDATE sales
       SET    status = $1, payment_status = $2, paid_amount = $3,
              notes  = $4, updated_at = NOW()
       WHERE  id = $5`,
      [dto.status, dto.payment_status, dto.paid_amount ?? 0, dto.notes ?? null, id],
    );
    return this.findById(id);
  },

  async createWithItems(
    data      : CreateSaleData,
    items     : SaleItem[],
    onEachItem: (item: SaleItem, saleId: string) => Promise<void>,
  ): Promise<{ id: string; invoice_number: string }> {
    return dbTransaction(async (client) => {
      const { rows } = await client.query<{ id: string; invoice_number: string }>(
        `INSERT INTO sales
           (invoice_number, customer_id, sales_date, status, payment_method,
            payment_status, subtotal, discount_amount, total_amount, paid_amount,
            notes, salesperson_id, created_by)
         VALUES ($1,$2,CURRENT_DATE,'pending',$3,'unpaid',$4,$5,$6,0,$7,$8,$8)
         RETURNING id, invoice_number`,
        [
          data.invoice_number, data.customer_id ?? null,
          data.payment_method, data.subtotal,    data.discount_amount,
          data.total_amount,   data.notes ?? null, data.salesperson_id,
        ],
      );
      const sale = rows[0];

      for (const item of items) {
        await client.query(
          `INSERT INTO sale_items
             (sale_id, product_id, quantity, unit_price, discount_percent, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [sale.id, item.product_id, item.quantity, item.unit_price,
           item.discount_percent ?? 0, item.subtotal],
        );
        await onEachItem(item, sale.id);
      }

      return sale;
    });
  },

};
