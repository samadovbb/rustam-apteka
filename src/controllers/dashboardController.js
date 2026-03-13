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

    static async recalculateAll(req, res) {
        const { query } = require('../config/database');
        const { exec } = require('child_process');
        const path = require('path');
        
        try {
            console.log('🔄 Barcha ustama va jarimalar tozalanib, qayta hisoblanmoqda...');
            
            await query('SET FOREIGN_KEY_CHECKS = 0');
            
            // 1. Clear seller penalties
            await query('TRUNCATE TABLE seller_penalties');
            
            // 2. Clear debt markups
            await query('TRUNCATE TABLE debt_fixed_markup_logs');
            await query('TRUNCATE TABLE debt_percent_markup_logs');
            
            // 3. Reset debts current amount
            await query(`
                UPDATE debts d
                SET d.current_amount = d.original_amount - IFNULL(
                    (SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.debt_id = d.id), 
                    0
                ),
                d.last_markup_date = NULL
            `);
            
            await query('SET FOREIGN_KEY_CHECKS = 1');
            console.log("✅ Eski ma'lumotlar jadvallardan o'chirildi va qarzlar asliga qaytarildi.");
            
            const script1 = path.join(__dirname, '../../scripts/calculate-retroactive-markups.js');
            const script2 = path.join(__dirname, '../../scripts/calculate-seller-penalties.js');
            
            // Execute as background processes
            exec(`node "${script1}" && node "${script2}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error('Recalculation error:', error);
                } else {
                    console.log('Muvaffaqiyatli hisoblandi:', stdout);
                }
            });
            
            res.json({ success: true, message: "Qayta hisoblash boshlandi. Yana 10-15 soniyadan so'ng sahifani yangilang." });
        } catch (error) {
            console.error('Recalculate error:', error);
            res.status(500).json({ success: false, error: error.message });
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
