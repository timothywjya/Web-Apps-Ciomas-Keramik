import { ReportRepository } from '@/server/repositories/report.repository';
import type { ReportFilter } from '@/types';

const defaultFrom = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
};
const defaultTo = () => new Date().toISOString().split('T')[0];

export const ReportService = {

  async getReport(filter: ReportFilter) {
    const from = filter.from || defaultFrom();
    const to   = filter.to   || defaultTo();

    switch (filter.type) {
      case 'sales_summary':  return ReportRepository.salesSummary(from, to);
      case 'monthly':        return ReportRepository.monthlySales();
      case 'product_sales':  return ReportRepository.productSales(from, to);
      case 'customer_sales': return ReportRepository.customerSales(from, to);
      default: throw new Error('Jenis laporan tidak valid');
    }
  },

  async getDashboardStats() {
    return ReportRepository.dashboardStats();
  },

};
