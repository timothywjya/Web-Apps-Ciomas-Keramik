import { PurchaseRepository } from '@/server/repositories/purchase.repository';
import { PayableRepository }  from '@/server/repositories/ledger.repository';
import { generateInvoiceNumber } from '@/lib/auth';
import type { Purchase, CreatePurchaseDto } from '@/types';

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

  /**
   * Buat PO — TIDAK menambah stok secara langsung.
   * Stok baru ditambahkan setelah Bukti Penerimaan Barang (BPB) dikonfirmasi.
   */
  async create(dto: CreatePurchaseDto, userId: string): Promise<{ id: string; purchase_number: string }> {
    if (!dto.items?.length) throw new Error('Tambahkan minimal 1 produk');

    const subtotal       = dto.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
    const purchaseNumber = generateInvoiceNumber('PO');

    // Buat PO dengan status 'pending' (bukan 'received')
    const po = await PurchaseRepository.createPendingWithItems(
      {
        purchase_number: purchaseNumber,
        supplier_id    : dto.supplier_id,
        subtotal,
        notes          : dto.notes,
        created_by     : userId,
      },
      dto.items,
    );

    // Auto-buat Hutang ke Supplier
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
