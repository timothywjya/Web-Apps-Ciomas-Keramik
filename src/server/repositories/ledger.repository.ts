import { dbQuery, dbQueryOne, dbTransaction } from './base.repository';
import type { PoolClient } from 'pg';

// =============================================================================
// Perspektif akuntansi Ciomas Keramik:
//   Piutang = Customer/Kontraktor berhutang ke Ciomas  (dari Sales Invoice)
//   Hutang  = Ciomas berhutang ke Supplier             (dari Purchase Order)
// =============================================================================

// ── Shared types ──────────────────────────────────────────────────────────────

export type LedgerStatus = 'outstanding' | 'partial' | 'paid' | 'overdue';

export type LedgerFilter = {
  search?: string;
  status?: string;
};

export type LedgerSummary = {
  total_outstanding: number;
  total_overdue    : number;
  count            : number;
};

// ── Piutang types ─────────────────────────────────────────────────────────────

export type Receivable = {
  id             : string;
  sale_id        : string;
  invoice_number : string;
  invoice_date   : string;
  due_date      ?: string;
  customer_id   ?: string;
  customer_name  : string;
  customer_phone?: string;
  customer_type ?: string;
  total_amount   : number;
  discount_amount: number;
  paid_amount    : number;
  outstanding    : number;
  status         : LedgerStatus;
  notes         ?: string;
  created_at     : string;
  updated_at     : string;
};

export type ReceivablePayment = {
  id            : string;
  receivable_id : string;
  payment_date  : string;
  amount        : number;
  payment_method: string;
  reference_no ?: string;
  notes        ?: string;
  created_at    : string;
};

// ── Hutang types ──────────────────────────────────────────────────────────────

export type Payable = {
  id             : string;
  purchase_id    : string;
  po_number      : string;
  po_date        : string;
  due_date      ?: string;
  supplier_id   ?: string;
  supplier_name  : string;
  supplier_phone?: string;
  total_amount   : number;
  discount_amount: number;
  paid_amount    : number;
  outstanding    : number;
  status         : LedgerStatus;
  notes         ?: string;
  created_at     : string;
  updated_at     : string;
};

export type PayablePayment = {
  id            : string;
  payable_id    : string;
  payment_date  : string;
  amount        : number;
  payment_method: string;
  reference_no ?: string;
  notes        ?: string;
  created_at    : string;
};

// ── Private helpers ───────────────────────────────────────────────────────────

function computeStatus(paid: number, total: number, discount: number): LedgerStatus {
  const net = total - discount;
  if (paid <= 0)   return 'outstanding';
  if (paid >= net) return 'paid';
  return 'partial';
}

async function syncSalePaidAmount(client: PoolClient, saleId: string, paidAmount: number): Promise<void> {
  await client.query(
    `UPDATE sales
     SET    paid_amount    = $1,
            payment_status = CASE
              WHEN $1 <= 0                        THEN 'unpaid'
              WHEN $1 >= total_amount - discount_amount THEN 'paid'
              ELSE 'partial'
            END,
            updated_at = NOW()
     WHERE  id = $2`,
    [paidAmount, saleId],
  );
}

async function syncPurchasePaidAmount(client: PoolClient, purchaseId: string, paidAmount: number): Promise<void> {
  await client.query(
    `UPDATE purchases SET paid_amount = $1, updated_at = NOW() WHERE id = $2`,
    [paidAmount, purchaseId],
  );
}

// ── Piutang Repository ────────────────────────────────────────────────────────
// Tagihan Ciomas ke Customer / Kontraktor atas Invoice Penjualan

const RECV_SELECT = `
  SELECT
    r.*,
    c.name          AS customer_name,
    c.phone         AS customer_phone,
    c.customer_type AS customer_type
  FROM   receivables r
  LEFT   JOIN customers c ON c.id = r.customer_id
`;

