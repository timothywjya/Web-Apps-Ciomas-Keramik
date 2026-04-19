import { dbTransaction } from './base.repository';
import type { PoolClient } from 'pg';

// ── Domain types ──────────────────────────────────────────────────────────────

export type ImportCategory = {
  name       : string;
  description?: string;
};

export type ImportSupplier = {
  name          : string;
  contact_person?: string;
  phone         ?: string;
  email         ?: string;
  address       ?: string;
  city          ?: string;
  notes         ?: string;
};

export type ImportCustomer = {
  name         : string;
  phone        ?: string;
  email        ?: string;
  address      ?: string;
  city         ?: string;
  customer_type?: 'retail' | 'grosir' | 'kontraktor';
  notes        ?: string;
};

export type ImportProduct = {
  sku             : string;
  name            : string;
  category_name   ?: string;
  supplier_name   ?: string;
  description     ?: string;
  unit            ?: string;
  size            ?: string;
  surface_type    ?: string;
  material        ?: string;
  color           ?: string;
  brand           ?: string;
  origin_country  ?: string;
  purchase_price  : number;
  selling_price   : number;
  grosir_price    ?: number;
  kontraktor_price?: number;
  stock_quantity  ?: number;
  min_stock       ?: number;
  max_stock       ?: number;
};

export type ImportResult = {
  inserted: number;
  updated : number;
  skipped : number;
  errors  : { row: number; message: string }[];
};

// ── Shared helpers ────────────────────────────────────────────────────────────

/** xmax = 0  → fresh INSERT;  xmax != 0  → row was UPDATEd */
function countActions(rows: { xmax: string }[]): Pick<ImportResult, 'inserted' | 'updated'> {
  return {
    inserted: rows.filter(r => r.xmax === '0').length,
    updated : rows.filter(r => r.xmax !== '0').length,
  };
}

const emptyResult = (): ImportResult =>
  ({ inserted: 0, updated: 0, skipped: 0, errors: [] });

/** Trim string array, replace undefined with empty string for UNNEST. */
const toStrArr = (arr: (string | undefined)[]) => arr.map(v => v?.trim() ?? '');

/** Resolve name → UUID map with a single query. Case-insensitive. */
async function resolveLookup(
  client    : PoolClient,
  table     : string,
  nameCol   : string,
  rawNames  : (string | undefined)[],
  extraWhere = '',
): Promise<Map<string, string>> {
  const unique = [...new Set(
    rawNames.map(n => n?.trim().toLowerCase()).filter((n): n is string => !!n),
  )];
  if (!unique.length) return new Map();

  const cond  = extraWhere ? `AND ${extraWhere}` : '';
  const { rows } = await client.query<{ key: string; id: string }>(`
    SELECT LOWER(TRIM(${nameCol})) AS key, id::text AS id
    FROM   ${table}
    WHERE  LOWER(TRIM(${nameCol})) = ANY($1::text[]) ${cond}
  `, [unique]);

  return new Map(rows.map(r => [r.key, r.id]));
}

// ── Categories ────────────────────────────────────────────────────────────────
// Conflict key: idx_categories_name_lower  (LOWER(TRIM(name)))
// On duplicate: update description only when incoming value is non-empty.

export async function bulkUpsertCategories(rows: ImportCategory[]): Promise<ImportResult> {
  if (!rows.length) return emptyResult();

  return dbTransaction(async (client) => {
    const { rows: result } = await client.query<{ xmax: string }>(`
      WITH input(name, description) AS (
        SELECT TRIM(n), NULLIF(TRIM(d), '')
        FROM   UNNEST($1::text[], $2::text[]) AS t(n, d)
        WHERE  TRIM(n) <> ''
      )
      INSERT INTO categories (name, description)
        SELECT name, description FROM input
      ON CONFLICT (LOWER(TRIM(name))) DO UPDATE
        SET description = COALESCE(EXCLUDED.description, categories.description)
      RETURNING xmax::text
    `, [
      rows.map(r => r.name.trim()),
      rows.map(r => r.description?.trim() ?? ''),
    ]);

    return { ...countActions(result), skipped: 0, errors: [] };
  });
}

