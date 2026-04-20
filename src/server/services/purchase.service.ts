import { PurchaseRepository } from '@/server/repositories/purchase.repository';
import { ProductRepository }  from '@/server/repositories/product.repository';
import { StockRepository }    from '@/server/repositories/stock.repository';
import { PayableRepository }  from '@/server/repositories/ledger.repository';
import { generateInvoiceNumber } from '@/lib/auth';
import type { Purchase, CreatePurchaseDto, PurchaseItem } from '@/types';

export const PurchaseService = {

  async getAll(search = '', status = ''): Promise<Purchase[]> {
    return PurchaseRepository.findAll(search, status);
  },

  async getById(id: string): Promise<Purchase> {
    const po = await PurchaseRepository.findById(id);
    if (!po) throw new Error('Purchase Order tidak ditemukan');
    const items = await PurchaseRepository.findItemsById(id);
    return { ...po, items };
  },

  async create(dto: CreatePurchaseDto, userId: string): Promise<{ id: string; purchase_number: string }> {
    if (!dto.items?.length) throw new Error('Tambahkan minimal 1 produk');

    const subtotal       = dto.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
    const purchaseNumber = generateInvoiceNumber('PO');

    const po = await PurchaseRepository.createWithItems(
      {
        purchase_number: purchaseNumber,
        supplier_id    : dto.supplier_id,
        subtotal,
        notes          : dto.notes,
        created_by     : userId,
      },
      dto.items,
      async (item: PurchaseItem, purchaseId: string) => {
        const product = await ProductRepository.findByIdForUpdate(item.product_id);
        if (!product) return;

        const qtyAfter = product.stock_quantity + item.quantity;

        await ProductRepository.updateStock(item.product_id, qtyAfter);
        await ProductRepository.updatePurchasePrice(item.product_id, item.unit_price);
        await StockRepository.create({
          product_id     : item.product_id,
          movement_type  : 'in',
          quantity       : item.quantity,
          quantity_before: product.stock_quantity,
          quantity_after : qtyAfter,
          reference_type : 'purchase',
          reference_id   : purchaseId,
          notes          : `PO: ${purchaseNumber}`,
          created_by     : userId,
        });
      },
    );

    // ── Auto-buat Hutang ke Supplier setiap kali PO dibuat ───────────────────
    await PayableRepository.create({
      purchase_id    : po.id,
      po_number      : purchaseNumber,
      po_date        : new Date().toISOString().split('T')[0],
      supplier_id    : dto.supplier_id,
      due_date       : (dto as { due_date?: string }).due_date ?? undefined,
      total_amount   : subtotal,
      discount_amount: 0,
      notes          : dto.notes,
      created_by     : userId,
    });

    return po;
  },

};
