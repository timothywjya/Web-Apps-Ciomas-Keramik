export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ok, handle } from '@/server/controllers/base.controller';
import {
  sendEmail, buildSaleReceiptEmail, buildPurchaseOrderEmail,
  buildDeliveryReportEmail, buildGoodsReceiptEmail,
} from '@/lib/email';
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
    const template = type;

    if (type === 'sale_receipt') {
      const sale = await SaleRepository.findById(id); 
      if (!sale) throw new Error('Invoice tidak ditemukan');
      const items = await SaleRepository.findItemsById(id);
      
      emailParams = buildSaleReceiptEmail({
        customerName   : sale.customer_name ?? 'Pelanggan',
        invoiceNumber  : sale.invoice_number,
        salesDate      : sale.sales_date,
        items          : items.map(i => ({ 
            product_name: i.product_name ?? '', 
            quantity: Number(i.quantity), 
            unit_price: Number(i.unit_price), 
            subtotal: Number(i.subtotal) 
        })),
        subtotal       : Number(sale.subtotal),
        discountAmount : Number(sale.discount_amount),
        totalAmount    : Number(sale.total_amount),
        paymentMethod  : sale.payment_method,
        salespersonName: sale.salesperson_name ?? '',
        printUrl       : `${BASE_URL}/api/pdf/sale/${id}`,
      });

    } else if (type === 'purchase_order') {
      const po = await PurchaseRepository.findById(id);
      if (!po) throw new Error('PO tidak ditemukan');
      const items = await PurchaseRepository.findItemsById(id);
      
      emailParams = buildPurchaseOrderEmail({
        supplierName : po.supplier_name ?? '',
        supplierEmail: to,
        poNumber     : po.purchase_number,
        poDate       : po.purchase_date,
        items        : items.map(i => ({ 
            product_name: i.product_name ?? '', 
            quantity: Number(i.quantity), 
            unit_price: Number(i.unit_price), 
            subtotal: Number(i.quantity) * Number(i.unit_price) 
        })),
        totalAmount  : Number(po.total_amount),
        notes        : po.notes ?? '',
        printUrl     : `${BASE_URL}/api/pdf/purchase/${id}`,
      });

    } else if (type === 'delivery_report') {
      const report = await DeliveryReportRepository.findById(id);
      const items  = await DeliveryReportRepository.findItems(id);
      if (!report) throw new Error('Berita acara tidak ditemukan');
      
      emailParams = buildDeliveryReportEmail({
      recipientName: toName ?? String(report.party_name ?? ''),
      recipientType: (report.party_type as 'supplier'|'customer') ?? 'supplier',
      reportNumber : String(report.report_number), // Paksa ke string
      reportDate   : String(report.report_date),   // Paksa ke string
      refNumber    : String(report.reference_number),
      issueType    : String(report.issue_type),
      description  : String(report.description),
      items        : items.map(i => ({ 
          product_name: String(i.product_name ?? ''), 
          qty_expected: Number(i.qty_expected), 
          qty_actual  : Number(i.qty_actual), 
          qty_damaged : Number(i.qty_damaged) 
      })),
      printUrl     : `${BASE_URL}/api/pdf/delivery-report/${id}`,
    });

    } else if (type === 'goods_receipt') {
      const gr = await GoodsReceiptRepository.findById(id);
      const items = await GoodsReceiptRepository.findItems(id);
      if (!gr) throw new Error('BPB tidak ditemukan');
      
      emailParams = buildGoodsReceiptEmail({
        supplierName : String(gr.supplier_name ?? ''),
        grNumber     : String(gr.gr_number ?? ''),
        poNumber     : String(gr.po_number ?? ''),
        receivedDate : String(gr.received_date ?? ''),
        totalReceived: items.reduce((s, i) => s + Number(i.qty_received), 0),
        totalDamaged : items.reduce((s, i) => s + Number(i.qty_damaged), 0),
        totalValue   : items.reduce((s, i) => s + (Number(i.qty_received) - Number(i.qty_damaged)) * Number(i.unit_price), 0),
        
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