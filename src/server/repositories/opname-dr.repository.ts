import { dbQuery, dbQueryOne, dbTransaction } from './base.repository';

// ══════════════════════════════════════════════════════════════════════
// DELIVERY REPORT REPOSITORY
// ══════════════════════════════════════════════════════════════════════
export const DeliveryReportRepository = {

  async findAll(filter: { status?: string; reference_type?: string } = {}): Promise<Record<string,unknown>[]> {
    const params: unknown[] = [];
    const where : string[]  = ['1=1'];
    if (filter.status)         { params.push(filter.status);         where.push(`dr.status=$${params.length}`); }
    if (filter.reference_type) { params.push(filter.reference_type); where.push(`dr.reference_type=$${params.length}`); }
    return dbQuery(
      `SELECT dr.*, u.full_name AS created_by_name, rv.full_name AS resolved_by_name
       FROM   delivery_reports dr
       LEFT   JOIN users u  ON u.id = dr.created_by
       LEFT   JOIN users rv ON rv.id = dr.resolved_by
       WHERE  ${where.join(' AND ')}
       ORDER  BY dr.created_at DESC LIMIT 200`, params,
    );
  },

  async findById(id: string): Promise<Record<string,unknown> | null> {
    return dbQueryOne(
      `SELECT dr.*, u.full_name AS created_by_name, rv.full_name AS resolved_by_name
       FROM   delivery_reports dr
       LEFT   JOIN users u  ON u.id = dr.created_by
       LEFT   JOIN users rv ON rv.id = dr.resolved_by
       WHERE  dr.id = $1`, [id],
    );
  },

  async findItems(reportId: string): Promise<Record<string,unknown>[]> {
    return dbQuery(
      `SELECT * FROM delivery_report_items WHERE delivery_report_id=$1 ORDER BY created_at`,
      [reportId],
    );
  },

  async create(data: {
    report_number   : string;
    reference_type  : string;
    reference_id    : string;
    reference_number: string;
    report_date     : string;
    issue_type      : string;
    party_name      : string;
    party_type      : string;
    party_email    ?: string;
    description     : string;
    created_by      : string;
    items: {
      product_id    : string;
      product_name  : string;
      sku           : string;
      qty_expected  : number;
      qty_actual    : number;
      qty_damaged   : number;
      issue_note   ?: string;
    }[];
  }): Promise<{ id: string; report_number: string }> {
    return dbTransaction(async (client) => {
      const { rows } = await client.query<{ id: string; report_number: string }>(
        `INSERT INTO delivery_reports
           (report_number, reference_type, reference_id, reference_number,
            report_date, issue_type, status, party_name, party_type,
            party_email, description, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'open',$7,$8,$9,$10,$11)
         RETURNING id, report_number`,
        [data.report_number, data.reference_type, data.reference_id,
         data.reference_number, data.report_date, data.issue_type,
         data.party_name, data.party_type, data.party_email ?? null,
         data.description, data.created_by],
      );
      const dr = rows[0];
      for (const item of data.items) {
        await client.query(
          `INSERT INTO delivery_report_items
             (delivery_report_id, product_id, product_name, sku,
              qty_expected, qty_actual, qty_damaged, issue_note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [dr.id, item.product_id, item.product_name, item.sku,
           item.qty_expected, item.qty_actual, item.qty_damaged,
           item.issue_note ?? null],
        );
      }
      return dr;
    });
  },

  async updateStatus(id: string, status: string, resolution: string | null, resolvedBy: string): Promise<void> {
    await dbQuery(
      `UPDATE delivery_reports
       SET status=$1, resolution=$2, resolved_by=$3,
           resolved_at=CASE WHEN $1 IN ('resolved','closed') THEN NOW() ELSE NULL END,
           updated_at=NOW()
       WHERE id=$4`,
      [status, resolution, resolvedBy, id],
    );
  },
};

// ══════════════════════════════════════════════════════════════════════
// STOCK OPNAME REPOSITORY
// ══════════════════════════════════════════════════════════════════════
export const StockOpnameRepository = {

  async findAll(status?: string): Promise<Record<string,unknown>[]> {
    const params: unknown[] = [];
    const where : string[]  = ['1=1'];
    if (status) { params.push(status); where.push(`so.status=$${params.length}`); }
    return dbQuery(
      `SELECT so.*, u.full_name AS created_by_name, cv.full_name AS confirmed_by_name
       FROM   stock_opname so
       LEFT   JOIN users u  ON u.id = so.created_by
       LEFT   JOIN users cv ON cv.id = so.confirmed_by
       WHERE  ${where.join(' AND ')}
       ORDER  BY so.created_at DESC LIMIT 100`, params,
    );
  },

  async findById(id: string): Promise<Record<string,unknown> | null> {
    return dbQueryOne(
      `SELECT so.*, u.full_name AS created_by_name, cv.full_name AS confirmed_by_name
       FROM   stock_opname so
       LEFT   JOIN users u  ON u.id = so.created_by
       LEFT   JOIN users cv ON cv.id = so.confirmed_by
       WHERE  so.id = $1`, [id],
    );
  },

  async findItems(opnameId: string): Promise<Record<string,unknown>[]> {
    return dbQuery(
      `SELECT soi.*, u.full_name AS counted_by_name
       FROM   stock_opname_items soi
       LEFT   JOIN users u ON u.id = soi.counted_by
       WHERE  soi.stock_opname_id = $1
       ORDER  BY soi.product_name`, [opnameId],
    );
  },

  /** Buat opname baru — snapshot semua stok produk aktif saat ini */
  async createWithSnapshot(data: {
    opname_number: string;
    opname_date  : string;
    notes       ?: string;
    created_by   : string;
  }): Promise<{ id: string; opname_number: string; total_items: number }> {
    return dbTransaction(async (client) => {
      const { rows } = await client.query<{ id: string; opname_number: string }>(
        `INSERT INTO stock_opname
           (opname_number, opname_date, status, notes, created_by)
         VALUES ($1,$2,'draft',$3,$4)
         RETURNING id, opname_number`,
        [data.opname_number, data.opname_date, data.notes ?? null, data.created_by],
      );
      const op = rows[0];

      // Snapshot semua produk aktif
      const { rows: products } = await client.query(
        `SELECT id, sku, name, stock_quantity, selling_price
         FROM   products WHERE is_active=true AND deleted_at IS NULL
         ORDER  BY name`,
      );

      for (const p of products) {
        await client.query(
          `INSERT INTO stock_opname_items
             (stock_opname_id, product_id, sku, product_name, system_qty, unit_price)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [op.id, p.id, p.sku, p.name, p.stock_quantity, p.selling_price],
        );
      }

      await client.query(
        `UPDATE stock_opname SET total_items=$1, status='counting' WHERE id=$2`,
        [products.length, op.id],
      );

      return { ...op, total_items: products.length };
    });
  },

  /** Update hasil hitung fisik satu item */
  async updateItemCount(itemId: string, physicalQty: number, notes: string | null, countedBy: string): Promise<void> {
    await dbQuery(
      `UPDATE stock_opname_items
       SET physical_qty=$1, notes=$2, counted_by=$3, counted_at=NOW()
       WHERE id=$4`,
      [physicalQty, notes, countedBy, itemId],
    );
  },

  /** Konfirmasi opname → terapkan adjustment stok */
  async confirm(opnameId: string, confirmedBy: string): Promise<{ adjusted: number }> {
    return dbTransaction(async (client) => {
      const { rows: items } = await client.query(
        `SELECT soi.*, p.stock_quantity AS current_qty
         FROM   stock_opname_items soi
         JOIN   products p ON p.id = soi.product_id
         WHERE  soi.stock_opname_id=$1 AND soi.physical_qty IS NOT NULL
                AND soi.physical_qty != soi.system_qty`,
        [opnameId],
      );

      let adjusted = 0;
      for (const item of items) {
        const physicalQty = Number(item.physical_qty);
        const currentQty  = Number(item.current_qty);

        await client.query(
          `UPDATE products SET stock_quantity=$1, updated_at=NOW() WHERE id=$2`,
          [physicalQty, item.product_id],
        );

        await client.query(
          `INSERT INTO stock_movements
             (product_id, movement_type, quantity, quantity_before, quantity_after,
              reference_type, reference_id, notes, created_by)
           VALUES ($1,'adjustment',$2,$3,$4,'stock_opname',$5,$6,$7)`,
          [item.product_id,
           Math.abs(physicalQty - currentQty), currentQty, physicalQty,
           opnameId, `Stock Opname: ${item.sku}`, confirmedBy],
        );
        adjusted++;
      }

      // Hitung total discrepancy
      const { rows: disc } = await client.query(
        `SELECT COUNT(*) AS cnt FROM stock_opname_items
         WHERE stock_opname_id=$1 AND physical_qty IS NOT NULL AND physical_qty != system_qty`,
        [opnameId],
      );

      await client.query(
        `UPDATE stock_opname
         SET status='confirmed', confirmed_by=$1, confirmed_at=NOW(),
             total_discrepancy=$2, updated_at=NOW()
         WHERE id=$3`,
        [confirmedBy, Number(disc[0]?.cnt ?? 0), opnameId],
      );

      return { adjusted };
    });
  },
};
