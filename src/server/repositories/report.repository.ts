import { dbQuery } from './base.repository';

export const ReportRepository = {

  async salesSummary(from: string, to: string) {
    return dbQuery(
      `SELECT
         TO_CHAR(s.sales_date,'YYYY-MM-DD') AS date,
         COUNT(s.id)                         AS transactions,
         COALESCE(SUM(s.total_amount),0)     AS revenue,
         COALESCE(SUM(s.discount_amount),0)  AS discount
       FROM sales s
       WHERE s.sales_date BETWEEN $1 AND $2
         AND s.status != 'cancelled'
       GROUP BY s.sales_date
       ORDER BY s.sales_date ASC`,
      [from, to]
    );
  },

  async monthlySales() {
    return dbQuery(
      `SELECT
         TO_CHAR(DATE_TRUNC('month',sales_date),'Mon YYYY') AS month,
         COUNT(id)                                           AS transactions,
         COALESCE(SUM(total_amount),0)                      AS revenue
       FROM sales
       WHERE sales_date >= NOW() - INTERVAL '12 months'
         AND status != 'cancelled'
       GROUP BY DATE_TRUNC('month',sales_date)
       ORDER BY DATE_TRUNC('month',sales_date) ASC`
    );
  },

  async productSales(from: string, to: string) {
    return dbQuery(
      `SELECT p.name, p.sku, c.name AS category,
              SUM(si.quantity)  AS total_qty,
              SUM(si.subtotal)  AS total_revenue
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       JOIN sales s    ON s.id = si.sale_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE s.sales_date BETWEEN $1 AND $2
         AND s.status != 'cancelled'
       GROUP BY p.id, p.name, p.sku, c.name
       ORDER BY total_revenue DESC
       LIMIT 50`,
      [from, to]
    );
  },

  async customerSales(from: string, to: string) {
    return dbQuery(
      `SELECT c.name, c.customer_type, c.phone,
              COUNT(s.id)          AS transactions,
              SUM(s.total_amount)  AS total_spend
       FROM sales s
       JOIN customers c ON c.id = s.customer_id
       WHERE s.sales_date BETWEEN $1 AND $2
         AND s.status != 'cancelled'
       GROUP BY c.id, c.name, c.customer_type, c.phone
       ORDER BY total_spend DESC
       LIMIT 50`,
      [from, to]
    );
  },

  async dashboardStats() {
    const [sales] = await dbQuery<Record<string, unknown>>(
      `SELECT
         COUNT(*)                                                         AS total_transactions,
         COALESCE(SUM(total_amount),0)                                   AS total_revenue,
         COALESCE(SUM(CASE WHEN DATE(sales_date)=CURRENT_DATE THEN total_amount ELSE 0 END),0) AS today_revenue
       FROM sales WHERE status != 'cancelled'`
    );
    const [products] = await dbQuery<Record<string, unknown>>(
      `SELECT
         COUNT(*)                                               AS total_products,
         COUNT(CASE WHEN stock_quantity <= min_stock THEN 1 END) AS low_stock_count
       FROM products WHERE is_active=true`
    );
    const [customers] = await dbQuery<Record<string, unknown>>(
      `SELECT COUNT(*) AS total FROM customers WHERE is_active=true`
    );
    const topProducts = await dbQuery(
      `SELECT p.name, p.sku, SUM(si.quantity) AS total_sold, SUM(si.subtotal) AS total_revenue
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status!='cancelled' AND s.sales_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY p.id, p.name, p.sku
       ORDER BY total_sold DESC LIMIT 5`
    );
    const recentSales = await dbQuery(
      `SELECT s.invoice_number, c.name AS customer_name, s.total_amount,
              s.status, s.payment_status, s.sales_date
       FROM sales s LEFT JOIN customers c ON c.id=s.customer_id
       ORDER BY s.created_at DESC LIMIT 8`
    );
    const lowStock = await dbQuery(
      `SELECT name, sku, stock_quantity, min_stock
       FROM products WHERE stock_quantity <= min_stock AND is_active=true
       ORDER BY stock_quantity ASC LIMIT 5`
    );
    return { sales, products, customers, topProducts, recentSales, lowStock };
  },

};