export const ReceivableRepository = {

  async findAll(filter: LedgerFilter = {}): Promise<Receivable[]> {
    const params: unknown[] = [];
    const where : string[]  = ['1=1'];

    if (filter.search) {
      params.push(`%${filter.search}%`);
      where.push(
        `(r.invoice_number ILIKE $${params.length} OR c.name ILIKE $${params.length})`,
      );
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`r.status = $${params.length}`);
    }

    return dbQuery<Receivable>(
      `${RECV_SELECT}
       WHERE  ${where.join(' AND ')}
       ORDER  BY r.created_at DESC
       LIMIT  500`,
      params,
    );
  },

  async findById(id: string): Promise<Receivable | null> {
    return dbQueryOne<Receivable>(`${RECV_SELECT} WHERE r.id = $1`, [id]);
  },

  async findBySaleId(saleId: string): Promise<Receivable | null> {
    return dbQueryOne<Receivable>(`${RECV_SELECT} WHERE r.sale_id = $1`, [saleId]);
  },

  async findPayments(receivableId: string): Promise<ReceivablePayment[]> {
    return dbQuery<ReceivablePayment>(
      `SELECT * FROM receivable_payments
       WHERE  receivable_id = $1
       ORDER  BY payment_date ASC, created_at ASC`,
      [receivableId],
    );
  },

  async create(data: {
    sale_id        : string;
    invoice_number : string;
    invoice_date   : string;
    customer_id   ?: string;
    due_date      ?: string;
    total_amount   : number;
    discount_amount: number;
    notes         ?: string;
    created_by     : string;
  }): Promise<Receivable> {
    const [r] = await dbQuery<Receivable>(
      `INSERT INTO receivables
         (sale_id, invoice_number, invoice_date, customer_id, due_date,
          total_amount, discount_amount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        data.sale_id, data.invoice_number, data.invoice_date,
        data.customer_id ?? null, data.due_date ?? null,
        data.total_amount, data.discount_amount,
        data.notes ?? null, data.created_by,
      ],
    );
    return r;
  },

  async addPayment(data: {
    receivable_id : string;
    amount        : number;
    payment_date  : string;
    payment_method: string;
    reference_no ?: string;
    notes        ?: string;
    created_by    : string;
  }): Promise<{ payment: ReceivablePayment; receivable: Receivable }> {
    return dbTransaction(async (client) => {
      // Row lock prevents duplicate concurrent payments
      const { rows: [recv] } = await client.query<Receivable>(
        `SELECT * FROM receivables WHERE id = $1 FOR UPDATE`,
        [data.receivable_id],
      );
      if (!recv)              throw new Error('Piutang tidak ditemukan');
      if (recv.status === 'paid') throw new Error('Piutang sudah lunas');

      const newPaid  = Number(recv.paid_amount) + data.amount;
      const net      = Number(recv.total_amount) - Number(recv.discount_amount);

      if (data.amount <= 0)   throw new Error('Jumlah pembayaran harus lebih dari 0');
      if (newPaid > net)      throw new Error(`Jumlah melebihi sisa tagihan (${net.toLocaleString('id-ID')})`);

      const newStatus = computeStatus(newPaid, Number(recv.total_amount), Number(recv.discount_amount));

      const { rows: [payment] } = await client.query<ReceivablePayment>(
        `INSERT INTO receivable_payments
           (receivable_id, payment_date, amount, payment_method, reference_no, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          data.receivable_id, data.payment_date, data.amount,
          data.payment_method, data.reference_no ?? null,
          data.notes ?? null, data.created_by,
        ],
      );

      const { rows: [updated] } = await client.query<Receivable>(
        `UPDATE receivables
         SET    paid_amount = $1, status = $2, updated_at = NOW()
         WHERE  id = $3
         RETURNING *`,
        [newPaid, newStatus, data.receivable_id],
      );

      await syncSalePaidAmount(client, recv.sale_id, newPaid);

      return { payment, receivable: updated };
    });
  },

  async updateDiscount(id: string, discountAmount: number): Promise<Receivable> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Piutang tidak ditemukan');
    if (existing.status === 'paid') throw new Error('Tidak bisa mengubah diskon piutang yang sudah lunas');

    const newStatus = computeStatus(
      Number(existing.paid_amount), Number(existing.total_amount), discountAmount,
    );

    const [updated] = await dbQuery<Receivable>(
      `UPDATE receivables
       SET    discount_amount = $1, status = $2, updated_at = NOW()
       WHERE  id = $3
       RETURNING *`,
      [discountAmount, newStatus, id],
    );
    return updated;
  },

  async summary(): Promise<LedgerSummary> {
    const [row] = await dbQuery<{
      total_outstanding: string;
      total_overdue    : string;
      count            : string;
    }>(`
      SELECT
        COALESCE(SUM(outstanding), 0)                                        AS total_outstanding,
        COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN outstanding
                          ELSE 0 END), 0)                                    AS total_overdue,
        COUNT(*)                                                             AS count
      FROM   receivables
      WHERE  status != 'paid'
    `);
    return {
      total_outstanding: Number(row.total_outstanding),
      total_overdue    : Number(row.total_overdue),
      count            : Number(row.count),
    };
  },

};

// ── Hutang Repository ─────────────────────────────────────────────────────────
// Kewajiban Ciomas ke Supplier atas Purchase Order
// Referensi PO Number wajib disimpan untuk rekonsiliasi

const PAY_SELECT = `
  SELECT
    p.*,
    s.name  AS supplier_name,
    s.phone AS supplier_phone
  FROM   payables p
  LEFT   JOIN suppliers s ON s.id = p.supplier_id
`;

