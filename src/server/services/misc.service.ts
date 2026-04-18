import { CategoryRepository } from '@/server/repositories/category.repository';
import { SupplierRepository } from '@/server/repositories/supplier.repository';
import { CustomerRepository } from '@/server/repositories/customer.repository';
import type { Category, CreateCategoryDto, Supplier, CreateSupplierDto } from '@/types';
import type { Customer, CreateCustomerDto } from '@/types';

export const CategoryService = {
  async getAll(): Promise<Category[]> {
    return CategoryRepository.findAll();
  },
  async create(dto: CreateCategoryDto): Promise<Category> {
    if (!dto.name) throw new Error('Nama kategori wajib diisi');
    return CategoryRepository.create(dto);
  },
  async update(id: string, dto: CreateCategoryDto): Promise<Category> {
    if (!dto.name) throw new Error('Nama kategori wajib diisi');
    const result = await CategoryRepository.update(id, dto);
    if (!result) throw new Error('Kategori tidak ditemukan');
    return result;
  },
  async delete(id: string): Promise<void> {
    await CategoryRepository.delete(id);
  },
};

export const SupplierService = {
  async getAll(search = ''): Promise<Supplier[]> {
    return SupplierRepository.findAll(search);
  },
  async create(dto: CreateSupplierDto): Promise<Supplier> {
    if (!dto.name) throw new Error('Nama supplier wajib diisi');
    return SupplierRepository.create(dto);
  },
  async update(id: string, dto: Partial<Supplier>): Promise<Supplier> {
    const result = await SupplierRepository.update(id, dto);
    if (!result) throw new Error('Supplier tidak ditemukan');
    return result;
  },
  async delete(id: string): Promise<void> {
    await SupplierRepository.setActive(id, false);
  },
};

export const CustomerService = {
  async getAll(search = '', type = ''): Promise<Customer[]> {
    return CustomerRepository.findAll(search, type);
  },
  async create(dto: CreateCustomerDto): Promise<Customer> {
    if (!dto.name) throw new Error('Nama pelanggan wajib diisi');
    return CustomerRepository.create(dto);
  },
  async update(id: string, dto: Partial<Customer>): Promise<Customer> {
    const result = await CustomerRepository.update(id, dto);
    if (!result) throw new Error('Pelanggan tidak ditemukan');
    return result;
  },
  async delete(id: string): Promise<void> {
    await CustomerRepository.setActive(id, false);
  },
};
