const Sale = require('../models/Sale');
const Debt = require('../models/Debt');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

class DashboardController {
    static async index(req, res) {
        try {
            // Get recent sales
            const recentSales = await Sale.getRecentSales(7, 10);

            // Get active debts
            const activeDebts = await Debt.getAll('active', 10);

            // Get debt statistics
            const debtStats = await Debt.getDebtStatistics();

            // Get warehouse stock summary
            const warehouseStock = await Product.getAllWarehouseStock();
            const lowStockItems = warehouseStock.filter(item => item.quantity < 5);

            // Calculate sales statistics
            const salesStats = {
                today: await getSalesToday(),
                thisWeek: await getSalesThisWeek(),
                thisMonth: await getSalesThisMonth()
            };

            res.render('dashboard', {
                title: 'Dashboard - MegaDent POS',
                recentSales,
                activeDebts,
                debtStats,
                lowStockItems,
                salesStats,
                totalWarehouseItems: warehouseStock.length
            });
        } catch (error) {
            console.error('Dashboard error:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Failed to load dashboard',
                error: error
            });
        }
    }
}

// Helper functions
async function getSalesToday() {
    const { query } = require('../config/database');
    const sql = `
        SELECT COUNT(*) as count, IFNULL(SUM(total_amount), 0) as total
        FROM sales
        WHERE DATE(sale_date) = CURDATE()
    `;
    const results = await query(sql);
    return results[0] || { count: 0, total: 0 };
}

async function getSalesThisWeek() {
    const { query } = require('../config/database');
    const sql = `
        SELECT COUNT(*) as count, IFNULL(SUM(total_amount), 0) as total
        FROM sales
        WHERE YEARWEEK(sale_date, 1) = YEARWEEK(CURDATE(), 1)
    `;
    const results = await query(sql);
    return results[0] || { count: 0, total: 0 };
}

async function getSalesThisMonth() {
    const { query } = require('../config/database');
    const sql = `
        SELECT COUNT(*) as count, IFNULL(SUM(total_amount), 0) as total
        FROM sales
        WHERE YEAR(sale_date) = YEAR(CURDATE())
        AND MONTH(sale_date) = MONTH(CURDATE())
    `;
    const results = await query(sql);
    return results[0] || { count: 0, total: 0 };
}

module.exports = DashboardController;
