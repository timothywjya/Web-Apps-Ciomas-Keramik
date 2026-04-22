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

// ═══════════════════════════════════════════════════════════════════
// THERMAL RECEIPT — 58mm / 80mm kertas kasir seperti minimarket
// ═══════════════════════════════════════════════════════════════════

const THERMAL_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    color: #000;
    background: white;
  }
  @page { size: 80mm auto; margin: 2mm 2mm; }
  @media print {
    .no-print { display: none !important; }
    body { padding: 0; }
  }
  .receipt {
    width: 76mm;
    margin: 0 auto;
    padding: 4px 2px;
  }
  .center { text-align: center; }
  .right  { text-align: right; }
  .left   { text-align: left; }
  .bold   { font-weight: bold; }
  .dashed { border-top: 1px dashed #000; margin: 4px 0; }
  .solid  { border-top: 2px solid #000; margin: 4px 0; }
  .co-name {
    font-size: 15px;
    font-weight: bold;
    text-align: center;
    letter-spacing: 1px;
  }
  .co-sub {
    font-size: 10px;
    text-align: center;
    line-height: 1.5;
    color: #333;
  }
  .inv-num {
    font-size: 13px;
    font-weight: bold;
    text-align: center;
    margin: 4px 0;
    letter-spacing: 1px;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    line-height: 1.6;
  }
  .item-row {
    font-size: 11px;
    margin: 2px 0;
  }
  .item-name {
    font-weight: bold;
    font-size: 11px;
  }
  .item-detail {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    padding-left: 8px;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    padding: 2px 0;
  }
  .grand-total {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    font-weight: bold;
    padding: 3px 0;
  }
  .footer-note {
    text-align: center;
    font-size: 10px;
    margin-top: 4px;
    line-height: 1.6;
  }
  .barcode-area {
    text-align: center;
    font-size: 10px;
    margin: 6px 0;
    letter-spacing: 3px;
  }
  .print-btn {
    display: block; margin: 10px auto;
    padding: 8px 24px;
    background: #1c1917; color: #d4a843;
    border: none; border-radius: 6px;
    font-size: 13px; font-weight: bold;
    cursor: pointer;
  }
`;

export type ThermalReceiptData = {
  sale: {
    invoice_number : string;
    sales_date     : string;
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
    customer_type ?: string;
  };
  items: {
    product_name    : string;
    sku             : string;
    unit            : string;
    quantity        : number;
    unit_price      : number;
    discount_percent: number;
    subtotal        : number;
  }[];
};

function rp58(n: number): string {
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n);
}

function pad(s: string, n: number, right = false): string {
  const str = String(s).slice(0, n);
  return right ? str.padStart(n) : str.padEnd(n);
}

function thermalRow(left: string, right: string, width = 32): string {
  const rightPad = right.length;
  const leftMax  = width - rightPad - 1;
  return `<div class="meta-row"><span>${left.slice(0, leftMax)}</span><span>${right}</span></div>`;
}

export function generateThermalReceiptHTML(data: ThermalReceiptData): string {
  const { sale, items } = data;

  const dateStr = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(sale.sales_date));

  const pmLabel: Record<string,string> = {
    cash: 'TUNAI', transfer: 'TRANSFER', kredit: 'KREDIT', tempo: 'TEMPO',
  };

  const itemLines = items.map(item => {
    const discNote = item.discount_percent > 0 ? ` (disc ${item.discount_percent}%)` : '';
    return `
      <div class="item-row">
        <div class="item-name">${item.product_name}</div>
        <div class="item-detail">
          <span>${item.quantity} ${item.unit} x ${rp58(item.unit_price)}${discNote}</span>
          <span><b>${rp58(item.subtotal)}</b></span>
        </div>
      </div>`;
  }).join('<div class="dashed" style="margin:2px 0;border-style:dotted"></div>');

  const changeAmt = sale.payment_method === 'cash' && sale.paid_amount > sale.total_amount
    ? sale.paid_amount - sale.total_amount : 0;

  const content = `
  <div class="receipt">

    <!-- Header Toko -->
    <div class="co-name">${COMPANY.name.toUpperCase()}</div>
    <div class="co-sub">
      ${COMPANY.address}<br>
      Tel: ${COMPANY.phone}<br>
      ${COMPANY.email}
    </div>

    <div class="solid"></div>

    <!-- Info Transaksi -->
    <div class="inv-num">${sale.invoice_number}</div>
    ${thermalRow('Tgl', dateStr)}
    ${thermalRow('Kasir', sale.salesperson_name ?? 'Staff')}
    ${sale.customer_name ? thermalRow('Pelanggan', sale.customer_name) : ''}
    ${thermalRow('Bayar', pmLabel[sale.payment_method] ?? sale.payment_method.toUpperCase())}

    <div class="dashed"></div>

    <!-- Items -->
    ${itemLines}

    <div class="dashed"></div>

    <!-- Totals -->
    ${thermalRow('Subtotal', `Rp ${rp58(sale.subtotal)}`)}
    ${sale.discount_amount > 0 ? thermalRow('Diskon', `- Rp ${rp58(sale.discount_amount)}`) : ''}
    ${sale.tax_amount > 0 ? thermalRow('Pajak', `Rp ${rp58(sale.tax_amount)}`) : ''}

    <div class="solid"></div>

    <div class="grand-total">
      <span>TOTAL</span>
      <span>Rp ${rp58(sale.total_amount)}</span>
    </div>

    ${sale.payment_method === 'cash' ? `
    ${thermalRow('Bayar', `Rp ${rp58(sale.paid_amount)}`)}
    <div class="grand-total" style="font-size:12px">
      <span>Kembali</span>
      <span>Rp ${rp58(changeAmt)}</span>
    </div>` : ''}

    ${sale.payment_method === 'kredit' || sale.payment_method === 'tempo' ? `
    <div class="dashed"></div>
    ${thermalRow('Terbayar', `Rp ${rp58(sale.paid_amount)}`)}
    <div class="grand-total" style="color:#c44223;font-size:12px">
      <span>Sisa</span>
      <span>Rp ${rp58(sale.total_amount - sale.paid_amount)}</span>
    </div>` : ''}

    <div class="solid"></div>

    <!-- Barcode-style invoice -->
    <div class="barcode-area">
      ${sale.invoice_number}
    </div>

    <!-- Footer -->
    <div class="footer-note">
      ${sale.notes ? `<i>"${sale.notes}"</i><br>` : ''}
      Terima kasih telah berbelanja<br>
      di ${COMPANY.name} 🏬<br>
      Barang yang sudah dibeli<br>
      tidak dapat dikembalikan.
    </div>

    <div style="text-align:center;font-size:9px;color:#999;margin-top:6px">
      — ${dateStr} —
    </div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Struk ${sale.invoice_number}</title>
  <style>${THERMAL_CSS}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨 Cetak Struk</button>
  ${content}
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
// BUKTI PENERIMAAN BARANG (Goods Receipt)
// ═══════════════════════════════════════════════════════════════════

export type GoodsReceiptData = {
  gr: {
    gr_number       : string;
    received_date   : string;
    status          : string;
    notes          ?: string;
    po_number       : string;
    supplier_name  ?: string;
    supplier_phone ?: string;
    created_by_name?: string;
    confirmed_by_name?: string;
    confirmed_at   ?: string;
  };
  items: {
    sku            : string;
    product_name   : string;
    qty_ordered    : number;
    qty_received   : number;
    qty_damaged    : number;
    unit_price     : number;
    notes         ?: string;
  }[];
};

export function generateGoodsReceiptHTML(data: GoodsReceiptData): string {
  const { gr, items } = data;

  const totalOrdered  = items.reduce((s,i) => s + i.qty_ordered,  0);
  const totalReceived = items.reduce((s,i) => s + i.qty_received, 0);
  const totalDamaged  = items.reduce((s,i) => s + i.qty_damaged,  0);
  const totalGood     = totalReceived - totalDamaged;
  const totalValue    = items.reduce((s,i) => s + (i.qty_received - i.qty_damaged) * i.unit_price, 0);

  const rows = items.map((it, idx) => {
    const good = it.qty_received - it.qty_damaged;
    const diff = it.qty_received - it.qty_ordered;
    const statusColor = diff === 0 ? '#166534' : diff < 0 ? '#854d0e' : '#1e40af';
    const statusLabel = diff === 0 ? 'Sesuai' : diff < 0 ? `Kurang ${Math.abs(diff)}` : `Lebih ${diff}`;
    return `<tr>
      <td>${idx+1}</td>
      <td class="mono">${it.sku}</td>
      <td>${it.product_name}</td>
      <td class="right">${it.qty_ordered}</td>
      <td class="right">${it.qty_received}</td>
      <td class="right" style="color:#dc2626">${it.qty_damaged > 0 ? it.qty_damaged : '—'}</td>
      <td class="right" style="font-weight:700">${good}</td>
      <td class="right">${rp(it.unit_price)}</td>
      <td class="right">${rp(good * it.unit_price)}</td>
      <td style="color:${statusColor};font-weight:600;font-size:10px">${statusLabel}</td>
      <td style="font-size:10px;color:#666">${it.notes ?? ''}</td>
    </tr>`;
  }).join('');

  const statusBadge = gr.status === 'confirmed'
    ? '<span class="badge badge-paid">CONFIRMED</span>'
    : gr.status === 'partial'
    ? '<span class="badge badge-partial">PARTIAL</span>'
    : '<span class="badge badge-outstanding">DRAFT</span>';

  const content = `
    <div class="header">
      <div>
        <div class="company-name">${COMPANY.name}</div>
        <div class="company-sub">${COMPANY.address}<br>Tel: ${COMPANY.phone} · ${COMPANY.email}</div>
      </div>
      <div class="doc-title">
        <h2>Bukti Penerimaan Barang</h2>
        <div class="doc-number">${gr.gr_number}</div>
        <div class="doc-date">Tanggal Terima: ${date(gr.received_date)}</div>
        <div style="margin-top:6px">${statusBadge}</div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-box">
        <div class="meta-label">Referensi PO</div>
        <div class="meta-value">
          <strong>${gr.po_number}</strong><br>
          Supplier: <strong>${gr.supplier_name ?? '—'}</strong><br>
          ${gr.supplier_phone ? `Tel: ${gr.supplier_phone}` : ''}
        </div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Ringkasan Penerimaan</div>
        <div class="meta-value">
          Total Dipesan: <strong>${totalOrdered} pcs</strong><br>
          Total Diterima: <strong>${totalReceived} pcs</strong><br>
          Rusak / Reject: <strong style="color:#dc2626">${totalDamaged} pcs</strong><br>
          Diterima Baik: <strong style="color:#166534">${totalGood} pcs</strong><br>
          Nilai Barang: <strong>${rp(totalValue)}</strong>
        </div>
      </div>
    </div>

    <div class="section-title">Detail Barang Diterima</div>
    <table class="tbl" style="font-size:10px">
      <thead>
        <tr>
          <th>#</th><th>SKU</th><th>Nama Produk</th>
          <th class="right">Pesan</th><th class="right">Terima</th>
          <th class="right">Rusak</th><th class="right">Baik</th>
          <th class="right">Harga</th><th class="right">Nilai</th>
          <th>Status</th><th>Catatan</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f9f8f7;font-weight:700">
          <td colspan="3" style="text-align:right">TOTAL</td>
          <td class="right">${totalOrdered}</td>
          <td class="right">${totalReceived}</td>
          <td class="right" style="color:#dc2626">${totalDamaged}</td>
          <td class="right" style="color:#166534">${totalGood}</td>
          <td class="right" colspan="2">${rp(totalValue)}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>

    ${gr.notes ? `<div style="margin-bottom:16px;font-size:10px;color:#666;padding:10px 12px;background:#fafaf9;border-radius:6px;border-left:3px solid #e7e5e4"><strong>Catatan:</strong> ${gr.notes}</div>` : ''}

    ${gr.status === 'confirmed' && gr.confirmed_by_name ? `
    <div style="margin-bottom:16px;padding:10px 12px;background:#f0fdf4;border-radius:6px;border-left:3px solid #bbf7d0;font-size:10px">
      ✅ <strong>Divalidasi oleh ${gr.confirmed_by_name}</strong> pada ${date(gr.confirmed_at)}.<br>
      Stok produk telah diperbarui secara otomatis setelah validasi ini.
    </div>` : `
    <div style="margin-bottom:16px;padding:10px 12px;background:#fffbeb;border-radius:6px;border-left:3px solid #fde68a;font-size:10px">
      ⚠️ <strong>Belum divalidasi.</strong> Stok belum ditambahkan. Konfirmasi dokumen ini untuk menambah stok.
    </div>`}

    <div class="footer">
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Pengirim / Supplier</div>
      </div>
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Penerima Barang</div>
      </div>
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Kepala Gudang</div>
      </div>
    </div>
    <div style="text-align:center;font-size:9px;color:#aaa;margin-top:12px">
      Dokumen ini dicetak secara digital oleh sistem ${COMPANY.name}
    </div>`;

  return wrap(`BPB ${gr.gr_number}`, content);
}

// ═══════════════════════════════════════════════════════════════════
// BERITA ACARA KENDALA PENGIRIMAN
// ═══════════════════════════════════════════════════════════════════

export type DeliveryReportData = {
  report: {
    report_number   : string;
    report_date     : string;
    reference_number: string;
    reference_type  : string;
    issue_type      : string;
    status          : string;
    party_name      : string;
    party_type      : string;
    description     : string;
    resolution     ?: string;
    created_by_name?: string;
    resolved_by_name?: string;
    resolved_at    ?: string;
  };
  items: {
    product_name  : string;
    sku           : string;
    qty_expected  : number;
    qty_actual    : number;
    qty_damaged   : number;
    issue_note   ?: string;
  }[];
};

export function generateDeliveryReportHTML(data: DeliveryReportData): string {
  const { report: r, items } = data;

  const issueLabels: Record<string,string> = {
    kurang: 'Barang Kurang', lebih: 'Barang Lebih',
    rusak: 'Barang Rusak', salah_produk: 'Produk Salah', campuran: 'Kendala Campuran',
  };
  const issueColors: Record<string,string> = {
    kurang: '#854d0e', lebih: '#1e40af', rusak: '#991b1b',
    salah_produk: '#6b21a8', campuran: '#374151',
  };

  const rows = items.map((it, idx) => {
    const diff = it.qty_actual - it.qty_expected;
    return `<tr>
      <td>${idx+1}</td>
      <td class="mono">${it.sku}</td>
      <td>${it.product_name}</td>
      <td class="right">${it.qty_expected}</td>
      <td class="right">${it.qty_actual}</td>
      <td class="right" style="color:#dc2626">${it.qty_damaged > 0 ? it.qty_damaged : '—'}</td>
      <td class="right" style="font-weight:700;color:${diff < 0 ? '#c44223' : diff > 0 ? '#1e40af' : '#166534'}">
        ${diff > 0 ? '+' : ''}${diff}
      </td>
      <td style="font-size:10px;color:#666">${it.issue_note ?? ''}</td>
    </tr>`;
  }).join('');

  const statusBadge = r.status === 'resolved' || r.status === 'closed'
    ? '<span class="badge badge-paid">SELESAI</span>'
    : r.status === 'proses'
    ? '<span class="badge badge-partial">DIPROSES</span>'
    : '<span class="badge badge-overdue">OPEN</span>';

  const content = `
    <div class="header">
      <div>
        <div class="company-name">${COMPANY.name}</div>
        <div class="company-sub">${COMPANY.address}<br>Tel: ${COMPANY.phone} · ${COMPANY.email}</div>
      </div>
      <div class="doc-title">
        <h2>Berita Acara</h2>
        <div style="font-size:11px;font-weight:600;color:#666;margin-top:2px">Kendala Pengiriman</div>
        <div class="doc-number">${r.report_number}</div>
        <div class="doc-date">Tanggal: ${date(r.report_date)}</div>
        <div style="margin-top:6px">${statusBadge}</div>
      </div>
    </div>

    <div style="background:${issueColors[r.issue_type] ?? '#374151'}15;border:1px solid ${issueColors[r.issue_type] ?? '#374151'}30;border-radius:8px;padding:12px 16px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:${issueColors[r.issue_type] ?? '#374151'};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
        Jenis Kendala: ${issueLabels[r.issue_type] ?? r.issue_type}
      </div>
      <div style="font-size:11px;color:#1a1a1a;line-height:1.6">${r.description}</div>
    </div>

    <div class="meta">
      <div class="meta-box">
        <div class="meta-label">Referensi Dokumen</div>
        <div class="meta-value">
          Nomor: <strong>${r.reference_number}</strong><br>
          Tipe: ${r.reference_type === 'purchase' ? 'Purchase Order' : 'Sales Invoice'}<br>
          ${r.party_type === 'supplier' ? 'Supplier' : 'Pelanggan'}: <strong>${r.party_name}</strong>
        </div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Pelapor</div>
        <div class="meta-value">
          Dibuat oleh: <strong>${r.created_by_name ?? '—'}</strong><br>
          Tanggal lapor: <strong>${date(r.report_date)}</strong><br>
          ${r.resolved_by_name ? `Diselesaikan: <strong>${r.resolved_by_name}</strong><br>` : ''}
          ${r.resolved_at ? `Tgl selesai: ${date(r.resolved_at)}` : ''}
        </div>
      </div>
    </div>

    <div class="section-title">Detail Barang Bermasalah</div>
    <table class="tbl">
      <thead>
        <tr>
          <th>#</th><th>SKU</th><th>Nama Produk</th>
          <th class="right">Seharusnya</th><th class="right">Aktual</th>
          <th class="right">Rusak</th><th class="right">Selisih</th>
          <th>Keterangan</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${r.resolution ? `
    <div style="margin-bottom:16px;padding:12px 14px;background:#f0fdf4;border-radius:6px;border-left:3px solid #bbf7d0">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#166534;margin-bottom:6px">Resolusi / Tindak Lanjut</div>
      <div style="font-size:11px;color:#1a1a1a;line-height:1.6">${r.resolution}</div>
    </div>` : `
    <div style="margin-bottom:16px;padding:12px 14px;background:#fff7ed;border-radius:6px;border-left:3px solid #fde68a">
      <div style="font-size:11px;color:#92400e">⚠ Kendala ini belum diselesaikan. Segera lakukan tindak lanjut.</div>
    </div>`}

    <div class="footer">
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">${r.party_type === 'supplier' ? 'Supplier' : 'Pelanggan'}</div>
      </div>
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Petugas Gudang</div>
      </div>
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Pimpinan / Manager</div>
      </div>
    </div>
    <div style="text-align:center;font-size:9px;color:#aaa;margin-top:12px">
      Berita Acara ini dibuat sebagai dokumen resmi ${COMPANY.name}
    </div>`;

  return wrap(`BA Pengiriman ${r.report_number}`, content);
}

// ═══════════════════════════════════════════════════════════════════
// STOCK OPNAME REPORT
// ═══════════════════════════════════════════════════════════════════

export type StockOpnameReportData = {
  opname: {
    opname_number    : string;
    opname_date      : string;
    status           : string;
    notes           ?: string;
    created_by_name ?: string;
    confirmed_by_name?: string;
    confirmed_at    ?: string;
    total_items      : number;
    total_discrepancy: number;
  };
  items: {
    sku           : string;
    product_name  : string;
    system_qty    : number;
    physical_qty  : number | null;
    difference    : number;
    unit_price    : number;
    notes        ?: string;
    counted_by_name?: string;
  }[];
};

export function generateStockOpnameReportHTML(data: StockOpnameReportData): string {
  const { opname: op, items } = data;

  const totalSystemValue   = items.reduce((s,i) => s + i.system_qty * i.unit_price, 0);
  const totalPhysicalValue = items.reduce((s,i) => s + (i.physical_qty ?? i.system_qty) * i.unit_price, 0);
  const diffItems          = items.filter(i => i.difference !== 0);
  const surplusItems       = items.filter(i => i.difference > 0);
  const deficitItems       = items.filter(i => i.difference < 0);
  const uncountedItems     = items.filter(i => i.physical_qty === null);

  const rows = items.map((it, idx) => {
    const diffColor = it.difference === 0 ? '#166534' : it.difference > 0 ? '#1e40af' : '#dc2626';
    const diffLabel = it.difference === 0 ? 'Sesuai' : it.difference > 0 ? `+${it.difference}` : `${it.difference}`;
    const diffValue = it.difference * it.unit_price;
    return `<tr>
      <td>${idx+1}</td>
      <td class="mono">${it.sku}</td>
      <td>${it.product_name}</td>
      <td class="right">${it.system_qty}</td>
      <td class="right" style="font-weight:${it.physical_qty === null ? '400' : '700'}">
        ${it.physical_qty === null ? '<span style="color:#a8a29e">—</span>' : it.physical_qty}
      </td>
      <td class="right" style="color:${diffColor};font-weight:700">${diffLabel}</td>
      <td class="right">${rp(it.unit_price)}</td>
      <td class="right" style="color:${diffColor}">${it.difference !== 0 ? rp(Math.abs(diffValue)) : '—'}</td>
      <td style="font-size:10px;color:#666">${it.notes ?? ''}</td>
    </tr>`;
  }).join('');

  const statusBadge = op.status === 'confirmed'
    ? '<span class="badge badge-paid">CONFIRMED</span>'
    : op.status === 'review'
    ? '<span class="badge badge-partial">REVIEW</span>'
    : op.status === 'counting'
    ? '<span class="badge badge-outstanding">COUNTING</span>'
    : '<span class="badge badge-stone" style="background:#f5f5f4;color:#57534e">DRAFT</span>';

  const content = `
    <div class="header">
      <div>
        <div class="company-name">${COMPANY.name}</div>
        <div class="company-sub">${COMPANY.address}<br>Tel: ${COMPANY.phone} · ${COMPANY.email}</div>
      </div>
      <div class="doc-title">
        <h2>Laporan Stock Opname</h2>
        <div class="doc-number">${op.opname_number}</div>
        <div class="doc-date">Tanggal Opname: ${date(op.opname_date)}</div>
        <div style="margin-top:6px">${statusBadge}</div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-box">
        <div class="meta-label">Informasi Opname</div>
        <div class="meta-value">
          Dibuat oleh: <strong>${op.created_by_name ?? '—'}</strong><br>
          Total SKU: <strong>${op.total_items}</strong><br>
          SKU berselisih: <strong style="color:#c44223">${op.total_discrepancy}</strong><br>
          ${op.confirmed_by_name ? `Divalidasi: <strong>${op.confirmed_by_name}</strong> · ${date(op.confirmed_at)}` : ''}
        </div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Ringkasan Selisih</div>
        <div class="meta-value">
          Nilai Sistem: <strong>${rp(totalSystemValue)}</strong><br>
          Nilai Fisik: <strong>${rp(totalPhysicalValue)}</strong><br>
          Surplus (lebih): <span style="color:#1e40af;font-weight:700">${surplusItems.length} item</span><br>
          Defisit (kurang): <span style="color:#dc2626;font-weight:700">${deficitItems.length} item</span><br>
          Belum dihitung: <span style="color:#a8a29e">${uncountedItems.length} item</span>
        </div>
      </div>
    </div>

    <div class="section-title">Detail Penghitungan Stok</div>
    <table class="tbl" style="font-size:10.5px">
      <thead>
        <tr>
          <th>#</th><th>SKU</th><th>Nama Produk</th>
          <th class="right">Sistem</th><th class="right">Fisik</th>
          <th class="right">Selisih</th><th class="right">Harga</th>
          <th class="right">Nilai Selisih</th><th>Catatan</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f9f8f7;font-weight:700;font-size:11px">
          <td colspan="3" style="text-align:right">TOTAL NILAI</td>
          <td class="right" colspan="2">${rp(totalSystemValue)}</td>
          <td class="right">${diffItems.length} selisih</td>
          <td class="right" colspan="2" style="color:${totalPhysicalValue >= totalSystemValue ? '#1e40af' : '#dc2626'}">
            ${totalPhysicalValue >= totalSystemValue ? '+' : ''}${rp(totalPhysicalValue - totalSystemValue)}
          </td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    ${op.notes ? `<div style="margin-bottom:16px;font-size:10px;color:#666;padding:10px 12px;background:#fafaf9;border-radius:6px;border-left:3px solid #e7e5e4"><strong>Catatan:</strong> ${op.notes}</div>` : ''}

    <div class="footer">
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Petugas Penghitung</div>
      </div>
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Kepala Gudang</div>
      </div>
      <div class="footer-sig">
        <div class="sig-line"></div>
        <div class="sig-label">Direktur / Pimpinan</div>
      </div>
    </div>
    <div style="text-align:center;font-size:9px;color:#aaa;margin-top:12px">
      Dokumen ini dicetak secara digital oleh sistem ${COMPANY.name}
    </div>`;

  return wrap(`Stock Opname ${op.opname_number}`, content);
}
