import { dbQuery, dbQueryOne, dbTransaction } from './base.repository';
import type { Sale, SaleItem, SaleFilter, UpdateSaleDto } from '@/types';

export const SaleRepository = {

  async findAll(filter: SaleFilter = {}): Promise<Sale[]> {
    const params: unknown[] = [];
    const conditions: string[] = ['1=1'];

    if (filter.search) {
      params.push(`%${filter.search}%`);
      conditions.push(`(s.invoice_number ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }
    if (filter.status) { params.push(filter.status); conditions.push(`s.status=$${params.length}`); }
    if (filter.from)   { params.push(filter.from);   conditions.push(`s.sales_date>=$${params.length}`); }
    if (filter.to)     { params.push(filter.to);     conditions.push(`s.sales_date<=$${params.length}`); }

    return dbQuery<Sale>(
      `SELECT s.*, c.name AS customer_name, u.full_name AS salesperson_name
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u ON u.id = s.salesperson_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.created_at DESC LIMIT 200`,
      params
    );
  },

  async findById(id: string): Promise<Sale | null> {
    return dbQueryOne<Sale>(
      `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone,
              u.full_name AS salesperson_name
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u ON u.id = s.salesperson_id
       WHERE s.id=$1`,
      [id]
    );
  },

  async findItemsById(saleId: string): Promise<SaleItem[]> {
    return dbQuery<SaleItem>(
      `SELECT si.*, p.name AS product_name, p.sku, p.unit
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.sale_id=$1`,
      [saleId]
    );
  },

  async create(data: {
    invoice_number: string;
    customer_id?: string;
    payment_method: string;
    subtotal: number;
    discount_amount: number;
    total_amount: number;
    notes?: string;
    salesperson_id: string;
  }): Promise<{ id: string; invoice_number: string }> {
    const [sale] = await dbQuery<{ id: string; invoice_number: string }>(
      `INSERT INTO sales
         (invoice_number, customer_id, sales_date, status, payment_method,
          payment_status, subtotal, discount_amount, total_amount, paid_amount,
          notes, salesperson_id, created_by)
       VALUES ($1,$2,CURRENT_DATE,'pending',$3,'unpaid',$4,$5,$6,0,$7,$8,$8)
       RETURNING id, invoice_number`,
      [
        data.invoice_number, data.customer_id ?? null,
        data.payment_method, data.subtotal, data.discount_amount,
        data.total_amount, data.notes ?? null, data.salesperson_id,
      ]
    );
    return sale;
  },

  async createItems(saleId: string, items: SaleItem[]): Promise<void> {
    for (const item of items) {
      await dbQuery(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount_percent, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [saleId, item.product_id, item.quantity, item.unit_price,
         item.discount_percent ?? 0, item.subtotal]
      );
    }
  },

  async update(id: string, dto: UpdateSaleDto): Promise<Sale | null> {
    await dbQuery(
      `UPDATE sales SET status=$1, payment_status=$2, paid_amount=$3,
                        notes=$4, updated_at=NOW()
       WHERE id=$5`,
      [dto.status, dto.payment_status, dto.paid_amount ?? 0, dto.notes ?? null, id]
    );
    return this.findById(id);
  },

  // Wrap create + items in transaction
  async createWithItems(
    saleData: {
      invoice_number: string;
      customer_id?: string;
      payment_method: string;
      subtotal: number;
      discount_amount: number;
      total_amount: number;
      notes?: string;
      salesperson_id: string;
    },
    items: SaleItem[],
    onEachItem: (item: SaleItem, saleId: string) => Promise<void>
  ): Promise<{ id: string; invoice_number: string }> {
    return dbTransaction(async (client) => {
      const [sale] = (await client.query(
        `INSERT INTO sales
           (invoice_number, customer_id, sales_date, status, payment_method,
            payment_status, subtotal, discount_amount, total_amount, paid_amount,
            notes, salesperson_id, created_by)
         VALUES ($1,$2,CURRENT_DATE,'pending',$3,'unpaid',$4,$5,$6,0,$7,$8,$8)
         RETURNING id, invoice_number`,
        [
          saleData.invoice_number, saleData.customer_id ?? null,
          saleData.payment_method, saleData.subtotal, saleData.discount_amount,
          saleData.total_amount, saleData.notes ?? null, saleData.salesperson_id,
        ]
      )).rows as { id: string; invoice_number: string }[];

      for (const item of items) {
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount_percent, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [sale.id, item.product_id, item.quantity, item.unit_price,
           item.discount_percent ?? 0, item.subtotal]
        );
        await onEachItem(item, sale.id);
      }

      return sale;
    });
  },

};
