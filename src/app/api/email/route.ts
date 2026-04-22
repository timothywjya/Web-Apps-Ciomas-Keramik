export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ok, handle } from '@/server/controllers/base.controller';
import {
  sendEmail, buildSaleReceiptEmail, buildPurchaseOrderEmail,
  buildDeliveryReportEmail, buildGoodsReceiptEmail,
} from '@/lib/email';
import { dbQueryOne } from '@/server/repositories/base.repository';
import { SaleRepository }     from '@/server/repositories/sale.repository';
import { PurchaseRepository } from '@/server/repositories/purchase.repository';
import { GoodsReceiptRepository } from '@/server/repositories/goods-receipt.repository';
import { DeliveryReportRepository } from '@/server/repositories/opname-dr.repository';

const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager', 'kasir');
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const { type, id, to, toName } = body;

    let emailParams: { subject: string; html: string } | null = null;
    let template = type;

    if (type === 'sale_receipt') {
      const sale = await dbQueryOne<Record<string,unknown>>(
        `SELECT s.*, c.name AS customer_name, c.email AS customer_email, u.full_name AS salesperson_name
         FROM sales s LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN users u ON u.id=s.salesperson_id
         WHERE s.id=$1`, [id]
      );
      if (!sale) throw new Error('Invoice tidak ditemukan');
      const items = await SaleRepository.findItemsById(id);
      emailParams = buildSaleReceiptEmail({
        customerName   : String(sale.customer_name ?? 'Pelanggan'),
        invoiceNumber  : String(sale.invoice_number),
        salesDate      : String(sale.sales_date),
        items          : items.map(i => ({ product_name: String(i.product_name ?? ''), quantity: Number(i.quantity), unit_price: Number(i.unit_price), subtotal: Number(i.subtotal) })),
        subtotal       : Number(sale.subtotal),
        discountAmount : Number(sale.discount_amount),
        totalAmount    : Number(sale.total_amount),
        paymentMethod  : String(sale.payment_method),
        salespersonName: String(sale.salesperson_name ?? ''),
        printUrl       : `${BASE_URL}/api/pdf/sale/${id}`,
      });
    } else if (type === 'purchase_order') {
      const po = await PurchaseRepository.findById(id);
      if (!po) throw new Error('PO tidak ditemukan');
      const items = await PurchaseRepository.findItemsById(id);
      emailParams = buildPurchaseOrderEmail({
        supplierName : String((po as Record<string,unknown>).supplier_name ?? ''),
        supplierEmail: to,
        poNumber     : String(po.purchase_number),
        poDate       : String(po.purchase_date),
        items        : items.map(i => ({ product_name: String(i.product_name ?? ''), quantity: Number(i.quantity), unit_price: Number(i.unit_price), subtotal: Number(i.quantity) * Number(i.unit_price) })),
        totalAmount  : Number(po.total_amount),
        notes        : String(po.notes ?? ''),
        printUrl     : `${BASE_URL}/api/pdf/purchase/${id}`,
      });
    } else if (type === 'delivery_report') {
      const report = await DeliveryReportRepository.findById(id);
      const items  = await DeliveryReportRepository.findItems(id);
      if (!report) throw new Error('Berita acara tidak ditemukan');
      emailParams = buildDeliveryReportEmail({
        recipientName: toName ?? String(report.party_name ?? ''),
        recipientType: String(report.party_type ?? 'supplier') as 'supplier'|'customer',
        reportNumber : String(report.report_number),
        reportDate   : String(report.report_date),
        refNumber    : String(report.reference_number),
        issueType    : String(report.issue_type),
        description  : String(report.description),
        items        : items.map(i => ({ product_name: String(i.product_name ?? ''), qty_expected: Number(i.qty_expected), qty_actual: Number(i.qty_actual), qty_damaged: Number(i.qty_damaged) })),
        printUrl     : `${BASE_URL}/api/pdf/delivery-report/${id}`,
      });
    } else if (type === 'goods_receipt') {
      const gr    = await GoodsReceiptRepository.findById(id);
      const items = await GoodsReceiptRepository.findItems(id);
      if (!gr) throw new Error('BPB tidak ditemukan');
      const totalReceived = items.reduce((s,i) => s + Number(i.qty_received), 0);
      const totalDamaged  = items.reduce((s,i) => s + Number(i.qty_damaged), 0);
      const totalValue    = items.reduce((s,i) => s + (Number(i.qty_received)-Number(i.qty_damaged))*Number(i.unit_price), 0);
      emailParams = buildGoodsReceiptEmail({
        supplierName : String((gr as Record<string,unknown>).supplier_name ?? ''),
        grNumber     : String((gr as Record<string,unknown>).gr_number),
        poNumber     : String((gr as Record<string,unknown>).po_number),
        receivedDate : String((gr as Record<string,unknown>).received_date),
        totalReceived, totalDamaged, totalValue,
        printUrl     : `${BASE_URL}/api/pdf/goods-receipt/${id}`,
      });
    } else {
      throw new Error(`Tipe email tidak dikenal: ${type}`);
    }

    const result = await sendEmail({
      to, toName, ...emailParams, template,
      referenceId: id, referenceType: type, sentBy: auth.id,
    });

    if (!result.ok) throw new Error(result.error ?? 'Gagal mengirim email');
    return ok({ message: `Email berhasil dikirim ke ${to}` });
  });
}
