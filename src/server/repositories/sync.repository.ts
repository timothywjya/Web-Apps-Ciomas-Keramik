import { dbTransaction } from './base.repository';
import pool from '@/lib/db';

export type DuplicateGroup = {
  field   : string;
  value   : string;
  count   : number;
  keep_id : string;
  ids     : string[];
};

export type SyncResult = {
  categories: { duplicates_found: number; merged: number };
  suppliers : { duplicates_found: number; merged: number };
  products  : { duplicates_found: number; merged: number };
};

// ── Find duplicates ───────────────────────────────────────────────────────────
// UUID tidak punya MIN() di PostgreSQL — harus cast ke text dulu,
// lalu pakai MIN() pada text, atau pakai FIRST_VALUE() window function.
// Strategi: keep record dengan created_at paling awal (oldest).

export async function findDuplicateCategories(): Promise<DuplicateGroup[]> {
  const client = await pool.connect();
  try {
    const res = await client.query<{
      value: string; count: string; keep_id: string; ids: string;
    }>(`
      SELECT
        LOWER(TRIM(name))                                          AS value,
        COUNT(*)                                                   AS count,
        MIN(created_at)::text                                      AS _oldest,
        (ARRAY_AGG(id::text ORDER BY created_at ASC))[1]          AS keep_id,
        STRING_AGG(id::text, ',' ORDER BY created_at ASC)         AS ids
      FROM   categories
      GROUP  BY LOWER(TRIM(name))
      HAVING COUNT(*) > 1
    `);
    return res.rows.map(r => ({
      field   : 'name',
      value   : r.value,
      count   : Number(r.count),
      keep_id : r.keep_id,
      ids     : r.ids.split(','),
    }));
  } finally {
    client.release();
  }
}

export async function findDuplicateSuppliers(): Promise<DuplicateGroup[]> {
  const client = await pool.connect();
  try {
    const res = await client.query<{
      value: string; count: string; keep_id: string; ids: string;
    }>(`
      SELECT
        LOWER(TRIM(name))                                          AS value,
        COUNT(*)                                                   AS count,
        (ARRAY_AGG(id::text ORDER BY created_at ASC))[1]          AS keep_id,
        STRING_AGG(id::text, ',' ORDER BY created_at ASC)         AS ids
      FROM   suppliers
      GROUP  BY LOWER(TRIM(name))
      HAVING COUNT(*) > 1
    `);
    return res.rows.map(r => ({
      field   : 'name',
      value   : r.value,
      count   : Number(r.count),
      keep_id : r.keep_id,
      ids     : r.ids.split(','),
    }));
  } finally {
    client.release();
  }
}

export async function findDuplicateProducts(): Promise<DuplicateGroup[]> {
  const client = await pool.connect();
  try {
    const res = await client.query<{
      value: string; count: string; keep_id: string; ids: string;
    }>(`
      SELECT
        LOWER(TRIM(name)) || '|' ||
        LOWER(COALESCE(TRIM(size),''))  || '|' ||
        LOWER(COALESCE(TRIM(brand),''))                            AS value,
        COUNT(*)                                                   AS count,
        (ARRAY_AGG(id::text ORDER BY created_at ASC))[1]          AS keep_id,
        STRING_AGG(id::text, ',' ORDER BY created_at ASC)         AS ids
      FROM   products
      WHERE  is_active = true
      GROUP  BY LOWER(TRIM(name)),
                LOWER(COALESCE(TRIM(size),'')),
                LOWER(COALESCE(TRIM(brand),''))
      HAVING COUNT(*) > 1
    `);
    return res.rows.map(r => ({
      field   : 'name+size+brand',
      value   : r.value,
      count   : Number(r.count),
      keep_id : r.keep_id,
      ids     : r.ids.split(','),
    }));
  } finally {
    client.release();
  }
}

// ── Merge duplicates ──────────────────────────────────────────────────────────
// Strategy: keep oldest record, re-point all FK references, delete/deactivate duplicates.

export async function mergeDuplicates(): Promise<SyncResult> {
  const [dupCats, dupSups, dupProds] = await Promise.all([
    findDuplicateCategories(),
    findDuplicateSuppliers(),
    findDuplicateProducts(),
  ]);

  return dbTransaction(async (client) => {
    let catMerged = 0, supMerged = 0, prodMerged = 0;

    for (const dup of dupCats) {
      const removeIds = dup.ids.filter(id => id !== dup.keep_id);
      if (!removeIds.length) continue;
      await client.query(
        `UPDATE products SET category_id = $1::uuid WHERE category_id = ANY($2::uuid[])`,
        [dup.keep_id, removeIds],
      );
      await client.query(`DELETE FROM categories WHERE id = ANY($1::uuid[])`, [removeIds]);
      catMerged += removeIds.length;
    }

    for (const dup of dupSups) {
      const removeIds = dup.ids.filter(id => id !== dup.keep_id);
      if (!removeIds.length) continue;
      await client.query(
        `UPDATE products  SET supplier_id = $1::uuid WHERE supplier_id = ANY($2::uuid[])`,
        [dup.keep_id, removeIds],
      );
      await client.query(
        `UPDATE purchases SET supplier_id = $1::uuid WHERE supplier_id = ANY($2::uuid[])`,
        [dup.keep_id, removeIds],
      );
      await client.query(`DELETE FROM suppliers WHERE id = ANY($1::uuid[])`, [removeIds]);
      supMerged += removeIds.length;
    }

    for (const dup of dupProds) {
      const removeIds = dup.ids.filter(id => id !== dup.keep_id);
      if (!removeIds.length) continue;
      await client.query(
        `UPDATE sale_items      SET product_id = $1::uuid WHERE product_id = ANY($2::uuid[])`,
        [dup.keep_id, removeIds],
      );
      await client.query(
        `UPDATE stock_movements SET product_id = $1::uuid WHERE product_id = ANY($2::uuid[])`,
        [dup.keep_id, removeIds],
      );
      await client.query(
        `UPDATE purchase_items  SET product_id = $1::uuid WHERE product_id = ANY($2::uuid[])`,
        [dup.keep_id, removeIds],
      );
      // Akumulasi stok duplikat ke keeper, lalu nonaktifkan
      await client.query(`
        UPDATE products
        SET    stock_quantity = stock_quantity + (
                 SELECT COALESCE(SUM(stock_quantity), 0)
                 FROM   products WHERE id = ANY($2::uuid[])
               ),
               updated_at = NOW()
        WHERE  id = $1::uuid
      `, [dup.keep_id, removeIds]);
      await client.query(
        `UPDATE products SET is_active = false, updated_at = NOW() WHERE id = ANY($1::uuid[])`,
        [removeIds],
      );
      prodMerged += removeIds.length;
    }

    return {
      categories: { duplicates_found: dupCats.length,  merged: catMerged  },
      suppliers : { duplicates_found: dupSups.length,  merged: supMerged  },
      products  : { duplicates_found: dupProds.length, merged: prodMerged },
    };
  });
}
