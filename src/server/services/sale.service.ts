import { SaleRepository }     from '@/server/repositories/sale.repository';
import { ProductRepository }  from '@/server/repositories/product.repository';
import { CustomerRepository } from '@/server/repositories/customer.repository';
import { StockRepository }    from '@/server/repositories/stock.repository';
import { ReceivableRepository } from '@/server/repositories/ledger.repository';
import { generateInvoiceNumber } from '@/lib/auth';
import type { Sale, CreateSaleDto, UpdateSaleDto, SaleFilter, SaleItem } from '@/types';

export const SaleService = {

  async getAll(filter: SaleFilter = {}): Promise<Sale[]> {
    return SaleRepository.findAll(filter);
  },

  async getById(id: string): Promise<Sale & { items: SaleItem[] }> {
    const sale = await SaleRepository.findById(id);
    if (!sale) throw new Error('Invoice tidak ditemukan');
    const items = await SaleRepository.findItemsById(id);
    return { ...sale, items };
  },

  async create(dto: CreateSaleDto, userId: string): Promise<{ id: string; invoice_number: string }> {
    if (!dto.items?.length) throw new Error('Tambahkan minimal 1 produk');

    const enrichedItems: SaleItem[] = [];

    for (const item of dto.items) {
      const product = await ProductRepository.findByIdForUpdate(item.product_id);
      if (!product) throw new Error(`Produk tidak ditemukan: ${item.product_id}`);
      if (product.stock_quantity < item.quantity) {
        throw new Error(`Stok tidak mencukupi. Tersisa: ${product.stock_quantity}`);
      }
      const subtotal = item.quantity * item.unit_price * (1 - (item.discount_percent ?? 0) / 100);
      enrichedItems.push({ ...item, subtotal });
    }

    const subtotal       = enrichedItems.reduce((sum, i) => sum + i.subtotal, 0);
    const discountAmount = dto.discount_amount ?? 0;
    const totalAmount    = subtotal - discountAmount;

    const sale = await SaleRepository.createWithItems(
      {
        invoice_number : generateInvoiceNumber('INV'),
        customer_id    : dto.customer_id,
        payment_method : dto.payment_method ?? 'cash',
        subtotal,
        discount_amount: discountAmount,
        total_amount   : totalAmount,
        notes          : dto.notes,
        salesperson_id : userId,
      },
      enrichedItems,
      async (item: SaleItem, saleId: string) => {
        const product = await ProductRepository.findByIdForUpdate(item.product_id);
        if (!product) return;

        const qtyAfter = product.stock_quantity - item.quantity;

        await ProductRepository.updateStock(item.product_id, qtyAfter);
        await StockRepository.create({
          product_id    : item.product_id,
          movement_type : 'out',
          quantity      : item.quantity,
          quantity_before: product.stock_quantity,
          quantity_after : qtyAfter,
          reference_type : 'sale',
          reference_id   : saleId,
          created_by     : userId,
        });
      },
    );

    if (dto.customer_id) {
      await CustomerRepository.incrementPurchases(dto.customer_id, totalAmount);
    }

    // ── Auto-buat Piutang jika payment_method = kredit / tempo ──────────────
    const pm = dto.payment_method ?? 'cash';
    if (pm === 'kredit' || pm === 'tempo') {
      // Ambil invoice_number dari sale yang baru dibuat
      const newSale = await SaleRepository.findById(sale.id);
      if (newSale) {
        await ReceivableRepository.create({
          sale_id        : sale.id,
          invoice_number : newSale.invoice_number,
          invoice_date   : new Date().toISOString().split('T')[0],
          customer_id    : dto.customer_id,
          due_date       : dto.due_date ?? undefined,
          payment_type   : pm as 'kredit' | 'tempo',
          total_amount   : totalAmount,
          discount_amount: 0,
          notes          : dto.notes,
          created_by     : userId,
        });
      }
    }

    return sale;
  },

  async update(id: string, dto: UpdateSaleDto): Promise<Sale> {
    const existing = await SaleRepository.findById(id);
    if (!existing) throw new Error('Invoice tidak ditemukan');

    const updated = await SaleRepository.update(id, dto);
    if (!updated) throw new Error('Gagal memperbarui invoice');
    return updated;
  },

};
