import {
  bulkUpsertCategories, bulkUpsertSuppliers, bulkUpsertProducts,
  ImportResult, ImportProduct,
} from '@/server/repositories/import.repository';

export type ImportTarget = 'categories' | 'suppliers' | 'products';

// ── CSV parser ────────────────────────────────────────────────────────────────
// Minimal RFC-4180 parser — no external dependency needed.

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let i = 0;

    while (i < line.length) {
      if (line[i] === '"') {
        // Quoted field
        let val = '';
        i++; // skip opening quote
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else { val += line[i++]; }
        }
        cells.push(val);
        if (line[i] === ',') i++;
      } else {
        const end = line.indexOf(',', i);
        if (end === -1) { cells.push(line.slice(i).trim()); break; }
        cells.push(line.slice(i, end).trim());
        i = end + 1;
      }
    }
    rows.push(cells);
  }
  return rows;
}

// ── Import handlers ───────────────────────────────────────────────────────────

export async function importCategories(csvText: string): Promise<ImportResult> {
  const [header, ...dataRows] = parseCSV(csvText);
  if (!header) throw new Error('CSV kosong');

  const h = header.map(c => c.toLowerCase().trim());
  const iName = h.indexOf('name');
  const iDesc = h.indexOf('description');
  if (iName === -1) throw new Error('Kolom "name" wajib ada di CSV');

  const rows = dataRows
    .filter(r => r[iName]?.trim())
    .map(r => ({
      name       : r[iName].trim(),
      description: iDesc !== -1 ? r[iDesc]?.trim() || undefined : undefined,
    }));

  if (!rows.length) throw new Error('Tidak ada data valid di CSV');
  return bulkUpsertCategories(rows);
}

export async function importSuppliers(csvText: string): Promise<ImportResult> {
  const [header, ...dataRows] = parseCSV(csvText);
  if (!header) throw new Error('CSV kosong');

  const h = header.map(c => c.toLowerCase().trim());
  const col = (key: string) => h.indexOf(key);

  const iName = col('name');
  if (iName === -1) throw new Error('Kolom "name" wajib ada di CSV');

  const get = (r: string[], i: number) => (i !== -1 ? r[i]?.trim() || undefined : undefined);

  const rows = dataRows
    .filter(r => r[iName]?.trim())
    .map(r => ({
      name          : r[iName].trim(),
      contact_person: get(r, col('contact_person')),
      phone         : get(r, col('phone')),
      email         : get(r, col('email')),
      address       : get(r, col('address')),
      city          : get(r, col('city')),
      notes         : get(r, col('notes')),
    }));

  if (!rows.length) throw new Error('Tidak ada data valid di CSV');
  return bulkUpsertSuppliers(rows);
}

export async function importProducts(csvText: string): Promise<ImportResult> {
  const [header, ...dataRows] = parseCSV(csvText);
  if (!header) throw new Error('CSV kosong');

  const h = header.map(c => c.toLowerCase().trim());
  const col = (key: string) => h.indexOf(key);

  const iSku  = col('sku');
  const iName = col('name');
  if (iSku === -1 || iName === -1) throw new Error('Kolom "sku" dan "name" wajib ada di CSV');

  const num = (r: string[], i: number) => {
    if (i === -1) return undefined;
    const v = parseFloat(r[i]);
    return isNaN(v) ? undefined : v;
  };
  const str = (r: string[], i: number) => (i !== -1 ? r[i]?.trim() || undefined : undefined);

  const errors: ImportResult['errors'] = [];
  const rows = dataRows
    .map((r, idx): ImportProduct | null => {
      const sku           = r[iSku]?.trim();
      const name          = r[iName]?.trim();
      const purchase_price = num(r, col('purchase_price'));
      const selling_price  = num(r, col('selling_price'));

      if (!sku || !name) return null;
      if (selling_price === undefined) {
        errors.push({ row: idx + 2, message: `Baris ${idx + 2}: selling_price tidak valid` });
        return null;
      }

      return {
        sku,
        name,
        category_name   : str(r, col('category_name')),
        supplier_name   : str(r, col('supplier_name')),
        description     : str(r, col('description')),
        unit            : str(r, col('unit')),
        size            : str(r, col('size')),
        surface_type    : str(r, col('surface_type')),
        material        : str(r, col('material')),
        color           : str(r, col('color')),
        brand           : str(r, col('brand')),
        origin_country  : str(r, col('origin_country')),
        purchase_price  : purchase_price ?? 0,
        selling_price,
        grosir_price    : num(r, col('grosir_price')),
        kontraktor_price: num(r, col('kontraktor_price')),
        stock_quantity  : num(r, col('stock_quantity')) ?? 0,
        min_stock       : num(r, col('min_stock'))      ?? 10,
        max_stock       : num(r, col('max_stock'))      ?? 500,
      };
    })
    .filter((r): r is ImportProduct => r !== null);

  if (!rows.length) throw new Error('Tidak ada data valid di CSV');

  const result = await bulkUpsertProducts(rows);
  result.errors.push(...errors);
  result.skipped += errors.length;
  return result;
}

// ── CSV template generator ────────────────────────────────────────────────────

export function generateTemplate(target: ImportTarget): { csv: string; filename: string } {
  const templates: Record<ImportTarget, { headers: string[]; example: string[] }> = {
    categories: {
      headers: ['name', 'description'],
      example: ['Granit', 'Produk granit berkualitas tinggi'],
    },
    suppliers: {
      headers: ['name', 'contact_person', 'phone', 'email', 'address', 'city', 'notes'],
      example: ['PT Keramik Nusantara', 'Budi Santoso', '08123456789',
                'budi@keramiknusantara.com', 'Jl. Industri No. 1', 'Jakarta', ''],
    },
    products: {
      headers: [
        'sku', 'name', 'category_name', 'supplier_name', 'description',
        'unit', 'size', 'surface_type', 'material', 'color', 'brand', 'origin_country',
        'purchase_price', 'selling_price', 'grosir_price', 'kontraktor_price',
        'stock_quantity', 'min_stock', 'max_stock',
      ],
      example: [
        '0000001', 'Granit Marble White 60x60', 'Granit', 'PT Keramik Nusantara',
        'Granit motif marmer premium', 'pcs', '60x60', 'Polished', 'Granit',
        'Putih', 'Roman', 'Indonesia',
        '85000', '120000', '110000', '100000', '100', '10', '500',
      ],
    },
  };

  const t = templates[target];
  const headerRow  = t.headers.join(',');
  const exampleRow = t.example.map(v => v.includes(',') ? `"${v}"` : v).join(',');
  const csv = `${headerRow}\n${exampleRow}\n`;

  return { csv, filename: `template_${target}.csv` };
}