// ── Suppliers ─────────────────────────────────────────────────────────────────
// Conflict key: idx_suppliers_name_lower  (LOWER(TRIM(name)))
// On duplicate: COALESCE preserves existing non-null values when cell is empty.

export async function bulkUpsertSuppliers(rows: ImportSupplier[]): Promise<ImportResult> {
  if (!rows.length) return emptyResult();

  return dbTransaction(async (client) => {
    const { rows: result } = await client.query<{ xmax: string }>(`
      WITH input(name, contact_person, phone, email, address, city, notes) AS (
        SELECT
          TRIM(n),
          NULLIF(TRIM(cp),''), NULLIF(TRIM(ph),''), NULLIF(TRIM(em),''),
          NULLIF(TRIM(ad),''), NULLIF(TRIM(ci),''), NULLIF(TRIM(no),'')
        FROM UNNEST(
          $1::text[], $2::text[], $3::text[], $4::text[],
          $5::text[], $6::text[], $7::text[]
        ) AS t(n, cp, ph, em, ad, ci, no)
        WHERE TRIM(n) <> ''
      )
      INSERT INTO suppliers (name, contact_person, phone, email, address, city, notes)
        SELECT name, contact_person, phone, email, address, city, notes FROM input
      ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET
        contact_person = COALESCE(EXCLUDED.contact_person, suppliers.contact_person),
        phone          = COALESCE(EXCLUDED.phone,          suppliers.phone),
        email          = COALESCE(EXCLUDED.email,          suppliers.email),
        address        = COALESCE(EXCLUDED.address,        suppliers.address),
        city           = COALESCE(EXCLUDED.city,           suppliers.city),
        notes          = COALESCE(EXCLUDED.notes,          suppliers.notes),
        updated_at     = NOW()
      RETURNING xmax::text
    `, [
      rows.map(r => r.name.trim()),
      toStrArr(rows.map(r => r.contact_person)),
      toStrArr(rows.map(r => r.phone)),
      toStrArr(rows.map(r => r.email)),
      toStrArr(rows.map(r => r.address)),
      toStrArr(rows.map(r => r.city)),
      toStrArr(rows.map(r => r.notes)),
    ]);

    return { ...countActions(result), skipped: 0, errors: [] };
  });
}

// ── Customers ─────────────────────────────────────────────────────────────────
// Conflict key: idx_customers_name_lower  (LOWER(TRIM(name)))
// On duplicate: always update customer_type; COALESCE for optional fields.
// Note: total_purchases is NOT touched — managed by sale transactions only.

const VALID_CUSTOMER_TYPES = new Set(['retail', 'grosir', 'kontraktor']);

export async function bulkUpsertCustomers(rows: ImportCustomer[]): Promise<ImportResult> {
  if (!rows.length) return emptyResult();

  const types = rows.map(r =>
    VALID_CUSTOMER_TYPES.has(r.customer_type ?? '') ? r.customer_type! : 'retail'
  );

  return dbTransaction(async (client) => {
    const { rows: result } = await client.query<{ xmax: string }>(`
      WITH input(name, phone, email, address, city, customer_type, notes) AS (
        SELECT
          TRIM(n),
          NULLIF(TRIM(ph),''), NULLIF(TRIM(em),''),
          NULLIF(TRIM(ad),''), NULLIF(TRIM(ci),''),
          ct,
          NULLIF(TRIM(no),'')
        FROM UNNEST(
          $1::text[], $2::text[], $3::text[], $4::text[],
          $5::text[], $6::text[], $7::text[]
        ) AS t(n, ph, em, ad, ci, ct, no)
        WHERE TRIM(n) <> ''
      )
      INSERT INTO customers (name, phone, email, address, city, customer_type, notes)
        SELECT name, phone, email, address, city, customer_type, notes FROM input
      ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET
        phone         = COALESCE(EXCLUDED.phone,    customers.phone),
        email         = COALESCE(EXCLUDED.email,    customers.email),
        address       = COALESCE(EXCLUDED.address,  customers.address),
        city          = COALESCE(EXCLUDED.city,     customers.city),
        customer_type = EXCLUDED.customer_type,
        notes         = COALESCE(EXCLUDED.notes,    customers.notes),
        updated_at    = NOW()
      RETURNING xmax::text
    `, [
      rows.map(r => r.name.trim()),
      toStrArr(rows.map(r => r.phone)),
      toStrArr(rows.map(r => r.email)),
      toStrArr(rows.map(r => r.address)),
      toStrArr(rows.map(r => r.city)),
      types,
      toStrArr(rows.map(r => r.notes)),
    ]);

    return { ...countActions(result), skipped: 0, errors: [] };
  });
}

