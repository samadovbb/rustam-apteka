const { query } = require('../config/database');
const Seller = require('../models/Seller');

class ReportsController {
    // Detailed Products Report
    static async detailedProductsReport(req, res) {
        try {
            const { seller_id, start_date, end_date } = req.query;

            // Get all sellers for filter
            const sellers = await Seller.getAll();

            // Build date filter
            const currentYear = new Date().getFullYear();
            const dateStart = start_date || `${currentYear}-01-01`;
            const dateEnd = end_date || `${currentYear}-12-31`;

            // Build seller filter
            let sellerFilter = '';
            if (seller_id && seller_id !== 'all') {
                sellerFilter = `AND s.seller_id = ${parseInt(seller_id)}`;
            }

            // Get detailed product sales data
            const productSales = await query(`
                SELECT
                    s.id as sale_id,
                    s.sale_date,
                    sel.full_name as seller_name,
                    p.name as product_name,
                    si.purchase_price_at_sale,
                    si.unit_price as sell_price,
                    si.quantity,
                    (si.unit_price - si.purchase_price_at_sale) * si.quantity as product_profit,
                    d.markup_type,
                    d.markup_value
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.id
                JOIN sellers sel ON s.seller_id = sel.id
                JOIN products p ON si.product_id = p.id
                LEFT JOIN debts d ON s.id = d.sale_id
                WHERE s.sale_date BETWEEN ? AND ?
                ${sellerFilter}
                ORDER BY s.sale_date DESC, s.id, p.name
            `, [dateStart, dateEnd]);

            // Calculate markup months for each sale
            const salesWithMarkup = [];
            for (const item of productSales) {
                let markupMonths = 0;
                let fixedMarkup = 0;

                if (item.markup_type === 'fixed' && item.markup_value) {
                    // Get markup logs count for this sale
                    const markupLogs = await query(`
                        SELECT COUNT(*) as count, SUM(markup_value) as total_markup
                        FROM debt_fixed_markup_logs
                        WHERE debt_id = (SELECT id FROM debts WHERE sale_id = ?)
                    `, [item.sale_id]);

                    if (markupLogs[0]) {
                        markupMonths = markupLogs[0].count || 0;
                        fixedMarkup = parseFloat(markupLogs[0].total_markup || 0);
                    }
                }

                salesWithMarkup.push({
                    ...item,
                    markup_months: markupMonths,
                    fixed_markup_total: fixedMarkup,
                    total_profit: parseFloat(item.product_profit) + (fixedMarkup / (item.quantity || 1))
                });
            }

            res.render('reports/detailed-products', {
                title: 'Batafsil Hisobot (Mahsulotlar bo\'yicha)',
                sellers,
                productSales: salesWithMarkup,
                filters: {
                    seller_id: seller_id || 'all',
                    start_date: dateStart,
                    end_date: dateEnd
                }
            });
        } catch (error) {
            console.error('Detailed products report error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    // Detailed Sales Report
    static async detailedSalesReport(req, res) {
        try {
            const { seller_id, start_date, end_date } = req.query;

            // Get all sellers for filter
            const sellers = await Seller.getAll();

            // Build date filter
            const currentYear = new Date().getFullYear();
            const dateStart = start_date || `${currentYear}-01-01`;
            const dateEnd = end_date || `${currentYear}-12-31`;

            // Build seller filter
            let sellerFilter = '';
            if (seller_id && seller_id !== 'all') {
                sellerFilter = `AND s.seller_id = ${parseInt(seller_id)}`;
            }

            // Get sales with profit and penalties
            const salesData = await query(`
                SELECT
                    s.id as sale_id,
                    s.sale_date,
                    sel.full_name as seller_name,
                    s.seller_id,
                    s.total_amount,
                    SUM(si.quantity * (si.unit_price - si.purchase_price_at_sale)) as sale_profit
                FROM sales s
                JOIN sellers sel ON s.seller_id = sel.id
                JOIN sale_items si ON s.id = si.sale_id
                WHERE s.sale_date BETWEEN ? AND ?
                ${sellerFilter}
                GROUP BY s.id, s.sale_date, sel.full_name, s.seller_id, s.total_amount
                ORDER BY s.sale_date DESC
            `, [dateStart, dateEnd]);

            // Get penalties for each sale
            const salesWithPenalties = [];
            for (const sale of salesData) {
                const penalties = await query(`
                    SELECT SUM(penalty_amount) as total_penalties
                    FROM seller_penalties
                    WHERE sale_id = ?
                `, [sale.sale_id]);

                salesWithPenalties.push({
                    ...sale,
                    total_penalties: parseFloat(penalties[0]?.total_penalties || 0)
                });
            }

            res.render('reports/detailed-sales', {
                title: 'Batafsil Hisobot (Savdolar bo\'yicha)',
                sellers,
                salesData: salesWithPenalties,
                filters: {
                    seller_id: seller_id || 'all',
                    start_date: dateStart,
                    end_date: dateEnd
                }
            });
        } catch (error) {
            console.error('Detailed sales report error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }
}

module.exports = ReportsController;
