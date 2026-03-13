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
                    d.markup_value,
                    d.current_amount,
                    CASE
                        WHEN d.current_amount IS NULL THEN 'yopilgan'
                        WHEN d.current_amount <= 0 THEN 'yopilgan'
                        ELSE 'yopilmagan'
                    END as debt_status
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

            // Build filters
            let sellerFilter = '';
            if (seller_id && seller_id !== 'all') {
                sellerFilter = `AND s.seller_id = ${parseInt(seller_id)}`;
            }
            
            let profitFilter = '';
            const { profit_given } = req.query;
            if (profit_given == '1') {
                profitFilter = 'AND s.profit_given = 1';
            } else if (profit_given == '0') {
                profitFilter = 'AND s.profit_given = 0';
            }

            // Get sales with profit and penalties
            const salesData = await query(`
                SELECT
                    s.id as sale_id,
                    s.sale_date,
                    sel.full_name as seller_name,
                    s.seller_id,
                    s.total_amount,
                    SUM(si.quantity * (si.unit_price - si.purchase_price_at_sale)) as sale_profit,
                    s.profit_given,
                    s.profit_given_at,
                    d.current_amount,
                    CASE
                        WHEN d.current_amount IS NULL THEN 'yopilgan'
                        WHEN d.current_amount <= 0 THEN 'yopilgan'
                        ELSE 'yopilmagan'
                    END as debt_status
                FROM sales s
                JOIN sellers sel ON s.seller_id = sel.id
                JOIN sale_items si ON s.id = si.sale_id
                LEFT JOIN debts d ON s.id = d.sale_id
                WHERE s.sale_date BETWEEN ? AND ?
                ${sellerFilter}
                ${profitFilter}
                GROUP BY s.id, s.sale_date, sel.full_name, s.seller_id, s.total_amount, s.profit_given, s.profit_given_at, d.current_amount
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
                    profit_given: profit_given || 'all',
                    start_date: dateStart,
                    end_date: dateEnd
                }
            });
        } catch (error) {
            console.error('Detailed sales report error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    // Export Products Report to Excel
    static async exportProductsReportToExcel(req, res) {
        try {
            const ExcelJS = require('exceljs');
            const { seller_id, start_date, end_date } = req.query;

            // Build date filter
            const currentYear = new Date().getFullYear();
            const dateStart = start_date || `${currentYear}-01-01`;
            const dateEnd = end_date || `${currentYear}-12-31`;

            // Build seller filter
            let sellerFilter = '';
            let sellerName = 'Barcha sotuvchilar';
            if (seller_id && seller_id !== 'all') {
                sellerFilter = `AND s.seller_id = ${parseInt(seller_id)}`;
                const sellers = await Seller.getAll();
                const seller = sellers.find(s => s.id == seller_id);
                sellerName = seller ? seller.full_name : 'Noma\'lum sotuvchi';
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
                    d.markup_value,
                    d.current_amount,
                    CASE
                        WHEN d.current_amount IS NULL THEN 'yopilgan'
                        WHEN d.current_amount <= 0 THEN 'yopilgan'
                        ELSE 'yopilmagan'
                    END as debt_status
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.id
                JOIN sellers sel ON s.seller_id = sel.id
                JOIN products p ON si.product_id = p.id
                LEFT JOIN debts d ON s.id = d.sale_id
                WHERE s.sale_date BETWEEN ? AND ?
                ${sellerFilter}
                ORDER BY s.sale_date DESC, s.id, p.name
            `, [dateStart, dateEnd]);

            // Calculate markup months
            const salesWithMarkup = [];
            for (const item of productSales) {
                let markupMonths = 0;
                let fixedMarkup = 0;

                if (item.markup_type === 'fixed' && item.markup_value) {
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

            // Create workbook
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Mahsulotlar hisoboti');

            // Title
            worksheet.mergeCells('A1:L1');
            worksheet.getCell('A1').value = 'MAHSULOTLAR BO\'YICHA BATAFSIL HISOBOT';
            worksheet.getCell('A1').font = { size: 16, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

            // Filter info
            worksheet.addRow([]);
            worksheet.addRow(['Sotuvchi:', sellerName]);
            worksheet.addRow(['Sana oralig\'i:', `${dateStart} - ${dateEnd}`]);
            worksheet.addRow([]);

            // Table header
            const headerRow = worksheet.addRow([
                'T/r', 'Savdo ID', 'Sotuvchi', 'Mahsulot', 'Kirim narxi',
                'Sotuv narxi', 'Soni', 'Foyda', 'Fixed ustama',
                'Ustama oylari', 'Jami foyda', 'Qarz holati'
            ]);
            headerRow.font = { bold: true };
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' }
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // Data rows
            let totalProfit = 0;
            let totalMarkup = 0;
            let totalFinal = 0;

            salesWithMarkup.forEach((item, index) => {
                totalProfit += parseFloat(item.product_profit || 0);
                totalMarkup += parseFloat(item.fixed_markup_total || 0);
                totalFinal += parseFloat(item.total_profit || 0);

                const row = worksheet.addRow([
                    index + 1,
                    item.sale_id,
                    item.seller_name,
                    item.product_name,
                    `$${parseFloat(item.purchase_price_at_sale || 0).toFixed(2)}`,
                    `$${parseFloat(item.sell_price || 0).toFixed(2)}`,
                    item.quantity,
                    `$${parseFloat(item.product_profit || 0).toFixed(2)}`,
                    `$${parseFloat(item.fixed_markup_total || 0).toFixed(2)}`,
                    `${item.markup_months} oy`,
                    `$${parseFloat(item.total_profit || 0).toFixed(2)}`,
                    item.debt_status === 'yopilgan' ? '✓ Yopilgan' : '✗ Yopilmagan'
                ]);

                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

            // Totals row
            const totalRow = worksheet.addRow([
                '', '', '', '', '', '', 'JAMI:',
                `$${totalProfit.toFixed(2)}`,
                `$${totalMarkup.toFixed(2)}`,
                '',
                `$${totalFinal.toFixed(2)}`,
                ''
            ]);
            totalRow.font = { bold: true, size: 12 };
            totalRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F9FF' }
            };

            // Set column widths
            worksheet.columns = [
                { width: 8 }, { width: 12 }, { width: 20 }, { width: 25 },
                { width: 15 }, { width: 15 }, { width: 10 }, { width: 15 },
                { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }
            ];

            // Send file
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Mahsulotlar_Hisoboti_${Date.now()}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('Export products report error:', error);
            res.status(500).send('Error generating Excel file');
        }
    }

    // Export Sales Report to Excel
    static async exportSalesReportToExcel(req, res) {
        try {
            const ExcelJS = require('exceljs');
            const { seller_id, start_date, end_date } = req.query;

            // Build date filter
            const currentYear = new Date().getFullYear();
            const dateStart = start_date || `${currentYear}-01-01`;
            const dateEnd = end_date || `${currentYear}-12-31`;

            // Build seller filter
            let sellerFilter = '';
            let sellerName = 'Barcha sotuvchilar';
            if (seller_id && seller_id !== 'all') {
                sellerFilter = `AND s.seller_id = ${parseInt(seller_id)}`;
                const sellers = await Seller.getAll();
                const seller = sellers.find(s => s.id == seller_id);
                sellerName = seller ? seller.full_name : 'Noma\'lum sotuvchi';
            }

            // Get sales with profit and penalties
            const salesData = await query(`
                SELECT
                    s.id as sale_id,
                    s.sale_date,
                    sel.full_name as seller_name,
                    s.seller_id,
                    s.total_amount,
                    SUM(si.quantity * (si.unit_price - si.purchase_price_at_sale)) as sale_profit,
                    d.current_amount,
                    CASE
                        WHEN d.current_amount IS NULL THEN 'yopilgan'
                        WHEN d.current_amount <= 0 THEN 'yopilgan'
                        ELSE 'yopilmagan'
                    END as debt_status
                FROM sales s
                JOIN sellers sel ON s.seller_id = sel.id
                JOIN sale_items si ON s.id = si.sale_id
                LEFT JOIN debts d ON s.id = d.sale_id
                WHERE s.sale_date BETWEEN ? AND ?
                ${sellerFilter}
                GROUP BY s.id, s.sale_date, sel.full_name, s.seller_id, s.total_amount, d.current_amount
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

            // Create workbook
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Savdolar hisoboti');

            // Title
            worksheet.mergeCells('A1:H1');
            worksheet.getCell('A1').value = 'SAVDOLAR BO\'YICHA BATAFSIL HISOBOT';
            worksheet.getCell('A1').font = { size: 16, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

            // Filter info
            worksheet.addRow([]);
            worksheet.addRow(['Sotuvchi:', sellerName]);
            worksheet.addRow(['Sana oralig\'i:', `${dateStart} - ${dateEnd}`]);
            worksheet.addRow([]);

            // Table header
            const headerRow = worksheet.addRow([
                'T/r', 'Savdo ID', 'Sana', 'Sotuvchi',
                'Savdo foydasi', 'Shtraflar', 'Sof foyda', 'Qarz holati'
            ]);
            headerRow.font = { bold: true };
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' }
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // Data rows
            let totalProfit = 0;
            let totalPenalties = 0;
            let totalNet = 0;

            salesWithPenalties.forEach((sale, index) => {
                const saleProfit = parseFloat(sale.sale_profit || 0);
                const penalties = parseFloat(sale.total_penalties || 0);
                const netProfit = saleProfit - penalties;

                totalProfit += saleProfit;
                totalPenalties += penalties;
                totalNet += netProfit;

                const row = worksheet.addRow([
                    index + 1,
                    sale.sale_id,
                    new Date(sale.sale_date).toLocaleDateString('ru-RU'),
                    sale.seller_name,
                    `$${saleProfit.toFixed(2)}`,
                    `-$${penalties.toFixed(2)}`,
                    `$${netProfit.toFixed(2)}`,
                    sale.debt_status === 'yopilgan' ? '✓ Yopilgan' : '✗ Yopilmagan'
                ]);

                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

            // Totals row
            const totalRow = worksheet.addRow([
                '', '', '', 'JAMI:',
                `$${totalProfit.toFixed(2)}`,
                `-$${totalPenalties.toFixed(2)}`,
                `$${totalNet.toFixed(2)}`,
                ''
            ]);
            totalRow.font = { bold: true, size: 12 };
            totalRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F9FF' }
            };

            // Set column widths
            worksheet.columns = [
                { width: 8 }, { width: 12 }, { width: 15 }, { width: 20 },
                { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }
            ];

            // Send file
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Savdolar_Hisoboti_${Date.now()}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('Export sales report error:', error);
            res.status(500).send('Error generating Excel file');
        }
    }
}

module.exports = ReportsController;