// ── Products ──────────────────────────────────────────────────────────────────
// Conflict key: products.sku (unique index in schema).
// Lookup: resolve category_name + supplier_name → UUIDs in 2 queries, before the loop.
// Batch size 500: keeps param count < 10_000 (19 cols × 500 = 9_500 params).
// Update rule:
//   - name, prices, unit  → always overwrite (CSV is source of truth)
//   - optional text cols  → COALESCE keeps DB value when CSV cell is empty
//   - stock_quantity      → NOT updated on conflict (managed via stock movements)

const PRODUCT_BATCH_SIZE = 500;

export async function bulkUpsertProducts(rows: ImportProduct[]): Promise<ImportResult> {
  if (!rows.length) return emptyResult();

  return dbTransaction(async (client) => {
    const [catMap, supMap] = await Promise.all([
      resolveLookup(client, 'categories', 'name', rows.map(r => r.category_name)),
      resolveLookup(client, 'suppliers',  'name', rows.map(r => r.supplier_name), 'is_active = true'),
    ]);

    let totalInserted = 0;
    let totalUpdated  = 0;

    for (let offset = 0; offset < rows.length; offset += PRODUCT_BATCH_SIZE) {
      const batch = rows.slice(offset, offset + PRODUCT_BATCH_SIZE);
      const { rows: result } = await client.query<{ xmax: string }>(
        PRODUCT_UPSERT_SQL,
        buildProductParams(batch, catMap, supMap),
      );
      const c = countActions(result);
      totalInserted += c.inserted;
      totalUpdated  += c.updated;
    }

    return { inserted: totalInserted, updated: totalUpdated, skipped: 0, errors: [] };
  });
}

// ── SQL & params (product) ────────────────────────────────────────────────────
// Extracted as constants: built once, reused across batches.

