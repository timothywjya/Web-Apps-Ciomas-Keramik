import { dbQuery, dbQueryOne } from './base.repository';
import type { Product, CreateProductDto, ProductFilter } from '@/types';

const SELECT_WITH_JOINS = `
  SELECT p.*, c.name AS category_name, s.name AS supplier_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers  s ON s.id = p.supplier_id
`;

export const ProductRepository = {

  async findAll(filter: ProductFilter = {}): Promise<Product[]> {
    const params: unknown[] = [];
    const conditions: string[] = ['1=1'];

    if (filter.active !== undefined) conditions.push(`p.is_active = ${filter.active}`);
    if (filter.search) {
      params.push(`%${filter.search}%`);
      conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.brand ILIKE $${params.length})`);
    }
    if (filter.category) {
      params.push(filter.category);
      conditions.push(`p.category_id = $${params.length}`);
    }

    return dbQuery<Product>(
      `${SELECT_WITH_JOINS} WHERE ${conditions.join(' AND ')} ORDER BY p.name ASC LIMIT 500`,
      params
    );
  },

  async findById(id: string): Promise<Product | null> {
    return dbQueryOne<Product>(
      `${SELECT_WITH_JOINS} WHERE p.id = $1`,
      [id]
    );
  },

  async findByIdForUpdate(id: string): Promise<{ stock_quantity: number; purchase_price: number; selling_price: number } | null> {
    return dbQueryOne<{ stock_quantity: number; purchase_price: number; selling_price: number }>(
      `SELECT stock_quantity, purchase_price, selling_price FROM products WHERE id=$1`,
      [id]
    );
  },

  async findBySku(sku: string): Promise<Product | null> {
    return dbQueryOne<Product>(`${SELECT_WITH_JOINS} WHERE p.sku = $1`, [sku]);
  },

  async create(dto: CreateProductDto): Promise<Product> {
    const [p] = await dbQuery<Product>(
      `INSERT INTO products
         (sku, name, category_id, supplier_id, description, unit, size,
          surface_type, material, color, brand, origin_country,
          purchase_price, selling_price, grosir_price, kontraktor_price,
          stock_quantity, min_stock, max_stock, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [
        dto.sku, dto.name, dto.category_id ?? null, dto.supplier_id ?? null,
        dto.description ?? null, dto.unit ?? 'pcs', dto.size ?? null,
        dto.surface_type ?? null, dto.material ?? null, dto.color ?? null,
        dto.brand ?? null, dto.origin_country ?? null,
        dto.purchase_price ?? 0, dto.selling_price ?? 0,
        dto.grosir_price ?? null, dto.kontraktor_price ?? null,
        dto.stock_quantity ?? 0, dto.min_stock ?? 10, dto.max_stock ?? 500,
        dto.is_active ?? true,
      ]
    );
    return p;
  },

  async update(id: string, dto: Partial<CreateProductDto>): Promise<Product | null> {
    await dbQuery(
      `UPDATE products SET
         sku=$1, name=$2, category_id=$3, description=$4, unit=$5, size=$6,
         surface_type=$7, material=$8, color=$9, brand=$10, origin_country=$11,
         purchase_price=$12, selling_price=$13, grosir_price=$14,
         kontraktor_price=$15, min_stock=$16, is_active=$17, updated_at=NOW()
       WHERE id=$18`,
      [
        dto.sku, dto.name, dto.category_id ?? null, dto.description ?? null,
        dto.unit ?? 'pcs', dto.size ?? null, dto.surface_type ?? null,
        dto.material ?? null, dto.color ?? null, dto.brand ?? null,
        dto.origin_country ?? null, dto.purchase_price ?? 0,
        dto.selling_price ?? 0, dto.grosir_price ?? null,
        dto.kontraktor_price ?? null, dto.min_stock ?? 10,
        dto.is_active ?? true, id,
      ]
    );
    return this.findById(id);
  },

  async updateStock(id: string, qty: number): Promise<void> {
    await dbQuery(
      `UPDATE products SET stock_quantity=$1, updated_at=NOW() WHERE id=$2`,
      [qty, id]
    );
  },

  async updatePurchasePrice(id: string, price: number): Promise<void> {
    await dbQuery(
      `UPDATE products SET purchase_price=$1, updated_at=NOW() WHERE id=$2`,
      [price, id]
    );
  },

  async setActive(id: string, is_active: boolean): Promise<void> {
    await dbQuery(
      `UPDATE products SET is_active=$1, updated_at=NOW() WHERE id=$2`,
      [is_active, id]
    );
  },

};
