import { dbQuery, dbQueryOne } from './base.repository';
import type { Category, CreateCategoryDto } from '@/types';

export const CategoryRepository = {

  async findAll(): Promise<Category[]> {
    return dbQuery<Category>(`SELECT * FROM categories ORDER BY name ASC`);
  },

  async findById(id: string): Promise<Category | null> {
    return dbQueryOne<Category>(`SELECT * FROM categories WHERE id=$1`, [id]);
  },

  async create(dto: CreateCategoryDto): Promise<Category> {
    const [cat] = await dbQuery<Category>(
      `INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *`,
      [dto.name, dto.description ?? null]
    );
    return cat;
  },

  async update(id: string, dto: CreateCategoryDto): Promise<Category | null> {
    const [cat] = await dbQuery<Category>(
      `UPDATE categories SET name=$1, description=$2 WHERE id=$3 RETURNING *`,
      [dto.name, dto.description ?? null, id]
    );
    return cat ?? null;
  },

  async delete(id: string): Promise<void> {
    await dbQuery(`DELETE FROM categories WHERE id=$1`, [id]);
  },

};
