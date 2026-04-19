import {
  bulkUpsertCategories, bulkUpsertSuppliers,
  bulkUpsertCustomers,  bulkUpsertProducts,
  ImportResult, ImportProduct, ImportCustomer,
} from '@/server/repositories/import.repository';

export type ImportTarget = 'categories' | 'suppliers' | 'customers' | 'products';

// ── CSV parser ────────────────────────────────────────────────────────────────
// RFC-4180 compliant. Handles: quoted fields, embedded commas, escaped quotes ("").
// No external dependency.

function parseCSV(text: string): string[][] {
  const rows : string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let i = 0;

    while (i < line.length) {
      if (line[i] === '"') {
        let val = '';
        i++;
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

// ── Header resolver ───────────────────────────────────────────────────────────

function makeColResolver(header: string[]) {
  const h = header.map(c => c.toLowerCase().trim());
  return (key: string) => h.indexOf(key);
}

function reqCol(col: number, name: string): void {
  if (col === -1) throw new Error(`Kolom "${name}" wajib ada di CSV`);
}

function strVal(row: string[], i: number): string | undefined {
  return i !== -1 ? row[i]?.trim() || undefined : undefined;
}

function numVal(row: string[], i: number): number | undefined {
  if (i === -1) return undefined;
  const v = parseFloat(row[i]);
  return isNaN(v) ? undefined : v;
}

// ── Import: Categories ────────────────────────────────────────────────────────

export async function importCategories(csvText: string): Promise<ImportResult> {
  const [header, ...dataRows] = parseCSV(csvText);
  if (!header?.length) throw new Error('CSV kosong atau format tidak valid');

  const col   = makeColResolver(header);
  const iName = col('name');
  reqCol(iName, 'name');

  const rows = dataRows
    .filter(r => r[iName]?.trim())
    .map(r => ({
      name       : r[iName].trim(),
      description: strVal(r, col('description')),
    }));

  if (!rows.length) throw new Error('Tidak ada data valid di CSV');
  return bulkUpsertCategories(rows);
}

// ── Import: Suppliers ─────────────────────────────────────────────────────────

export async function importSuppliers(csvText: string): Promise<ImportResult> {
  const [header, ...dataRows] = parseCSV(csvText);
  if (!header?.length) throw new Error('CSV kosong atau format tidak valid');

  const col   = makeColResolver(header);
  const iName = col('name');
  reqCol(iName, 'name');

  const rows = dataRows
    .filter(r => r[iName]?.trim())
    .map(r => ({
      name          : r[iName].trim(),
      contact_person: strVal(r, col('contact_person')),
      phone         : strVal(r, col('phone')),
      email         : strVal(r, col('email')),
      address       : strVal(r, col('address')),
      city          : strVal(r, col('city')),
      notes         : strVal(r, col('notes')),
    }));

  if (!rows.length) throw new Error('Tidak ada data valid di CSV');
  return bulkUpsertSuppliers(rows);
}

// ── Import: Customers ─────────────────────────────────────────────────────────

const CUSTOMER_TYPES = new Set(['retail', 'grosir', 'kontraktor']);

export async function importCustomers(csvText: string): Promise<ImportResult> {
  const [header, ...dataRows] = parseCSV(csvText);
  if (!header?.length) throw new Error('CSV kosong atau format tidak valid');

  const col   = makeColResolver(header);
  const iName = col('name');
  reqCol(iName, 'name');

  const rows = dataRows
    .filter(r => r[iName]?.trim())
    .map((r): ImportCustomer => {
      const rawType = strVal(r, col('customer_type'))?.toLowerCase();
      return {
        name         : r[iName].trim(),
        phone        : strVal(r, col('phone')),
        email        : strVal(r, col('email')),
        address      : strVal(r, col('address')),
        city         : strVal(r, col('city')),
        customer_type: CUSTOMER_TYPES.has(rawType ?? '') ? rawType as ImportCustomer['customer_type'] : 'retail',
        notes        : strVal(r, col('notes')),
      };
    });

  if (!rows.length) throw new Error('Tidak ada data valid di CSV');
  return bulkUpsertCustomers(rows);
}

// ── Import: Products ──────────────────────────────────────────────────────────

export async function importProducts(csvText: string): Promise<ImportResult> {
  const [header, ...dataRows] = parseCSV(csvText);
  if (!header?.length) throw new Error('CSV kosong atau format tidak valid');

  const col   = makeColResolver(header);
  const iSku  = col('sku');
  const iName = col('name');
  const iSell = col('selling_price');
  reqCol(iSku,  'sku');
  reqCol(iName, 'name');
  reqCol(iSell, 'selling_price');

  const errors: ImportResult['errors'] = [];
  const rows = dataRows
    .map((r, idx): ImportProduct | null => {
      const sku          = r[iSku]?.trim();
      const name         = r[iName]?.trim();
      const selling_price = numVal(r, iSell);

      if (!sku || !name) return null;

      if (selling_price === undefined) {
        errors.push({ row: idx + 2, message: `Baris ${idx + 2}: selling_price tidak valid (nilai: "${r[iSell]}")` });
        return null;
      }

      return {
        sku,
        name,
        category_name   : strVal(r, col('category_name')),
        supplier_name   : strVal(r, col('supplier_name')),
        description     : strVal(r, col('description')),
        unit            : strVal(r, col('unit')),
        size            : strVal(r, col('size')),
        surface_type    : strVal(r, col('surface_type')),
        material        : strVal(r, col('material')),
        color           : strVal(r, col('color')),
        brand           : strVal(r, col('brand')),
        origin_country  : strVal(r, col('origin_country')),
        purchase_price  : numVal(r, col('purchase_price')) ?? 0,
        selling_price,
        grosir_price    : numVal(r, col('grosir_price')),
        kontraktor_price: numVal(r, col('kontraktor_price')),
        stock_quantity  : numVal(r, col('stock_quantity')) ?? 0,
        min_stock       : numVal(r, col('min_stock'))      ?? 10,
        max_stock       : numVal(r, col('max_stock'))      ?? 500,
      };
    })
    .filter((r): r is ImportProduct => r !== null);

  if (!rows.length && !errors.length) throw new Error('Tidak ada data valid di CSV');

  const result = await bulkUpsertProducts(rows);
  result.errors.push(...errors);
  result.skipped += errors.length;
  return result;
}

// ── CSV template generator ────────────────────────────────────────────────────

type TemplateSpec = { headers: string[]; example: string[] };

const TEMPLATES: Record<ImportTarget, TemplateSpec> = {
  categories: {
    headers: ['name', 'description'],
    example: ['Granit', 'Produk granit berkualitas tinggi'],
  },
  suppliers: {
    headers: ['name', 'contact_person', 'phone', 'email', 'address', 'city', 'notes'],
    example: ['PT Keramik Nusantara', 'Budi Santoso', '08123456789',
              'budi@keramiknusantara.com', 'Jl. Industri No.1', 'Jakarta', ''],
  },
  customers: {
    headers: ['name', 'phone', 'email', 'address', 'city', 'customer_type', 'notes'],
    example: ['Toko Bangunan Maju', '08211234567', 'maju@email.com',
              'Jl. Raya Bogor No.10', 'Bogor', 'retail', ''],
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

function escapeCSVField(v: string): string {
  return v.includes(',') || v.includes('"') || v.includes('\n')
    ? `"${v.replace(/"/g, '""')}"`
    : v;
}

export function generateTemplate(target: ImportTarget): { csv: string; filename: string } {
  const spec       = TEMPLATES[target];
  const headerRow  = spec.headers.join(',');
  const exampleRow = spec.example.map(escapeCSVField).join(',');
  return {
    csv     : `${headerRow}\n${exampleRow}\n`,
    filename: `template_import_${target}.csv`,
  };
}
