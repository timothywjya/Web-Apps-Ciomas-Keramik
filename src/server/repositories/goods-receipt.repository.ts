import { dbQuery, dbQueryOne, dbTransaction } from './base.repository';

export const GoodsReceiptRepository = {

  async findAll(purchaseId?: string): Promise<Record<string,unknown>[]> {
    const params: unknown[] = [];
    const where : string[]  = ['1=1'];
    if (purchaseId) { params.push(purchaseId); where.push(`gr.purchase_id = $${params.length}`); }
    return dbQuery(
      `SELECT gr.*,
              p.purchase_number AS po_number,
              s.name            AS supplier_name,
              s.phone           AS supplier_phone,
              s.email           AS supplier_email,
              u.full_name       AS created_by_name,
              cv.full_name      AS confirmed_by_name
       FROM   goods_receipts gr
       JOIN   purchases p ON p.id = gr.purchase_id
       LEFT   JOIN suppliers s ON s.id = p.supplier_id
       LEFT   JOIN users u  ON u.id = gr.created_by
       LEFT   JOIN users cv ON cv.id = gr.confirmed_by
       WHERE  ${where.join(' AND ')}
       ORDER  BY gr.created_at DESC LIMIT 200`,
      params,
    );
  },

  async findById(id: string): Promise<Record<string,unknown> | null> {
    return dbQueryOne(
      `SELECT gr.*,
              p.purchase_number AS po_number,
              s.name            AS supplier_name,
              s.phone           AS supplier_phone,
              s.email           AS supplier_email,
              u.full_name       AS created_by_name,
              cv.full_name      AS confirmed_by_name
       FROM   goods_receipts gr
       JOIN   purchases p ON p.id = gr.purchase_id
       LEFT   JOIN suppliers s ON s.id = p.supplier_id
       LEFT   JOIN users u  ON u.id = gr.created_by
       LEFT   JOIN users cv ON cv.id = gr.confirmed_by
       WHERE  gr.id = $1`, [id],
    );
  },

  async findItems(grId: string): Promise<Record<string,unknown>[]> {
    return dbQuery(
      `SELECT gri.*, prod.name AS product_name, prod.sku
       FROM   goods_receipt_items gri
       JOIN   products prod ON prod.id = gri.product_id
       WHERE  gri.goods_receipt_id = $1
       ORDER  BY gri.created_at`, [grId],
    );
  },

  async create(data: {
    purchase_id : string;
    gr_number   : string;
    received_date: string;
    notes      ?: string;
    created_by  : string;
    items: {
      purchase_item_id?: string;
      product_id      : string;
      qty_ordered     : number;
      qty_received    : number;
      qty_damaged     : number;
      unit_price      : number;
      notes          ?: string;
    }[];
  }): Promise<{ id: string; gr_number: string }> {
    return dbTransaction(async (client) => {
      const { rows } = await client.query<{ id: string; gr_number: string }>(
        `INSERT INTO goods_receipts
           (gr_number, purchase_id, received_date, status, notes, created_by)
         VALUES ($1,$2,$3,'draft',$4,$5)
         RETURNING id, gr_number`,
        [data.gr_number, data.purchase_id, data.received_date, data.notes ?? null, data.created_by],
      );
      const gr = rows[0];

      for (const item of data.items) {
        await client.query(
          `INSERT INTO goods_receipt_items
             (goods_receipt_id, purchase_item_id, product_id,
              qty_ordered, qty_received, qty_damaged, unit_price, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [gr.id, item.purchase_item_id ?? null, item.product_id,
           item.qty_ordered, item.qty_received, item.qty_damaged,
           item.unit_price, item.notes ?? null],
        );
      }
      return gr;
    });
  },

  /** Konfirmasi BPB → update stok produk */
  async confirm(grId: string, confirmedBy: string): Promise<void> {
    await dbTransaction(async (client) => {
      // Get items
      const { rows: items } = await client.query(
        `SELECT gri.*, prod.stock_quantity AS current_qty
         FROM goods_receipt_items gri
         JOIN products prod ON prod.id = gri.product_id
         WHERE gri.goods_receipt_id = $1`, [grId],
      );

      for (const item of items) {
        const goodQty = Number(item.qty_received) - Number(item.qty_damaged);
        if (goodQty <= 0) continue;

        const qtyBefore = Number(item.current_qty);
        const qtyAfter  = qtyBefore + goodQty;

        // Update product stock
        await client.query(
          `UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2`,
          [qtyAfter, item.product_id],
        );

        // Record stock movement
        await client.query(
          `INSERT INTO stock_movements
             (product_id, movement_type, quantity, quantity_before, quantity_after,
              reference_type, reference_id, notes, created_by)
           VALUES ($1,'in',$2,$3,$4,'goods_receipt',$5,$6,$7)`,
          [item.product_id, goodQty, qtyBefore, qtyAfter, grId,
           `BPB: ${grId}`, confirmedBy],
        );
      }

      // Update GR status + purchase status
      await client.query(
        `UPDATE goods_receipts
         SET status='confirmed', confirmed_by=$1, confirmed_at=NOW(), updated_at=NOW()
         WHERE id=$2`, [confirmedBy, grId],
      );

      // Check if PO is fully received
      await client.query(
        `UPDATE purchases SET status='received', updated_at=NOW()
         WHERE id = (SELECT purchase_id FROM goods_receipts WHERE id=$1)`,
        [grId],
      );
    });
  },

};
