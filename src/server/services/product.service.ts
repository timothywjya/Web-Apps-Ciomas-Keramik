import { ProductRepository } from '@/server/repositories/product.repository';
import { StockRepository } from '@/server/repositories/stock.repository';
import { dbQuery } from '@/server/repositories/base.repository';
import type { Product, CreateProductDto, ProductFilter } from '@/types';

export const ProductService = {

  async getAll(filter: ProductFilter = {}): Promise<Product[]> {
    return ProductRepository.findAll(filter);
  },

  async getById(id: string): Promise<Product> {
    const p = await ProductRepository.findById(id);
    if (!p) throw new Error('Produk tidak ditemukan');
    return p;
  },

  async create(dto: CreateProductDto, userId: string): Promise<Product> {
    if (!dto.sku || !dto.name) throw new Error('SKU dan nama produk wajib diisi');

    const existing = await ProductRepository.findBySku(dto.sku);
    if (existing) throw new Error(`SKU "${dto.sku}" sudah digunakan`);

    const product = await ProductRepository.create(dto);

    // Record initial stock movement
    if ((dto.stock_quantity ?? 0) > 0) {
      await StockRepository.create({
        product_id: product.id,
        movement_type: 'in',
        quantity: dto.stock_quantity!,
        quantity_before: 0,
        quantity_after: dto.stock_quantity!,
        reference_type: 'initial',
        notes: 'Stok awal produk baru',
        created_by: userId,
      });
    }

    return product;
  },

  async update(id: string, dto: Partial<CreateProductDto>, userId: string): Promise<Product> {
    const existing = await ProductRepository.findByIdForUpdate(id);
    if (!existing) throw new Error('Produk tidak ditemukan');

    // Log price history if price changed
    if (
      dto.purchase_price !== undefined && dto.purchase_price !== existing.purchase_price ||
      dto.selling_price !== undefined && dto.selling_price !== existing.selling_price
    ) {
      await dbQuery(
        `INSERT INTO price_history
           (product_id, old_purchase_price, new_purchase_price,
            old_selling_price, new_selling_price, changed_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, existing.purchase_price, dto.purchase_price ?? existing.purchase_price,
         existing.selling_price, dto.selling_price ?? existing.selling_price, userId]
      );
    }

    const updated = await ProductRepository.update(id, dto);
    if (!updated) throw new Error('Gagal memperbarui produk');
    return updated;
  },

  async delete(id: string): Promise<void> {
    const existing = await ProductRepository.findById(id);
    if (!existing) throw new Error('Produk tidak ditemukan');
    await ProductRepository.setActive(id, false);
  },

};
