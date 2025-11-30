const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
    try {
        // Top customers by total purchases
        const topCustomers = await query(`
            SELECT c.id, c.full_name, c.phone,
                   COUNT(s.id) as total_purchases,
                   SUM(s.total_amount) as total_spent,
                   SUM(s.paid_amount) as total_paid
            FROM customers c
            JOIN sales s ON c.id = s.customer_id
            GROUP BY c.id, c.full_name, c.phone
            ORDER BY total_spent DESC
            LIMIT 10
        `);

        // Top debtors
        const topDebtors = await query(`
            SELECT c.id, c.full_name, c.phone,
                   SUM(d.current_amount) as total_debt,
                   COUNT(d.id) as debt_count
            FROM customers c
            JOIN debts d ON c.id = d.customer_id
            WHERE d.status = 'active'
            GROUP BY c.id, c.full_name, c.phone
            ORDER BY total_debt DESC
            LIMIT 10
        `);

        // Top selling products
        const topProducts = await query(`
            SELECT p.id, p.name, p.barcode,
                   SUM(si.quantity) as total_sold,
                   SUM(si.quantity * si.unit_price) as total_revenue
            FROM products p
            JOIN sale_items si ON p.id = si.product_id
            GROUP BY p.id, p.name, p.barcode
            ORDER BY total_sold DESC
            LIMIT 10
        `);

        // Top sellers by revenue
        const topSellers = await query(`
            SELECT sel.id, sel.full_name, sel.phone,
                   COUNT(s.id) as total_sales,
                   SUM(s.total_amount) as total_revenue,
                   SUM(s.paid_amount) as total_collected
            FROM sellers sel
            JOIN sales s ON sel.id = s.seller_id
            GROUP BY sel.id, sel.full_name, sel.phone
            ORDER BY total_revenue DESC
            LIMIT 10
        `);

        // Low stock alert
        const lowStockProducts = await query(`
            SELECT p.id, p.name, p.barcode,
                   COALESCE(wi.quantity, 0) as warehouse_quantity
            FROM products p
            LEFT JOIN warehouse_inventory wi ON p.id = wi.product_id
            WHERE COALESCE(wi.quantity, 0) < 10
            ORDER BY warehouse_quantity ASC
            LIMIT 20
        `);

        res.render('reports/index', {
            title: 'Reports & Analytics - MegaDent POS',
            topCustomers,
            topDebtors,
            topProducts,
            topSellers,
            lowStockProducts
        });
    } catch (error) {
        console.error('Reports error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message, error });
    }
});

module.exports = router;