const PRODUCT_UPSERT_SQL = `
  WITH input AS (
    SELECT
      UPPER(TRIM(sku))                      AS sku,
      TRIM(name)                            AS name,
      NULLIF(cat_id,  '')::uuid             AS category_id,
      NULLIF(sup_id,  '')::uuid             AS supplier_id,
      NULLIF(TRIM(descr),  '')              AS description,
      COALESCE(NULLIF(TRIM(unit),''),'pcs') AS unit,
      NULLIF(TRIM(sz),  '')                 AS size,
      NULLIF(TRIM(surf),'')                 AS surface_type,
      NULLIF(TRIM(mat), '')                 AS material,
      NULLIF(TRIM(col), '')                 AS color,
      NULLIF(TRIM(br),  '')                 AS brand,
      NULLIF(TRIM(orig),'')                 AS origin_country,
      pp   ::numeric                        AS purchase_price,
      sp   ::numeric                        AS selling_price,
      NULLIF(gp,  '')::numeric              AS grosir_price,
      NULLIF(kp,  '')::numeric              AS kontraktor_price,
      sq   ::int                            AS stock_quantity,
      mn   ::int                            AS min_stock,
      mx   ::int                            AS max_stock
    FROM UNNEST(
      $1::text[], $2::text[], $3::text[], $4::text[],
      $5::text[], $6::text[], $7::text[], $8::text[],
      $9::text[], $10::text[],$11::text[],$12::text[],
      $13::text[],$14::text[],$15::text[],$16::text[],
      $17::text[],$18::text[],$19::text[]
    ) AS t(sku,name,cat_id,sup_id,descr,unit,sz,surf,mat,col,br,orig,pp,sp,gp,kp,sq,mn,mx)
    WHERE UPPER(TRIM(sku)) <> '' AND TRIM(name) <> ''
  )
  INSERT INTO products
    (sku, name, category_id, supplier_id, description, unit, size,
     surface_type, material, color, brand, origin_country,
     purchase_price, selling_price, grosir_price, kontraktor_price,
     stock_quantity, min_stock, max_stock)
  SELECT
    sku, name, category_id, supplier_id, description, unit, size,
    surface_type, material, color, brand, origin_country,
    purchase_price, selling_price, grosir_price, kontraktor_price,
    stock_quantity, min_stock, max_stock
  FROM input
  ON CONFLICT (sku) DO UPDATE SET
    name             = EXCLUDED.name,
    category_id      = COALESCE(EXCLUDED.category_id,      products.category_id),
    supplier_id      = COALESCE(EXCLUDED.supplier_id,      products.supplier_id),
    description      = COALESCE(EXCLUDED.description,      products.description),
    unit             = EXCLUDED.unit,
    size             = COALESCE(EXCLUDED.size,             products.size),
    surface_type     = COALESCE(EXCLUDED.surface_type,     products.surface_type),
    material         = COALESCE(EXCLUDED.material,         products.material),
    color            = COALESCE(EXCLUDED.color,            products.color),
    brand            = COALESCE(EXCLUDED.brand,            products.brand),
    origin_country   = COALESCE(EXCLUDED.origin_country,   products.origin_country),
    purchase_price   = EXCLUDED.purchase_price,
    selling_price    = EXCLUDED.selling_price,
    grosir_price     = COALESCE(EXCLUDED.grosir_price,     products.grosir_price),
    kontraktor_price = COALESCE(EXCLUDED.kontraktor_price,  products.kontraktor_price),
    updated_at       = NOW()
  RETURNING xmax::text
`;

function buildProductParams(
  batch : ImportProduct[],
  catMap: Map<string, string>,
  supMap: Map<string, string>,
): string[][] {
  const n = (v: number | undefined) => v !== undefined ? String(v) : '';
  const lookup = (map: Map<string, string>, key: string | undefined) =>
    map.get(key?.trim().toLowerCase() ?? '') ?? '';

  return [
    batch.map(r => r.sku.trim().toUpperCase()),
    batch.map(r => r.name.trim()),
    batch.map(r => lookup(catMap, r.category_name)),
    batch.map(r => lookup(supMap, r.supplier_name)),
    batch.map(r => r.description?.trim()    ?? ''),
    batch.map(r => r.unit?.trim()           ?? ''),
    batch.map(r => r.size?.trim()           ?? ''),
    batch.map(r => r.surface_type?.trim()   ?? ''),
    batch.map(r => r.material?.trim()       ?? ''),
    batch.map(r => r.color?.trim()          ?? ''),
    batch.map(r => r.brand?.trim()          ?? ''),
    batch.map(r => r.origin_country?.trim() ?? ''),
    batch.map(r => String(r.purchase_price  ?? 0)),
    batch.map(r => String(r.selling_price   ?? 0)),
    batch.map(r => n(r.grosir_price)),
    batch.map(r => n(r.kontraktor_price)),
    batch.map(r => String(r.stock_quantity  ?? 0)),
    batch.map(r => String(r.min_stock       ?? 10)),
    batch.map(r => String(r.max_stock       ?? 500)),
  ];
}
