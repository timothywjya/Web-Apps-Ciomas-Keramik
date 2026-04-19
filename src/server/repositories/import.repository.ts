import pool from '@/lib/db';
import { dbTransaction } from './base.repository';

export type ImportCategory = { name: string; description?: string };
export type ImportSupplier = {
  name: string; contact_person?: string; phone?: string;
  email?: string; address?: string; city?: string; notes?: string;
};
export type ImportProduct = {
  sku: string; name: string; category_name?: string; supplier_name?: string;
  description?: string; unit?: string; size?: string; surface_type?: string;
  material?: string; color?: string; brand?: string; origin_country?: string;
  purchase_price: number; selling_price: number;
  grosir_price?: number; kontraktor_price?: number;
  stock_quantity?: number; min_stock?: number; max_stock?: number;
};

export type ImportResult = {
  inserted: number;
  updated : number;
  skipped : number;
  errors  : { row: number; message: string }[];
};

// ── Categories ────────────────────────────────────────────────────────────────
// Upsert by name (case-insensitive). Single round-trip via unnest.

export async function bulkUpsertCategories(rows: ImportCategory[]): Promise<ImportResult> {
  if (!rows.length) return { inserted: 0, updated: 0, skipped: 0, errors: [] };

  const names        = rows.map(r => r.name.trim());
  const descriptions = rows.map(r => r.description?.trim() ?? null);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query<{ action: string }>(`
      WITH input(name, description) AS (
        SELECT TRIM(n), d
        FROM   UNNEST($1::text[], $2::text[]) AS t(n, d)
        WHERE  TRIM(n) <> ''
      ),
      upsert AS (
        INSERT INTO categories (name, description)
        SELECT name, description FROM input
        ON CONFLICT (LOWER(name))
        DO UPDATE SET description = EXCLUDED.description
        RETURNING xmax
      )
      SELECT CASE WHEN xmax = 0 THEN 'inserted' ELSE 'updated' END AS action
      FROM   upsert
    `, [names, descriptions]);

    await client.query('COMMIT');

    const inserted = res.rows.filter(r => r.action === 'inserted').length;
    const updated  = res.rows.filter(r => r.action === 'updated').length;
    return { inserted, updated, skipped: rows.length - inserted - updated, errors: [] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Suppliers ─────────────────────────────────────────────────────────────────
// Upsert by name (case-insensitive).

export async function bulkUpsertSuppliers(rows: ImportSupplier[]): Promise<ImportResult> {
  if (!rows.length) return { inserted: 0, updated: 0, skipped: 0, errors: [] };

  const f = (arr: (string | null | undefined)[]) => arr.map(v => v?.trim() ?? null);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query<{ action: string }>(`
      WITH input(name, contact_person, phone, email, address, city, notes) AS (
        SELECT TRIM(n), cp, ph, em, ad, ci, no
        FROM   UNNEST(
          $1::text[], $2::text[], $3::text[], $4::text[],
          $5::text[], $6::text[], $7::text[]
        ) AS t(n, cp, ph, em, ad, ci, no)
        WHERE TRIM(n) <> ''
      ),
      upsert AS (
        INSERT INTO suppliers (name, contact_person, phone, email, address, city, notes)
        SELECT name, contact_person, phone, email, address, city, notes FROM input
        ON CONFLICT (LOWER(name))
        DO UPDATE SET
          contact_person = COALESCE(EXCLUDED.contact_person, suppliers.contact_person),
          phone          = COALESCE(EXCLUDED.phone,          suppliers.phone),
          email          = COALESCE(EXCLUDED.email,          suppliers.email),
          address        = COALESCE(EXCLUDED.address,        suppliers.address),
          city           = COALESCE(EXCLUDED.city,           suppliers.city),
          notes          = COALESCE(EXCLUDED.notes,          suppliers.notes),
          updated_at     = NOW()
        RETURNING xmax
      )
      SELECT CASE WHEN xmax = 0 THEN 'inserted' ELSE 'updated' END AS action FROM upsert
    `, [
      rows.map(r => r.name.trim()),
      f(rows.map(r => r.contact_person)),
      f(rows.map(r => r.phone)),
      f(rows.map(r => r.email)),
      f(rows.map(r => r.address)),
      f(rows.map(r => r.city)),
      f(rows.map(r => r.notes)),
    ]);

    await client.query('COMMIT');
    const inserted = res.rows.filter(r => r.action === 'inserted').length;
    const updated  = res.rows.filter(r => r.action === 'updated').length;
    return { inserted, updated, skipped: rows.length - inserted - updated, errors: [] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Products ──────────────────────────────────────────────────────────────────
// Upsert by SKU. Resolves category_name → id and supplier_name → id first.
// Batch size 500 to stay within pg parameter limits.

const PRODUCT_BATCH = 500;

export async function bulkUpsertProducts(rows: ImportProduct[]): Promise<ImportResult> {
  if (!rows.length) return { inserted: 0, updated: 0, skipped: 0, errors: [] };

  return dbTransaction(async (client) => {
    // Resolve category names → ids (single query)
    const catNames = [...new Set(rows.map(r => r.category_name?.trim()).filter(Boolean))];
    const catRes   = catNames.length
      ? await client.query<{ name: string; id: string }>(
          `SELECT LOWER(name) AS name, id FROM categories WHERE LOWER(name) = ANY($1)`,
          [catNames.map(n => n!.toLowerCase())],
        )
      : { rows: [] };
    const catMap = new Map(catRes.rows.map(r => [r.name, r.id]));

    // Resolve supplier names → ids (single query)
    const supNames = [...new Set(rows.map(r => r.supplier_name?.trim()).filter(Boolean))];
    const supRes   = supNames.length
      ? await client.query<{ name: string; id: string }>(
          `SELECT LOWER(name) AS name, id FROM suppliers WHERE LOWER(name) = ANY($1) AND is_active = true`,
          [supNames.map(n => n!.toLowerCase())],
        )
      : { rows: [] };
    const supMap = new Map(supRes.rows.map(r => [r.name, r.id]));

    let totalInserted = 0, totalUpdated = 0;
    const errors: ImportResult['errors'] = [];

    // Process in batches
    for (let i = 0; i < rows.length; i += PRODUCT_BATCH) {
      const batch = rows.slice(i, i + PRODUCT_BATCH);

      const skus          = batch.map(r => r.sku.trim().toUpperCase());
      const names         = batch.map(r => r.name.trim());
      const categoryIds   = batch.map(r => catMap.get(r.category_name?.trim().toLowerCase() ?? '') ?? null);
      const supplierIds   = batch.map(r => supMap.get(r.supplier_name?.trim().toLowerCase() ?? '') ?? null);
      const descriptions  = batch.map(r => r.description?.trim() ?? null);
      const units         = batch.map(r => r.unit?.trim() || 'pcs');
      const sizes         = batch.map(r => r.size?.trim() ?? null);
      const surfaceTypes  = batch.map(r => r.surface_type?.trim() ?? null);
      const materials     = batch.map(r => r.material?.trim() ?? null);
      const colors        = batch.map(r => r.color?.trim() ?? null);
      const brands        = batch.map(r => r.brand?.trim() ?? null);
      const origins       = batch.map(r => r.origin_country?.trim() ?? null);
      const purchasePrices = batch.map(r => r.purchase_price ?? 0);
      const sellingPrices  = batch.map(r => r.selling_price  ?? 0);
      const grosirPrices   = batch.map(r => r.grosir_price   ?? null);
      const kontrPrices    = batch.map(r => r.kontraktor_price ?? null);
      const stockQtys      = batch.map(r => r.stock_quantity  ?? 0);
      const minStocks      = batch.map(r => r.min_stock       ?? 10);
      const maxStocks      = batch.map(r => r.max_stock       ?? 500);

      const res = await client.query<{ action: string }>(`
        WITH input AS (
          SELECT
            UPPER(TRIM(sku))   AS sku,
            TRIM(name)         AS name,
            cat_id::uuid       AS category_id,
            sup_id::uuid       AS supplier_id,
            descr, unit, size, surface_type, material, color, brand, origin,
            pp::numeric  AS purchase_price,
            sp::numeric  AS selling_price,
            gp::numeric  AS grosir_price,
            kp::numeric  AS kontraktor_price,
            sq::int      AS stock_quantity,
            mn::int      AS min_stock,
            mx::int      AS max_stock
          FROM UNNEST(
            $1::text[],$2::text[],$3::text[],$4::text[],$5::text[],
            $6::text[],$7::text[],$8::text[],$9::text[],$10::text[],
            $11::text[],$12::text[],$13::text[],$14::text[],$15::text[],
            $16::text[],$17::text[],$18::text[],$19::text[],$20::text[]
          ) AS t(sku,name,cat_id,sup_id,descr,unit,size,surface_type,
                 material,color,brand,origin,pp,sp,gp,kp,sq,mn,mx)
          WHERE UPPER(TRIM(sku)) <> '' AND TRIM(name) <> ''
        ),
        upsert AS (
          INSERT INTO products
            (sku, name, category_id, supplier_id, description, unit, size,
             surface_type, material, color, brand, origin_country,
             purchase_price, selling_price, grosir_price, kontraktor_price,
             stock_quantity, min_stock, max_stock)
          SELECT * FROM input
          ON CONFLICT (sku) DO UPDATE SET
            name             = EXCLUDED.name,
            category_id      = COALESCE(EXCLUDED.category_id,   products.category_id),
            supplier_id      = COALESCE(EXCLUDED.supplier_id,   products.supplier_id),
            description      = COALESCE(EXCLUDED.description,   products.description),
            unit             = EXCLUDED.unit,
            size             = COALESCE(EXCLUDED.size,          products.size),
            surface_type     = COALESCE(EXCLUDED.surface_type,  products.surface_type),
            material         = COALESCE(EXCLUDED.material,      products.material),
            color            = COALESCE(EXCLUDED.color,         products.color),
            brand            = COALESCE(EXCLUDED.brand,         products.brand),
            origin_country   = COALESCE(EXCLUDED.origin_country,products.origin_country),
            purchase_price   = EXCLUDED.purchase_price,
            selling_price    = EXCLUDED.selling_price,
            grosir_price     = COALESCE(EXCLUDED.grosir_price,  products.grosir_price),
            kontraktor_price = COALESCE(EXCLUDED.kontraktor_price, products.kontraktor_price),
            updated_at       = NOW()
          RETURNING xmax
        )
        SELECT CASE WHEN xmax = 0 THEN 'inserted' ELSE 'updated' END AS action FROM upsert
      `, [
        skus, names,
        categoryIds.map(v => v ?? ''), supplierIds.map(v => v ?? ''),
        descriptions, units, sizes, surfaceTypes, materials, colors,
        brands, origins,
        purchasePrices.map(String), sellingPrices.map(String),
        grosirPrices.map(v => v !== null ? String(v) : ''),
        kontrPrices.map(v => v !== null ? String(v) : ''),
        stockQtys.map(String), minStocks.map(String), maxStocks.map(String),
      ]);

      totalInserted += res.rows.filter(r => r.action === 'inserted').length;
      totalUpdated  += res.rows.filter(r => r.action === 'updated').length;
    }

    return {
      inserted: totalInserted,
      updated : totalUpdated,
      skipped : 0,
      errors,
    };
  });
}