export const PayableRepository = {

  async findAll(filter: LedgerFilter = {}): Promise<Payable[]> {
    const params: unknown[] = [];
    const where : string[]  = ['1=1'];

    if (filter.search) {
      params.push(`%${filter.search}%`);
      where.push(
        `(p.po_number ILIKE $${params.length} OR s.name ILIKE $${params.length})`,
      );
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`p.status = $${params.length}`);
    }

    return dbQuery<Payable>(
      `${PAY_SELECT}
       WHERE  ${where.join(' AND ')}
       ORDER  BY p.created_at DESC
       LIMIT  500`,
      params,
    );
  },

  async findById(id: string): Promise<Payable | null> {
    return dbQueryOne<Payable>(`${PAY_SELECT} WHERE p.id = $1`, [id]);
  },

  async findByPurchaseId(purchaseId: string): Promise<Payable | null> {
    return dbQueryOne<Payable>(`${PAY_SELECT} WHERE p.purchase_id = $1`, [purchaseId]);
  },

  async findPayments(payableId: string): Promise<PayablePayment[]> {
    return dbQuery<PayablePayment>(
      `SELECT * FROM payable_payments
       WHERE  payable_id = $1
       ORDER  BY payment_date ASC, created_at ASC`,
      [payableId],
    );
  },

  async create(data: {
    purchase_id    : string;
    po_number      : string;
    po_date        : string;
    supplier_id   ?: string;
    due_date      ?: string;
    total_amount   : number;
    discount_amount: number;
    notes         ?: string;
    created_by     : string;
  }): Promise<Payable> {
    const [p] = await dbQuery<Payable>(
      `INSERT INTO payables
         (purchase_id, po_number, po_date, supplier_id, due_date,
          total_amount, discount_amount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        data.purchase_id, data.po_number, data.po_date,
        data.supplier_id ?? null, data.due_date ?? null,
        data.total_amount, data.discount_amount,
        data.notes ?? null, data.created_by,
      ],
    );
    return p;
  },

  async addPayment(data: {
    payable_id    : string;
    amount        : number;
    payment_date  : string;
    payment_method: string;
    reference_no ?: string;
    notes        ?: string;
    created_by    : string;
  }): Promise<{ payment: PayablePayment; payable: Payable }> {
    return dbTransaction(async (client) => {
      const { rows: [pay] } = await client.query<Payable>(
        `SELECT * FROM payables WHERE id = $1 FOR UPDATE`,
        [data.payable_id],
      );
      if (!pay)               throw new Error('Hutang tidak ditemukan');
      if (pay.status === 'paid') throw new Error('Hutang sudah lunas');

      const newPaid = Number(pay.paid_amount) + data.amount;
      const net     = Number(pay.total_amount) - Number(pay.discount_amount);

      if (data.amount <= 0)   throw new Error('Jumlah pembayaran harus lebih dari 0');
      if (newPaid > net)      throw new Error(`Jumlah melebihi sisa hutang (${net.toLocaleString('id-ID')})`);

      const newStatus = computeStatus(newPaid, Number(pay.total_amount), Number(pay.discount_amount));

      const { rows: [payment] } = await client.query<PayablePayment>(
        `INSERT INTO payable_payments
           (payable_id, payment_date, amount, payment_method, reference_no, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          data.payable_id, data.payment_date, data.amount,
          data.payment_method, data.reference_no ?? null,
          data.notes ?? null, data.created_by,
        ],
      );

      const { rows: [updated] } = await client.query<Payable>(
        `UPDATE payables
         SET    paid_amount = $1, status = $2, updated_at = NOW()
         WHERE  id = $3
         RETURNING *`,
        [newPaid, newStatus, data.payable_id],
      );

      await syncPurchasePaidAmount(client, pay.purchase_id, newPaid);

      return { payment, payable: updated };
    });
  },

  async updateDiscount(id: string, discountAmount: number): Promise<Payable> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Hutang tidak ditemukan');
    if (existing.status === 'paid') throw new Error('Tidak bisa mengubah diskon hutang yang sudah lunas');

    const newStatus = computeStatus(
      Number(existing.paid_amount), Number(existing.total_amount), discountAmount,
    );

    const [updated] = await dbQuery<Payable>(
      `UPDATE payables
       SET    discount_amount = $1, status = $2, updated_at = NOW()
       WHERE  id = $3
       RETURNING *`,
      [discountAmount, newStatus, id],
    );
    return updated;
  },

  async summary(): Promise<LedgerSummary> {
    const [row] = await dbQuery<{
      total_outstanding: string;
      total_overdue    : string;
      count            : string;
    }>(`
      SELECT
        COALESCE(SUM(outstanding), 0)                                        AS total_outstanding,
        COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN outstanding
                          ELSE 0 END), 0)                                    AS total_overdue,
        COUNT(*)                                                             AS count
      FROM   payables
      WHERE  status != 'paid'
    `);
    return {
      total_outstanding: Number(row.total_outstanding),
      total_overdue    : Number(row.total_overdue),
      count            : Number(row.count),
    };
  },

};
