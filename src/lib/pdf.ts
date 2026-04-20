// ── PDF / Print HTML generator ────────────────────────────────────────────────
// Returns a complete HTML document that renders correctly when printed
// to PDF (browser print dialog or headless).
// Paper: content-fit up to A4 Portrait (210 × 297 mm).
// Strategy: use @media print to strip UI chrome, @page for margins.

export type CompanyInfo = {
  name   : string;
  address: string;
  phone  : string;
  email  : string;
};

// Default company — can be overridden from env or DB
const COMPANY: CompanyInfo = {
  name   : process.env.COMPANY_NAME    ?? 'Ciomas Keramik',
  address: process.env.COMPANY_ADDRESS ?? 'Jl. Ciomas No. 1, Bogor, Jawa Barat',
  phone  : process.env.COMPANY_PHONE   ?? '(0251) 000-0000',
  email  : process.env.COMPANY_EMAIL   ?? 'info@ciomaskeramik.com',
};

// ── Shared CSS ────────────────────────────────────────────────────────────────

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    color: #1a1a1a;
    background: white;
    padding: 0;
  }

  @page {
    size: A4 portrait;
    margin: 14mm 14mm 14mm 14mm;
  }

  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
    table { page-break-inside: avoid; }
    tr    { page-break-inside: avoid; }
  }

  .doc { width: 100%; max-width: 780px; margin: 0 auto; padding: 24px 28px; }

  /* Header */
  .header        { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #1c1917; }
  .company-name  { font-size: 18px; font-weight: 700; color: #1c1917; letter-spacing: -0.3px; }
  .company-sub   { font-size: 10px; color: #666; margin-top: 3px; line-height: 1.5; }
  .doc-title     { text-align: right; }
  .doc-title h2  { font-size: 16px; font-weight: 700; color: #1c1917; text-transform: uppercase; letter-spacing: 1px; }
  .doc-number    { font-size: 13px; font-weight: 600; color: #c44223; margin-top: 4px; }
  .doc-date      { font-size: 10px; color: #666; margin-top: 2px; }

  /* Meta grid */
  .meta          { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .meta-box      { background: #f9f8f7; border-radius: 6px; padding: 12px 14px; }
  .meta-label    { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 6px; }
  .meta-value    { font-size: 11px; color: #1a1a1a; line-height: 1.6; }
  .meta-value strong { font-size: 12px; }

  /* Table */
  .tbl           { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .tbl th        { background: #1c1917; color: #d4a843; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; padding: 8px 10px; text-align: left; }
  .tbl th.right  { text-align: right; }
  .tbl td        { padding: 8px 10px; font-size: 10.5px; border-bottom: 1px solid #f0ece8; vertical-align: top; }
  .tbl td.right  { text-align: right; }
  .tbl td.mono   { font-family: 'Courier New', monospace; font-size: 10px; }
  .tbl tr:last-child td { border-bottom: none; }
  .tbl tr:nth-child(even) td { background: #fafaf9; }

  /* Totals */
  .totals        { margin-left: auto; width: 280px; margin-bottom: 20px; }
  .totals table  { width: 100%; border-collapse: collapse; }
  .totals td     { padding: 5px 10px; font-size: 11px; }
  .totals td.label { color: #666; }
  .totals td.value { text-align: right; font-weight: 500; }
  .totals .separator td { border-top: 1px solid #e0dbd5; padding-top: 8px; }
  .totals .grand td  { font-size: 13px; font-weight: 700; color: #1c1917; background: #f9f8f7; padding: 8px 10px; border-radius: 4px; }

  /* Payments history */
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e7e5e4; }

  /* Status badge */
  .badge         { display: inline-block; padding: 2px 9px; border-radius: 99px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge-paid    { background: #dcfce7; color: #166534; }
  .badge-partial { background: #dbeafe; color: #1e40af; }
  .badge-outstanding { background: #fef9c3; color: #854d0e; }
  .badge-overdue { background: #fee2e2; color: #991b1b; }

  /* Footer */
  .footer        { margin-top: 24px; padding-top: 14px; border-top: 1px solid #e7e5e4; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .footer-sig    { text-align: center; }
  .sig-line      { border-bottom: 1px solid #1a1a1a; margin: 40px 10px 6px; }
  .sig-label     { font-size: 9.5px; color: #888; }

  /* Print button */
  .print-btn     { display: block; margin: 0 auto 20px; padding: 10px 32px; background: #1c1917; color: #d4a843; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px; }
`;

// ── Format helpers ────────────────────────────────────────────────────────────

function rp(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

function date(d: string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d));
}

function wrap(title: string, content: string, showPrint = true): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  ${showPrint ? `<button class="print-btn no-print" onclick="window.print()">🖨 Print / Save PDF</button>` : ''}
  <div class="doc">
    ${content}
  </div>
</body>
</html>`;
}

// ── Sale Invoice PDF ──────────────────────────────────────────────────────────

export type SaleInvoiceData = {
  sale: {
    id             : string;
    invoice_number : string;
    sales_date     : string;
    due_date      ?: string;
    status         : string;
    payment_method : string;
    payment_status : string;
    subtotal       : number;
    discount_amount: number;
    tax_amount     : number;
    total_amount   : number;
    paid_amount    : number;
    notes         ?: string;
    salesperson_name?: string;
    customer_name ?: string;
    customer_phone?: string;
    customer_address?: string;
    customer_city ?: string;
  };
  items: {
    sku           : string;
    product_name  : string;
    unit          : string;
    quantity      : number;
    unit_price    : number;
    discount_percent: number;
    subtotal      : number;
  }[];
};

export function generateSaleInvoiceHTML(data: SaleInvoiceData): string {
  const { sale, items } = data;
  const outstanding = sale.total_amount - sale.paid_amount;
  const statusBadge = (s: string) => `<span class="badge badge-${s}">${s}</span>`;

  const itemRows = items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="mono">${item.sku}</td>
      <td>${item.product_name}</td>
      <td class="right">${item.quantity} ${item.unit}</td>
      <td class="right">${rp(item.unit_price)}</td>
      <td class="right">${item.discount_percent > 0 ? `${item.discount_percent}%` : '—'}</td>
      <td class="right">${rp(item.subtotal)}</td>
    </tr>
  `).join('');

  const content = `
    <div class="header">
      <div>
        <div class="company-name">${COMPANY.name}</div>
        <div class="company-sub">
          ${COMPANY.address}<br>
          Tel: ${COMPANY.phone} · ${COMPANY.email}
        </div>
      </div>
      <div class="doc-title">
        <h2>Invoice</h2>
        <div class="doc-number">${sale.invoice_number}</div>
        <div class="doc-date">Tanggal: ${date(sale.sales_date)}</div>
        ${sale.due_date ? `<div class="doc-date">Jatuh tempo: ${date(sale.due_date)}</div>` : ''}
        <div style="margin-top:6px">${statusBadge(sale.payment_status)}</div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-box">
        <div class="meta-label">Tagihan Kepada</div>
        <div class="meta-value">
          <strong>${sale.customer_name ?? 'Umum / Walk-in'}</strong><br>
          ${sale.customer_phone ? `Tel: ${sale.customer_phone}<br>` : ''}
          ${sale.customer_address ?? ''}${sale.customer_city ? `, ${sale.customer_city}` : ''}
        </div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Detail Transaksi</div>
        <div class="meta-value">
          Metode: <strong>${sale.payment_method.toUpperCase()}</strong><br>
          Status: ${statusBadge(sale.payment_status)}<br>
          ${sale.salesperson_name ? `Sales: ${sale.salesperson_name}` : ''}
        </div>
      </div>
    </div>

    <table class="tbl">
      <thead>
        <tr>
          <th>#</th>
          <th>SKU</th>
          <th>Nama Produk</th>
          <th class="right">Qty</th>
          <th class="right">Harga Satuan</th>
          <th class="right">Diskon</th>
          <th class="right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="totals">
      <table>
        <tr>
          <td class="label">Subtotal</td>
          <td class="value">${rp(sale.subtotal)}</td>
        </tr>
        ${sale.discount_amount > 0 ? `
        <tr>
          <td class="label">Diskon</td>
          <td class="value" style="color:#16a34a">- ${rp(sale.discount_amount)}</td>
        </tr>` : ''}
        ${sale.tax_amount > 0 ? `
        <tr>
          <td class="label">Pajak</td>
          <td class="value">${rp(sale.tax_amount)}</td>
        </tr>` : ''}
        <tr class="separator">
          <td></td><td></td>
        </tr>
        <tr class="grand">
          <td class="label">Total</td>
          <td class="value">${rp(sale.total_amount)}</td>
        </tr>
        ${sale.paid_amount > 0 ? `
        <tr style="margin-top:4px">
          <td class="label" style="color:#16a34a">Dibayar</td>
          <td class="value" style="color:#16a34a">- ${rp(sale.paid_amount)}</td>
        </tr>
        <tr>
          <td class="label" style="font-weight:700">Outstanding</td>
          <td class="value" style="font-weight:700;color:#c44223">${rp(outstanding)}</td>
        </tr>` : ''}
      </table>
    </div>

    ${sale.notes ? `<div style="margin-bottom:16px;font-size:10px;color:#666;padding:10px 12px;background:#fafaf9;border-radius:6px;border-left:3px solid #e7e5e4"><strong>Catatan:</strong> ${sale.notes}</div>` : ''}

    <div class="footer">
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Penerima Barang</div>
      </div>
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Hormat Kami</div>
      </div>
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Mengetahui</div>
      </div>
    </div>
    <div style="text-align:center;font-size:9px;color:#aaa;margin-top:12px">
      Dokumen ini dicetak secara digital oleh sistem ${COMPANY.name}
    </div>
  `;

  return wrap(`Invoice ${sale.invoice_number}`, content);
}

// ── Purchase Order PDF ────────────────────────────────────────────────────────

export type PurchaseOrderData = {
  purchase: {
    id             : string;
    purchase_number: string;
    purchase_date  : string;
    due_date      ?: string;
    status         : string;
    subtotal       : number;
    total_amount   : number;
    paid_amount    : number;
    notes         ?: string;
    supplier_name ?: string;
    supplier_phone?: string;
    supplier_email?: string;
    supplier_address?: string;
    supplier_city ?: string;
    created_by_name?: string;
  };
  items: {
    sku         : string;
    product_name: string;
    quantity    : number;
    unit_price  : number;
    subtotal    : number;
  }[];
};

export function generatePurchaseOrderHTML(data: PurchaseOrderData): string {
  const { purchase: po, items } = data;

  const itemRows = items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="mono">${item.sku ?? ''}</td>
      <td>${item.product_name}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${rp(item.unit_price)}</td>
      <td class="right">${rp(item.subtotal)}</td>
    </tr>
  `).join('');

  const content = `
    <div class="header">
      <div>
        <div class="company-name">${COMPANY.name}</div>
        <div class="company-sub">
          ${COMPANY.address}<br>
          Tel: ${COMPANY.phone} · ${COMPANY.email}
        </div>
      </div>
      <div class="doc-title">
        <h2>Purchase Order</h2>
        <div class="doc-number">${po.purchase_number}</div>
        <div class="doc-date">Tanggal: ${date(po.purchase_date)}</div>
        ${po.due_date ? `<div class="doc-date">Jatuh tempo: ${date(po.due_date)}</div>` : ''}
      </div>
    </div>

    <div class="meta">
      <div class="meta-box">
        <div class="meta-label">Kepada Supplier</div>
        <div class="meta-value">
          <strong>${po.supplier_name ?? '—'}</strong><br>
          ${po.supplier_phone ? `Tel: ${po.supplier_phone}<br>` : ''}
          ${po.supplier_email ? `${po.supplier_email}<br>` : ''}
          ${po.supplier_address ?? ''}${po.supplier_city ? `, ${po.supplier_city}` : ''}
        </div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Dipesan Oleh</div>
        <div class="meta-value">
          <strong>${COMPANY.name}</strong><br>
          ${COMPANY.address}<br>
          ${po.created_by_name ? `Staff: ${po.created_by_name}` : ''}
        </div>
      </div>
    </div>

    <table class="tbl">
      <thead>
        <tr>
          <th>#</th>
          <th>SKU</th>
          <th>Nama Produk</th>
          <th class="right">Qty</th>
          <th class="right">Harga Satuan</th>
          <th class="right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="totals">
      <table>
        <tr>
          <td class="label">Subtotal</td>
          <td class="value">${rp(po.subtotal)}</td>
        </tr>
        <tr class="separator"><td></td><td></td></tr>
        <tr class="grand">
          <td class="label">Total PO</td>
          <td class="value">${rp(po.total_amount)}</td>
        </tr>
      </table>
    </div>

    ${po.notes ? `<div style="margin-bottom:16px;font-size:10px;color:#666;padding:10px 12px;background:#fafaf9;border-radius:6px;border-left:3px solid #e7e5e4"><strong>Catatan:</strong> ${po.notes}</div>` : ''}

    <div class="footer">
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Dibuat Oleh</div>
      </div>
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Disetujui Oleh</div>
      </div>
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Supplier</div>
      </div>
    </div>
    <div style="text-align:center;font-size:9px;color:#aaa;margin-top:12px">
      Dokumen ini dicetak secara digital oleh sistem ${COMPANY.name}
    </div>
  `;

  return wrap(`PO ${po.purchase_number}`, content);
}

// ── Receivable Statement PDF ──────────────────────────────────────────────────

export type ReceivableStatementData = {
  receivable: {
    id             : string;
    invoice_number : string;
    invoice_date   : string;
    due_date      ?: string;
    total_amount   : number;
    discount_amount: number;
    paid_amount    : number;
    outstanding    : number;
    status         : string;
    notes         ?: string;
    customer_name  : string;
    customer_phone?: string;
  };
  payments: {
    payment_date  : string;
    amount        : number;
    payment_method: string;
    reference_no ?: string;
    notes        ?: string;
  }[];
  sale_items: {
    product_name    : string;
    sku             : string;
    quantity        : number;
    unit_price      : number;
    discount_percent: number;
    subtotal        : number;
  }[];
};

export function generateReceivableStatementHTML(data: ReceivableStatementData): string {
  const { receivable: r, payments, sale_items } = data;

  const itemRows = sale_items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="mono">${item.sku}</td>
      <td>${item.product_name}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${rp(item.unit_price)}</td>
      <td class="right">${item.discount_percent > 0 ? `${item.discount_percent}%` : '—'}</td>
      <td class="right">${rp(item.subtotal)}</td>
    </tr>
  `).join('');

  const paymentRows = payments.length
    ? payments.map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${date(p.payment_date)}</td>
          <td>${p.payment_method.toUpperCase()}</td>
          <td class="mono">${p.reference_no ?? '—'}</td>
          <td class="right" style="color:#16a34a;font-weight:600">${rp(p.amount)}</td>
          <td>${p.notes ?? ''}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="6" style="text-align:center;color:#aaa;padding:14px">Belum ada pembayaran</td></tr>`;

  const content = `
    <div class="header">
      <div>
        <div class="company-name">${COMPANY.name}</div>
        <div class="company-sub">${COMPANY.address}<br>Tel: ${COMPANY.phone} · ${COMPANY.email}</div>
      </div>
      <div class="doc-title">
        <h2>Surat Piutang</h2>
        <div class="doc-number">${r.invoice_number}</div>
        <div class="doc-date">Tanggal: ${date(r.invoice_date)}</div>
        ${r.due_date ? `<div class="doc-date">Jatuh tempo: ${date(r.due_date)}</div>` : ''}
        <div style="margin-top:6px"><span class="badge badge-${r.status}">${r.status.toUpperCase()}</span></div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-box">
        <div class="meta-label">Debitur</div>
        <div class="meta-value">
          <strong>${r.customer_name}</strong><br>
          ${r.customer_phone ? `Tel: ${r.customer_phone}` : ''}
        </div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Ringkasan</div>
        <div class="meta-value">
          Total: <strong>${rp(r.total_amount)}</strong><br>
          ${r.discount_amount > 0 ? `Diskon: <strong style="color:#16a34a">- ${rp(r.discount_amount)}</strong><br>` : ''}
          Dibayar: <strong style="color:#16a34a">${rp(r.paid_amount)}</strong><br>
          <span style="font-size:12px;font-weight:700;color:#c44223">Outstanding: ${rp(r.outstanding)}</span>
        </div>
      </div>
    </div>

    <div class="section-title">Detail Produk</div>
    <table class="tbl" style="margin-bottom:20px">
      <thead>
        <tr>
          <th>#</th><th>SKU</th><th>Produk</th>
          <th class="right">Qty</th><th class="right">Harga</th>
          <th class="right">Disc</th><th class="right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="section-title">Riwayat Pembayaran / Cicilan</div>
    <table class="tbl">
      <thead>
        <tr>
          <th>#</th><th>Tanggal</th><th>Metode</th>
          <th>No. Referensi</th><th class="right">Jumlah</th><th>Catatan</th>
        </tr>
      </thead>
      <tbody>${paymentRows}</tbody>
    </table>

    ${r.notes ? `<div style="margin:12px 0;font-size:10px;color:#666;padding:10px 12px;background:#fafaf9;border-radius:6px;border-left:3px solid #e7e5e4"><strong>Catatan:</strong> ${r.notes}</div>` : ''}

    <div class="footer">
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Debitur / Pelanggan</div>
      </div>
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Kasir / Staff</div>
      </div>
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Pimpinan</div>
      </div>
    </div>
    <div style="text-align:center;font-size:9px;color:#aaa;margin-top:12px">
      Dokumen ini dicetak secara digital oleh sistem ${COMPANY.name}
    </div>
  `;

  return wrap(`Piutang ${r.invoice_number}`, content);
}
