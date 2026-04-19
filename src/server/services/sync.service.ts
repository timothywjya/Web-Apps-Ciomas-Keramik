import {
  findDuplicateCategories, findDuplicateSuppliers, findDuplicateProducts,
  mergeDuplicates,
  DuplicateGroup, SyncResult,
} from '@/server/repositories/sync.repository';

export type { DuplicateGroup, SyncResult };

export const SyncService = {

  async preview(): Promise<{
    categories: DuplicateGroup[];
    suppliers : DuplicateGroup[];
    products  : DuplicateGroup[];
    total     : number;
  }> {
    const [categories, suppliers, products] = await Promise.all([
      findDuplicateCategories(),
      findDuplicateSuppliers(),
      findDuplicateProducts(),
    ]);
    return {
      categories,
      suppliers,
      products,
      total: categories.length + suppliers.length + products.length,
    };
  },

  async merge(): Promise<SyncResult> {
    return mergeDuplicates();
  },

};
