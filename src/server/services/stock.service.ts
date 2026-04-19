import { StockRepository } from '@/server/repositories/stock.repository';
import { ProductRepository } from '@/server/repositories/product.repository';
import type { StockMovement, CreateStockMovementDto } from '@/types';

export const StockService = {

  async getAll(type = '', productId = ''): Promise<StockMovement[]> {
    return StockRepository.findAll(type, productId);
  },

  async recordMovement(dto: CreateStockMovementDto, userId: string): Promise<StockMovement> {
    if (!dto.product_id || !dto.quantity || dto.quantity <= 0) {
      throw new Error('Produk dan jumlah wajib diisi');
    }

    const product = await ProductRepository.findByIdForUpdate(dto.product_id);
    if (!product) throw new Error('Produk tidak ditemukan');

    const qtyBefore = product.stock_quantity;
    let qtyAfter: number;

    switch (dto.movement_type) {
      case 'in':
      case 'return':
        qtyAfter = qtyBefore + dto.quantity;
        break;
      case 'out':
        if (qtyBefore < dto.quantity) {
          throw new Error(`Stok tidak mencukupi. Stok saat ini: ${qtyBefore}`);
        }
        qtyAfter = qtyBefore - dto.quantity;
        break;
      case 'adjustment':
        qtyAfter = dto.quantity; // set to exact value
        break;
      default:
        throw new Error('Tipe pergerakan tidak valid');
    }

    await ProductRepository.updateStock(dto.product_id, qtyAfter);

    return StockRepository.create({
      product_id: dto.product_id,
      movement_type: dto.movement_type,
      quantity: dto.quantity,
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      reference_type: 'manual',
      notes: dto.notes,
      created_by: userId,
    });
  },

};
