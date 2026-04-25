
import nodemailer from 'nodemailer';
import { dbQuery } from '@/server/repositories/base.repository';

// ── Config ────────────────────────────────────────────────────────────────────

const cfg = {
  host   : process.env.EMAIL_HOST    ?? 'smtp.gmail.com',
  port   : parseInt(process.env.EMAIL_PORT ?? '587'),
  secure : process.env.EMAIL_PORT    === '465',
  user   : process.env.EMAIL_USER    ?? '',
  pass   : process.env.EMAIL_PASS    ?? '',
  from   : process.env.EMAIL_FROM    ?? `Ciomas Keramik <${process.env.EMAIL_USER ?? 'noreply@ciomaskeramik.com'}>`,
  enabled: process.env.EMAIL_ENABLED === 'true',
};

// ── Mailer singleton ──────────────────────────────────────────────────────────

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host  : cfg.host,
      port  : cfg.port,
      secure: cfg.secure,
      auth  : { user: cfg.user, pass: cfg.pass },
      tls   : { rejectUnauthorized: process.env.NODE_ENV === 'production' },
    });
  }
  return _transporter;
}

// ── Log to DB ─────────────────────────────────────────────────────────────────

async function logEmail(params: {
  recipient_email: string;
  recipient_name ?: string;
  subject         : string;
  template       ?: string;
  reference_id   ?: string;
  reference_type ?: string;
  status          : 'sent' | 'failed';
  error_message  ?: string;
  created_by     ?: string;
}) {
  try {
    await dbQuery(
      `INSERT INTO email_logs
         (recipient_email, recipient_name, subject, template, reference_id,
          reference_type, status, error_message, sent_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        params.recipient_email, params.recipient_name ?? null,
        params.subject, params.template ?? null,
        params.reference_id ?? null, params.reference_type ?? null,
        params.status,
        params.error_message ?? null,
        params.status === 'sent' ? new Date() : null,
        params.created_by ?? null,
      ]
    );
  } catch {
    // Log failure is non-fatal
  }
}

// ── Base HTML wrapper for emails ──────────────────────────────────────────────

function emailWrap(title: string, body: string): string {
  const COMPANY_NAME    = process.env.COMPANY_NAME    ?? 'Ciomas Keramik';
  const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS ?? 'Jl. Ciomas No. 1, Bogor, Jawa Barat';
  const COMPANY_PHONE   = process.env.COMPANY_PHONE   ?? '(0251) 000-0000';
  const COMPANY_EMAIL_  = process.env.COMPANY_EMAIL   ?? 'info@ciomaskeramik.com';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size:14px; color:#1a1a1a; background:#f5f5f4; }
    .wrapper { max-width:620px; margin:24px auto; background:white; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08); }
    .topbar  { background:linear-gradient(135deg,#1c1917,#292524); padding:24px 32px; }
    .topbar h1 { font-size:20px; color:#d4a843; font-weight:700; letter-spacing:0.5px; }
    .topbar p  { font-size:12px; color:#a8a29e; margin-top:4px; }
    .body    { padding:28px 32px; }
    .body p  { line-height:1.7; margin-bottom:12px; color:#44403c; }
    .highlight { background:#fef9c3; border-left:3px solid #d97706; padding:12px 16px; border-radius:0 6px 6px 0; margin:16px 0; font-size:14px; }
    .highlight strong { color:#1c1917; }
    table.detail { width:100%; border-collapse:collapse; margin:16px 0; font-size:13px; }
    table.detail th { background:#1c1917; color:#d4a843; padding:8px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; }
    table.detail td { padding:8px 12px; border-bottom:1px solid #f0ece8; }
    table.detail tr:nth-child(even) td { background:#fafaf9; }
    table.detail .right { text-align:right; }
    .total-box { background:#f9f8f7; border-radius:8px; padding:14px 16px; margin:16px 0; }
    .total-box .grand { font-size:16px; font-weight:700; color:#1c1917; }
    .btn-link { display:inline-block; background:linear-gradient(135deg,#1c1917,#292524); color:#d4a843 !important; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px; margin:8px 0; }
    .footer  { background:#f9f8f7; padding:16px 32px; font-size:11px; color:#78716c; text-align:center; border-top:1px solid #e7e5e4; }
    .badge   { display:inline-block; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:700; }
    .badge-green { background:#dcfce7; color:#166534; }
    .badge-yellow { background:#fef9c3; color:#854d0e; }
    .badge-red { background:#fee2e2; color:#991b1b; }
    .badge-blue { background:#dbeafe; color:#1e40af; }
    .alert-warn { background:#fff7ed; border:1px solid #fde68a; border-radius:8px; padding:12px 16px; margin:16px 0; font-size:13px; color:#92400e; }
    .alert-info { background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 16px; margin:16px 0; font-size:13px; color:#1e40af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="topbar">
      <h1>${COMPANY_NAME}</h1>
      <p>Sistem Manajemen Toko Keramik</p>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      ${COMPANY_NAME} · ${COMPANY_ADDRESS}<br>
      Tel: ${COMPANY_PHONE} · Email: ${COMPANY_EMAIL_}<br>
      <span style="color:#a8a29e;font-size:10px">Email ini dikirim otomatis oleh sistem. Jangan balas email ini.</span>
    </div>
  </div>
</body>
</html>`;
}

function rp(n: number) {
  return new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(n ?? 0);
}

// ── Email Templates ───────────────────────────────────────────────────────────

/** Struk Penjualan ke Customer */
export function buildSaleReceiptEmail(params: {
  customerName   : string;
  invoiceNumber  : string;
  salesDate      : string;
  items          : { product_name:string; quantity:number; unit_price:number; subtotal:number }[];
  subtotal       : number;
  discountAmount : number;
  totalAmount    : number;
  paymentMethod  : string;
  salespersonName: string;
  printUrl       : string;
}): { subject: string; html: string } {
  const pmLabel: Record<string,string> = { cash:'Tunai', transfer:'Transfer', kredit:'Kredit', tempo:'Tempo' };
  const itemRows = params.items.map(i => `
    <tr>
      <td>${i.product_name}</td>
      <td class="right">${i.quantity}</td>
      <td class="right">${rp(i.unit_price)}</td>
      <td class="right"><strong>${rp(i.subtotal)}</strong></td>
    </tr>`).join('');

  const subject = `✅ Struk Pembelian ${params.invoiceNumber} — ${process.env.COMPANY_NAME ?? 'Ciomas Keramik'}`;
  const html = emailWrap(subject, `
    <p>Yth. <strong>${params.customerName}</strong>,</p>
    <p>Terima kasih telah berbelanja di ${process.env.COMPANY_NAME ?? 'Ciomas Keramik'}. Berikut adalah bukti transaksi Anda:</p>

    <div class="highlight">
      <strong>No. Invoice: ${params.invoiceNumber}</strong><br>
      Tanggal: ${new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(params.salesDate))}<br>
      Metode Pembayaran: ${pmLabel[params.paymentMethod] ?? params.paymentMethod}<br>
      Dilayani oleh: ${params.salespersonName}
    </div>

    <table class="detail">
      <thead><tr><th>Produk</th><th class="right">Qty</th><th class="right">Harga</th><th class="right">Subtotal</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="total-box">
      ${params.discountAmount > 0 ? `<div>Subtotal: ${rp(params.subtotal)}</div><div>Diskon: <span style="color:#16a34a">- ${rp(params.discountAmount)}</span></div>` : ''}
      <div class="grand">Total: ${rp(params.totalAmount)}</div>
    </div>

    <p><a class="btn-link" href="${params.printUrl}">🖨 Lihat & Cetak Struk</a></p>
    <p style="font-size:12px;color:#78716c">Jika ada pertanyaan mengenai transaksi ini, hubungi kami di ${process.env.COMPANY_PHONE ?? ''}.</p>
  `);

  return { subject, html };
}

/** PO / Pembelian ke Supplier */
export function buildPurchaseOrderEmail(params: {
  supplierName  : string;
  supplierEmail : string;
  poNumber      : string;
  poDate        : string;
  items         : { product_name:string; quantity:number; unit_price:number; subtotal:number }[];
  totalAmount   : number;
  notes        ?: string;
  printUrl      : string;
}): { subject: string; html: string } {
  const itemRows = params.items.map(i => `
    <tr>
      <td>${i.product_name}</td>
      <td class="right">${i.quantity}</td>
      <td class="right">${rp(i.unit_price)}</td>
      <td class="right"><strong>${rp(i.subtotal)}</strong></td>
    </tr>`).join('');

  const subject = `📦 Purchase Order ${params.poNumber} dari ${process.env.COMPANY_NAME ?? 'Ciomas Keramik'}`;
  const html = emailWrap(subject, `
    <p>Yth. <strong>${params.supplierName}</strong>,</p>
    <p>${process.env.COMPANY_NAME ?? 'Ciomas Keramik'} dengan ini mengajukan Purchase Order sebagai berikut:</p>

    <div class="highlight">
      <strong>No. PO: ${params.poNumber}</strong><br>
      Tanggal: ${new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(params.poDate))}
    </div>

    <table class="detail">
      <thead><tr><th>Produk</th><th class="right">Qty</th><th class="right">Harga Satuan</th><th class="right">Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="total-box">
      <div class="grand">Total PO: ${rp(params.totalAmount)}</div>
    </div>

    ${params.notes ? `<div class="alert-info"><strong>Catatan:</strong> ${params.notes}</div>` : ''}

    <p><a class="btn-link" href="${params.printUrl}">📄 Lihat Detail PO</a></p>
    <p>Mohon konfirmasi penerimaan PO ini dengan membalas email ini atau menghubungi kami.</p>
    <p style="font-size:12px;color:#78716c">Hormat kami,<br><strong>${process.env.COMPANY_NAME ?? 'Ciomas Keramik'}</strong><br>${process.env.COMPANY_PHONE ?? ''}</p>
  `);

  return { subject, html };
}

/** Berita Acara Kendala Pengiriman */
export function buildDeliveryReportEmail(params: {
  recipientName : string;
  recipientType : 'supplier' | 'customer';
  reportNumber  : string;
  reportDate    : string;
  refNumber     : string;
  issueType     : string;
  description   : string;
  items         : { product_name:string; qty_expected:number; qty_actual:number; qty_damaged:number }[];
  printUrl      : string;
}): { subject: string; html: string } {
  const issueLabels: Record<string,string> = {
    kurang:'Barang Kurang', lebih:'Barang Lebih', rusak:'Barang Rusak',
    salah_produk:'Produk Salah', campuran:'Kendala Campuran',
  };
  const itemRows = params.items.map(i => `
    <tr>
      <td>${i.product_name}</td>
      <td class="right">${i.qty_expected}</td>
      <td class="right">${i.qty_actual}</td>
      <td class="right" style="color:#dc2626">${i.qty_damaged > 0 ? i.qty_damaged : '—'}</td>
    </tr>`).join('');

  const subject = `⚠️ Berita Acara Kendala Pengiriman ${params.reportNumber} — ${params.refNumber}`;
  const html = emailWrap(subject, `
    <p>Yth. <strong>${params.recipientName}</strong>,</p>
    <p>Bersama email ini kami sampaikan Berita Acara terkait kendala pengiriman yang perlu segera ditindaklanjuti.</p>

    <div class="alert-warn">
      <strong>⚠ Jenis Kendala: ${issueLabels[params.issueType] ?? params.issueType}</strong><br>
      No. Laporan: ${params.reportNumber} · Ref: ${params.refNumber}<br>
      Tanggal: ${new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(params.reportDate))}
    </div>

    <p><strong>Deskripsi Masalah:</strong></p>
    <p style="padding:10px 14px;background:#fafaf9;border-radius:6px;border-left:3px solid #e7e5e4">${params.description}</p>

    <table class="detail">
      <thead><tr><th>Produk</th><th class="right">Seharusnya</th><th class="right">Aktual</th><th class="right">Rusak</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <p><a class="btn-link" href="${params.printUrl}">📋 Lihat Berita Acara Lengkap</a></p>
    <p>Mohon konfirmasi dan tindak lanjut sesegera mungkin. Kami menunggu respons dari pihak ${params.recipientType === 'supplier' ? 'Supplier' : 'Pelanggan'} dalam <strong>3 hari kerja</strong>.</p>
    <p style="font-size:12px;color:#78716c">Hormat kami,<br><strong>${process.env.COMPANY_NAME ?? 'Ciomas Keramik'}</strong></p>
  `);

  return { subject, html };
}

/** Bukti Penerimaan Barang ke Supplier */
export function buildGoodsReceiptEmail(params: {
  supplierName  : string;
  grNumber      : string;
  poNumber      : string;
  receivedDate  : string;
  totalReceived : number;
  totalDamaged  : number;
  totalValue    : number;
  printUrl      : string;
}): { subject: string; html: string } {
  const subject = `✅ Bukti Penerimaan Barang ${params.grNumber} (ref PO: ${params.poNumber})`;
  const html = emailWrap(subject, `
    <p>Yth. <strong>${params.supplierName}</strong>,</p>
    <p>Kami konfirmasikan bahwa barang dari Purchase Order <strong>${params.poNumber}</strong> telah kami terima dengan detail sebagai berikut:</p>

    <div class="highlight">
      <strong>No. Penerimaan: ${params.grNumber}</strong><br>
      Referensi PO: ${params.poNumber}<br>
      Tanggal Terima: ${new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(params.receivedDate))}
    </div>

    <div class="total-box">
      <div>Total Diterima: <strong>${params.totalReceived} pcs</strong></div>
      ${params.totalDamaged > 0 ? `<div style="color:#dc2626">Barang Rusak: <strong>${params.totalDamaged} pcs</strong> (akan diproses terpisah)</div>` : ''}
      <div class="grand">Nilai Barang Baik: ${rp(params.totalValue)}</div>
    </div>

    ${params.totalDamaged > 0 ? `<div class="alert-warn">Terdapat <strong>${params.totalDamaged} pcs barang rusak</strong>. Kami akan menghubungi Anda terkait proses penggantian/retur.</div>` : ''}

    <p><a class="btn-link" href="${params.printUrl}">📋 Lihat Detail Penerimaan</a></p>
    <p>Dokumen ini merupakan konfirmasi resmi penerimaan barang kami.</p>
    <p style="font-size:12px;color:#78716c">Hormat kami,<br><strong>${process.env.COMPANY_NAME ?? 'Ciomas Keramik'}</strong><br>${process.env.COMPANY_PHONE ?? ''}</p>
  `);

  return { subject, html };
}

// ── Send Function ─────────────────────────────────────────────────────────────

export interface SendEmailParams {
  to           : string;
  toName      ?: string;
  subject      : string;
  html         : string;
  template    ?: string;
  referenceId ?: string;
  referenceType?: string;
  sentBy      ?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ ok: boolean; error?: string }> {
  if (!cfg.enabled) {
    console.log(`[Email] Disabled — would send to ${params.to}: ${params.subject}`);
    return { ok: true };
  }

  if (!cfg.user || !cfg.pass) {
    return { ok: false, error: 'Email belum dikonfigurasi. Set EMAIL_USER dan EMAIL_PASS di .env' };
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from   : cfg.from,
      to     : params.toName ? `"${params.toName}" <${params.to}>` : params.to,
      subject: params.subject,
      html   : params.html,
    });

    await logEmail({
      recipient_email: params.to,
      recipient_name : params.toName,
      subject        : params.subject,
      template       : params.template,
      reference_id   : params.referenceId,
      reference_type : params.referenceType,
      status         : 'sent',
      created_by     : params.sentBy,
    });

    return { ok: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await logEmail({
      recipient_email: params.to,
      recipient_name : params.toName,
      subject        : params.subject,
      template       : params.template,
      reference_id   : params.referenceId,
      reference_type : params.referenceType,
      status         : 'failed',
      error_message  : errorMsg,
      created_by     : params.sentBy,
    });
    return { ok: false, error: errorMsg };
  }
}
