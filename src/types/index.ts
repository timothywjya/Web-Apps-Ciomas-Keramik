// types/index.ts  — Shared domain types

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
}

// ── Auth ──────────────────────────────────────
export interface UserPayload {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'kasir' | 'gudang';
}

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash?: string;
  full_name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: string;
  phone?: string;
}

export interface UpdateUserDto {
  full_name?: string;
  email?: string;
  role?: string;
  phone?: string;
  is_active?: boolean;
  password?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateSupplierDto {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
}

// ── Customer ──────────────────────────────────
export type CustomerType = 'retail' | 'grosir' | 'kontraktor';

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  customer_type: CustomerType;
  notes?: string;
  total_purchases: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateCustomerDto {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  customer_type?: CustomerType;
  notes?: string;
}

// ── Product ───────────────────────────────────
export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id?: string;
  category_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  description?: string;
  unit: string;
  size?: string;
  surface_type?: string;
  material?: string;
  color?: string;
  brand?: string;
  origin_country?: string;
  purchase_price: number;
  selling_price: number;
  grosir_price?: number;
  kontraktor_price?: number;
  stock_quantity: number;
  min_stock: number;
  max_stock: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateProductDto {
  sku: string;
  name: string;
  category_id?: string;
  supplier_id?: string;
  description?: string;
  unit?: string;
  size?: string;
  surface_type?: string;
  material?: string;
  color?: string;
  brand?: string;
  origin_country?: string;
  purchase_price: number;
  selling_price: number;
  grosir_price?: number;
  kontraktor_price?: number;
  stock_quantity?: number;
  min_stock?: number;
  max_stock?: number;
  is_active?: boolean;
}

export interface ProductFilter {
  search?: string;
  category?: string;
  active?: boolean;
}

// ── Stock ─────────────────────────────────────
export type MovementType = 'in' | 'out' | 'adjustment' | 'return';

export interface StockMovement {
  id: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  movement_type: MovementType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
}

export interface CreateStockMovementDto {
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  notes?: string;
}

// ── Sale ──────────────────────────────────────
export type PaymentMethod = 'cash' | 'transfer' | 'kredit' | 'tempo';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type SaleStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';

export interface SaleItem {
  product_id: string;
  product_name?: string;
  sku?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  invoice_number: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  sales_date: string;
  status: SaleStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  notes?: string;
  salesperson_id?: string;
  salesperson_name?: string;
  created_at: string;
  items?: SaleItem[];
}

export interface CreateSaleDto {
  customer_id?: string;
  payment_method?: PaymentMethod;
  discount_amount?: number;
  due_date?: string;
  notes?: string;
  items: SaleItem[];
}

export interface UpdateSaleDto {
  status?: SaleStatus;
  payment_status?: PaymentStatus;
  paid_amount?: number;
  notes?: string;
}

export interface SaleFilter {
  search?: string;
  status?: string;
  from?: string;
  to?: string;
}

// ── Purchase ──────────────────────────────────
export type PurchaseStatus = 'pending' | 'received' | 'partial' | 'cancelled';

export interface PurchaseItem {
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Purchase {
  id: string;
  purchase_number: string;
  supplier_id?: string;
  supplier_name?: string;
  purchase_date: string;
  status: PurchaseStatus;
  subtotal: number;
  total_amount: number;
  notes?: string;
  created_by_name?: string;
  created_at: string;
  items?: PurchaseItem[];
}

export interface CreatePurchaseDto {
  supplier_id?: string;
  due_date?: string;
  notes?: string;
  items: PurchaseItem[];
}

export interface PayablePayment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_no?: string;
  notes?: string;
}

export type Payable = {
    id: string;
    purchase_id?: string | undefined;
    po_number: string;
    po_date: string;
    due_date?: string | undefined;
    supplier_name: string;
    supplier_phone?: string | undefined;
    ref_number?: string | undefined;
    total_amount: number;
    discount_amount: number;
    paid_amount: number;
    outstanding: number;
    status: "partial" | "paid" | "outstanding" | "overdue";
    source?: "auto" | "manual" | undefined;
    notes?: string | undefined;
}

export type ReportType = 'sales_summary' | 'monthly' | 'product_sales' | 'customer_sales';

export interface ReportFilter {
  type: ReportType;
  from?: string;
  to?: string;
}
