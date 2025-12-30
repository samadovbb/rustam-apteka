const Seller = require('../models/Seller');

class SellerController {
    static async index(req, res) {
        try {
            const sellers = await Seller.getAll();
            res.render('sellers/index', {
                title: 'Sellers - MegaDent POS',
                sellers
            });
        } catch (error) {
            console.error('Sellers index error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async create(req, res) {
        res.render('sellers/create', {
            title: 'Add New Seller',
            error: null
        });
    }

    static async store(req, res) {
        try {
            const { full_name, phone, commission_percent } = req.body;
            await Seller.create({ full_name, phone, commission_percent }, req.user);
            res.redirect('/sellers');
        } catch (error) {
            console.error('Seller create error:', error);
            res.render('sellers/create', {
                title: 'Add New Seller',
                error: error.message
            });
        }
    }

    static async edit(req, res) {
        try {
            const seller = await Seller.findById(req.params.id);
            if (!seller) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Seller not found',
                    error: {}
                });
            }

            res.render('sellers/edit', {
                title: 'Edit Seller',
                seller,
                error: null
            });
        } catch (error) {
            console.error('Seller edit error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async update(req, res) {
        try {
            const { full_name, phone, commission_percent } = req.body;
            await Seller.update(req.params.id, { full_name, phone, commission_percent }, req.user);
            res.redirect('/sellers');
        } catch (error) {
            console.error('Seller update error:', error);
            const seller = await Seller.findById(req.params.id);
            res.render('sellers/edit', {
                title: 'Edit Seller',
                seller,
                error: error.message
            });
        }
    }

    static async delete(req, res) {
        try {
            await Seller.delete(req.params.id, req.user);
            res.redirect('/sellers');
        } catch (error) {
            console.error('Seller delete error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async inventory(req, res) {
        try {
            const seller = await Seller.findById(req.params.id);
            const inventory = await Seller.getInventory(req.params.id);

            res.render('sellers/inventory', {
                title: `${seller.full_name} - Inventory`,
                seller,
                inventory
            });
        } catch (error) {
            console.error('Seller inventory error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    // API: Search sellers
    static async search(req, res) {
        try {
            const { q } = req.query;
            // If no query, return all sellers
            if (!q || q.trim() === '') {
                const sellers = await Seller.getAll();
                return res.json(sellers);
            }

            const sellers = await Seller.search(q);
            res.json(sellers);
        } catch (error) {
            console.error('Seller search error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    static async view(req, res) {
        try {
            const seller = await Seller.findById(req.params.id);
            if (!seller) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Seller not found',
                    error: {}
                });
            }

            const debtors = await Seller.getDebtors(req.params.id);
            const sales = await Seller.getSalesHistory(req.params.id);
            const transfers = await Seller.getTransfers(req.params.id);
            const stats = await Seller.getSalesStats(req.params.id);
            const profitStats = await Seller.getProfitStats(req.params.id);
            const penaltyStats = await Seller.getPenaltyStats(req.params.id);
            const penalties = await Seller.getPenalties(req.params.id);

            res.render('sellers/view', {
                title: `${seller.full_name} - Details`,
                seller,
                debtors,
                sales,
                transfers,
                stats,
                profitStats,
                penaltyStats,
                penalties
            });
        } catch (error) {
            console.error('Seller view error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async calculatePenalties(req, res) {
        try {
            const { execSync } = require('child_process');
            const path = require('path');

            const scriptPath = path.join(__dirname, '../../scripts/calculate-seller-penalties.js');
            const output = execSync(`node "${scriptPath}"`, {
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });

            res.json({
                success: true,
                message: 'Shtraflar muvaffaqiyatli hisoblandi',
                output: output
            });
        } catch (error) {
            console.error('Calculate penalties error:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                output: error.stdout || error.stderr || ''
            });
        }
    }

    // API: Get all sellers
    static async getAllApi(req, res) {
        try {
            const sellers = await Seller.getAll();
            res.json(sellers);
        } catch (error) {
            console.error('Get all sellers API error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Export Annual Sales to Excel
    static async exportAnnualSales(req, res) {
        try {
            const ExcelJS = require('exceljs');
            const { query } = require('../config/database');
            const sellerId = req.params.id;

            // Get seller info
            const seller = await Seller.findById(sellerId);
            if (!seller) {
                return res.status(404).send('Seller not found');
            }

            // Get current year
            const currentYear = new Date().getFullYear();
            const startDate = `${currentYear}-01-01`;
            const endDate = `${currentYear}-12-31`;

            // Get all sales for this seller in current year
            const sales = await query(`
                SELECT s.*,
                       c.full_name as customer_name,
                       c.phone as customer_phone,
                       COALESCE(d.current_amount, 0) as remaining_amount,
                       d.id as debt_id,
                       d.markup_type,
                       d.markup_value
                FROM sales s
                JOIN customers c ON s.customer_id = c.id
                LEFT JOIN debts d ON s.id = d.sale_id
                WHERE s.seller_id = ? AND s.sale_date BETWEEN ? AND ?
                ORDER BY s.sale_date DESC
            `, [sellerId, startDate, endDate]);

            // Create workbook
            const workbook = new ExcelJS.Workbook();

            // Add summary sheet
            const summarySheet = workbook.addWorksheet('Umumiy ma\'lumot');

            // Title
            summarySheet.mergeCells('A1:F1');
            summarySheet.getCell('A1').value = `${seller.full_name.toUpperCase()} - ${currentYear} YIL YILLIK HISOBOT`;
            summarySheet.getCell('A1').font = { size: 16, bold: true };
            summarySheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

            summarySheet.addRow([]);
            summarySheet.addRow(['Sotuvchi:', seller.full_name]);
            summarySheet.addRow(['Telefon:', seller.phone || '-']);
            summarySheet.addRow(['Komissiya:', `${parseFloat(seller.commission_percent).toFixed(1)}%`]);
            summarySheet.addRow(['Yil:', currentYear]);
            summarySheet.addRow(['Savdolar soni:', sales.length]);
            summarySheet.addRow([]);

            // Summary table header
            const summaryHeaderRow = summarySheet.addRow([
                'Savdo ID', 'Sana', 'Xaridor', 'Jami summa', 'To\'langan', 'Qolgan qarz'
            ]);
            summaryHeaderRow.font = { bold: true };
            summaryHeaderRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' }
                };
            });

            // Add sales summary
            let totalAmount = 0;
            let totalPaid = 0;
            let totalRemaining = 0;

            sales.forEach(sale => {
                totalAmount += parseFloat(sale.total_amount || 0);
                totalPaid += parseFloat(sale.paid_amount || 0);
                totalRemaining += parseFloat(sale.remaining_amount || 0);

                summarySheet.addRow([
                    `#${sale.id}`,
                    new Date(sale.sale_date).toLocaleDateString('ru-RU'),
                    sale.customer_name,
                    `$${parseFloat(sale.total_amount).toFixed(2)}`,
                    `$${parseFloat(sale.paid_amount).toFixed(2)}`,
                    `$${parseFloat(sale.remaining_amount).toFixed(2)}`
                ]);
            });

            // Totals
            const summaryTotalRow = summarySheet.addRow([
                '', '', 'JAMI:',
                `$${totalAmount.toFixed(2)}`,
                `$${totalPaid.toFixed(2)}`,
                `$${totalRemaining.toFixed(2)}`
            ]);
            summaryTotalRow.font = { bold: true };
            summaryTotalRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F9FF' }
            };

            summarySheet.columns = [
                { width: 12 }, { width: 15 }, { width: 25 },
                { width: 15 }, { width: 15 }, { width: 15 }
            ];

            // Now create detailed sheets for each sale
            for (const sale of sales) {
                const sheetName = `Savdo #${sale.id}`.substring(0, 31); // Excel sheet name max 31 chars
                const saleSheet = workbook.addWorksheet(sheetName);

                // Sale header
                saleSheet.mergeCells('A1:F1');
                saleSheet.getCell('A1').value = `SAVDO #${sale.id} - BATAFSIL MA'LUMOT`;
                saleSheet.getCell('A1').font = { size: 14, bold: true };
                saleSheet.getCell('A1').alignment = { horizontal: 'center' };

                saleSheet.addRow([]);
                saleSheet.addRow(['Savdo ID:', `#${sale.id}`]);
                saleSheet.addRow(['Sana:', new Date(sale.sale_date).toLocaleDateString('ru-RU')]);
                saleSheet.addRow(['Xaridor:', sale.customer_name]);
                saleSheet.addRow(['Telefon:', sale.customer_phone]);
                saleSheet.addRow(['Jami summa:', `$${parseFloat(sale.total_amount).toFixed(2)}`]);
                saleSheet.addRow(['To\'langan:', `$${parseFloat(sale.paid_amount).toFixed(2)}`]);
                saleSheet.addRow(['Qarz:', `$${parseFloat(sale.remaining_amount).toFixed(2)}`]);
                saleSheet.addRow([]);

                // 1. PRODUCTS SECTION
                saleSheet.mergeCells('A' + (saleSheet.rowCount + 1) + ':F' + (saleSheet.rowCount + 1));
                const productsTitle = saleSheet.getRow(saleSheet.rowCount + 1);
                productsTitle.getCell(1).value = '📦 SOTILGAN MAHSULOTLAR';
                productsTitle.getCell(1).font = { bold: true, size: 12 };
                productsTitle.getCell(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD1FAE5' }
                };
                saleSheet.addRow([]);

                // Get products
                const products = await query(`
                    SELECT si.*, p.name as product_name
                    FROM sale_items si
                    JOIN products p ON si.product_id = p.id
                    WHERE si.sale_id = ?
                `, [sale.id]);

                const productsHeader = saleSheet.addRow([
                    'Mahsulot', 'Soni', 'Kirim narxi', 'Sotuv narxi', 'Foyda', 'Jami'
                ]);
                productsHeader.font = { bold: true };
                productsHeader.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                });

                products.forEach(item => {
                    const profit = (parseFloat(item.unit_price) - parseFloat(item.purchase_price_at_sale)) * parseFloat(item.quantity);
                    saleSheet.addRow([
                        item.product_name,
                        item.quantity,
                        `$${parseFloat(item.purchase_price_at_sale).toFixed(2)}`,
                        `$${parseFloat(item.unit_price).toFixed(2)}`,
                        `$${profit.toFixed(2)}`,
                        `$${(parseFloat(item.unit_price) * parseFloat(item.quantity)).toFixed(2)}`
                    ]);
                });
                saleSheet.addRow([]);

                // 2. PAYMENTS SECTION
                saleSheet.mergeCells('A' + (saleSheet.rowCount + 1) + ':F' + (saleSheet.rowCount + 1));
                const paymentsTitle = saleSheet.getRow(saleSheet.rowCount + 1);
                paymentsTitle.getCell(1).value = '💰 TO\'LOVLAR TARIXI';
                paymentsTitle.getCell(1).font = { bold: true, size: 12 };
                paymentsTitle.getCell(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFEF3C7' }
                };
                saleSheet.addRow([]);

                // Get payments
                const payments = await query(`
                    SELECT *
                    FROM payments
                    WHERE sale_id = ?
                    ORDER BY payment_date ASC
                `, [sale.id]);

                if (payments.length > 0) {
                    const paymentsHeader = saleSheet.addRow([
                        'Sana', 'Summa', 'To\'lov turi', 'Izoh'
                    ]);
                    paymentsHeader.font = { bold: true };
                    paymentsHeader.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                    });

                    payments.forEach(payment => {
                        saleSheet.addRow([
                            new Date(payment.payment_date).toLocaleDateString('ru-RU'),
                            `$${parseFloat(payment.amount).toFixed(2)}`,
                            payment.payment_method || '-',
                            payment.notes || '-'
                        ]);
                    });
                } else {
                    saleSheet.addRow(['To\'lovlar mavjud emas']);
                }
                saleSheet.addRow([]);

                // 3. MARKUP HISTORY SECTION (if exists)
                if (sale.debt_id && sale.markup_type === 'fixed') {
                    saleSheet.mergeCells('A' + (saleSheet.rowCount + 1) + ':F' + (saleSheet.rowCount + 1));
                    const markupTitle = saleSheet.getRow(saleSheet.rowCount + 1);
                    markupTitle.getCell(1).value = '📈 USTAMALAR TARIXI';
                    markupTitle.getCell(1).font = { bold: true, size: 12 };
                    markupTitle.getCell(1).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFDE2E4' }
                    };
                    saleSheet.addRow([]);

                    // Get markup history
                    const markupHistory = await query(`
                        SELECT *
                        FROM debt_fixed_markup_logs
                        WHERE debt_id = ?
                        ORDER BY applied_date ASC
                    `, [sale.debt_id]);

                    if (markupHistory.length > 0) {
                        const markupHeader = saleSheet.addRow([
                            'Sana', 'Ustama summasi', 'Qarz (oldin)', 'Qarz (keyin)', 'Izoh'
                        ]);
                        markupHeader.font = { bold: true };
                        markupHeader.eachCell(cell => {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                        });

                        markupHistory.forEach(markup => {
                            saleSheet.addRow([
                                new Date(markup.applied_date).toLocaleDateString('ru-RU'),
                                `$${parseFloat(markup.markup_value).toFixed(2)}`,
                                `$${parseFloat(markup.debt_before).toFixed(2)}`,
                                `$${parseFloat(markup.debt_after).toFixed(2)}`,
                                markup.notes || '-'
                            ]);
                        });
                    } else {
                        saleSheet.addRow(['Ustamalar mavjud emas']);
                    }
                    saleSheet.addRow([]);
                }

                // 4. PENALTIES SECTION
                saleSheet.mergeCells('A' + (saleSheet.rowCount + 1) + ':F' + (saleSheet.rowCount + 1));
                const penaltiesTitle = saleSheet.getRow(saleSheet.rowCount + 1);
                penaltiesTitle.getCell(1).value = '⚠️ SHTRAFLAR TARIXI';
                penaltiesTitle.getCell(1).font = { bold: true, size: 12 };
                penaltiesTitle.getCell(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFECACA' }
                };
                saleSheet.addRow([]);

                // Get penalties
                const penalties = await query(`
                    SELECT sp.*, d.current_amount as debt_amount
                    FROM seller_penalties sp
                    LEFT JOIN debts d ON sp.sale_id = d.sale_id
                    WHERE sp.sale_id = ?
                    ORDER BY sp.penalty_date ASC
                `, [sale.id]);

                if (penalties.length > 0) {
                    const penaltiesHeader = saleSheet.addRow([
                        'Sana', 'Shtraf summasi', 'Qarz miqdori', 'Sabab'
                    ]);
                    penaltiesHeader.font = { bold: true };
                    penaltiesHeader.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                    });

                    penalties.forEach(penalty => {
                        saleSheet.addRow([
                            new Date(penalty.penalty_date).toLocaleDateString('ru-RU'),
                            `-$${parseFloat(penalty.penalty_amount).toFixed(2)}`,
                            `$${parseFloat(penalty.debt_amount || 0).toFixed(2)}`,
                            penalty.reason || '-'
                        ]);
                    });
                } else {
                    saleSheet.addRow(['Shtraflar mavjud emas']);
                }

                // Set column widths
                saleSheet.columns = [
                    { width: 20 }, { width: 12 }, { width: 15 },
                    { width: 15 }, { width: 15 }, { width: 20 }
                ];
            }

            // Send file
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${seller.full_name}_${currentYear}_Yillik_Hisobot.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('Export annual sales error:', error);
            res.status(500).send('Error generating Excel file: ' + error.message);
        }
    }
}

module.exports = SellerController;
