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

    // Helper function to convert Cyrillic to Latin
    static cyrillicToLatin(text) {
        const cyrillicToLatinMap = {
            'А': 'A', 'а': 'a', 'Б': 'B', 'б': 'b', 'В': 'V', 'в': 'v',
            'Г': 'G', 'г': 'g', 'Д': 'D', 'д': 'd', 'Е': 'E', 'е': 'e',
            'Ё': 'Yo', 'ё': 'yo', 'Ж': 'J', 'ж': 'j', 'З': 'Z', 'з': 'z',
            'И': 'I', 'и': 'i', 'Й': 'Y', 'й': 'y', 'К': 'K', 'к': 'k',
            'Л': 'L', 'л': 'l', 'М': 'M', 'м': 'm', 'Н': 'N', 'н': 'n',
            'О': 'O', 'о': 'o', 'П': 'P', 'п': 'p', 'Р': 'R', 'р': 'r',
            'С': 'S', 'с': 's', 'Т': 'T', 'т': 't', 'У': 'U', 'у': 'u',
            'Ф': 'F', 'ф': 'f', 'Х': 'X', 'х': 'x', 'Ц': 'Ts', 'ц': 'ts',
            'Ч': 'Ch', 'ч': 'ch', 'Ш': 'Sh', 'ш': 'sh', 'Щ': 'Sh', 'щ': 'sh',
            'Ъ': '', 'ъ': '', 'Ы': 'I', 'ы': 'i', 'Ь': '', 'ь': '',
            'Э': 'E', 'э': 'e', 'Ю': 'Yu', 'ю': 'yu', 'Я': 'Ya', 'я': 'ya',
            'Ў': 'O', 'ў': 'o', 'Қ': 'Q', 'қ': 'q', 'Ғ': 'G', 'ғ': 'g',
            'Ҳ': 'H', 'ҳ': 'h'
        };

        return text.split('').map(char => {
            return cyrillicToLatinMap[char] || char;
        }).join('').replace(/[^a-zA-Z0-9]/g, '_');
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

            // Create a single detailed sheet for all sales
            const detailSheet = workbook.addWorksheet('Batafsil ma\'lumotlar');
            let currentRow = 1;

            // Process each sale
            for (const sale of sales) {
                // Sale header
                detailSheet.mergeCells(`A${currentRow}:F${currentRow}`);
                const headerCell = detailSheet.getCell(`A${currentRow}`);
                headerCell.value = `SAVDO #${sale.id} - BATAFSIL MA'LUMOT`;
                headerCell.font = { size: 14, bold: true };
                headerCell.alignment = { horizontal: 'center' };
                headerCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD0E7FF' }
                };
                currentRow++;

                currentRow++; // Empty row
                detailSheet.getRow(currentRow).values = ['Savdo ID:', `#${sale.id}`]; currentRow++;
                detailSheet.getRow(currentRow).values = ['Sana:', new Date(sale.sale_date).toLocaleDateString('ru-RU')]; currentRow++;
                detailSheet.getRow(currentRow).values = ['Xaridor:', sale.customer_name]; currentRow++;
                detailSheet.getRow(currentRow).values = ['Telefon:', sale.customer_phone]; currentRow++;
                detailSheet.getRow(currentRow).values = ['Jami summa:', `$${parseFloat(sale.total_amount).toFixed(2)}`]; currentRow++;
                detailSheet.getRow(currentRow).values = ['To\'langan:', `$${parseFloat(sale.paid_amount).toFixed(2)}`]; currentRow++;
                detailSheet.getRow(currentRow).values = ['Qarz:', `$${parseFloat(sale.remaining_amount).toFixed(2)}`]; currentRow++;
                currentRow++; // Empty row

                // 1. PRODUCTS SECTION
                detailSheet.mergeCells(`A${currentRow}:F${currentRow}`);
                const productsTitle = detailSheet.getCell(`A${currentRow}`);
                productsTitle.value = '📦 SOTILGAN MAHSULOTLAR';
                productsTitle.font = { bold: true, size: 12 };
                productsTitle.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD1FAE5' }
                };
                currentRow++;
                currentRow++; // Empty row

                // Get products
                const products = await query(`
                    SELECT si.*, p.name as product_name
                    FROM sale_items si
                    JOIN products p ON si.product_id = p.id
                    WHERE si.sale_id = ?
                `, [sale.id]);

                const productsHeaderRow = detailSheet.getRow(currentRow);
                productsHeaderRow.values = ['Mahsulot', 'Soni', 'Kirim narxi', 'Sotuv narxi', 'Foyda', 'Jami'];
                productsHeaderRow.font = { bold: true };
                productsHeaderRow.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                });
                currentRow++;

                products.forEach(item => {
                    const profit = (parseFloat(item.unit_price) - parseFloat(item.purchase_price_at_sale)) * parseFloat(item.quantity);
                    detailSheet.getRow(currentRow).values = [
                        item.product_name,
                        item.quantity,
                        `$${parseFloat(item.purchase_price_at_sale).toFixed(2)}`,
                        `$${parseFloat(item.unit_price).toFixed(2)}`,
                        `$${profit.toFixed(2)}`,
                        `$${(parseFloat(item.unit_price) * parseFloat(item.quantity)).toFixed(2)}`
                    ];
                    currentRow++;
                });
                currentRow++; // Empty row

                // 2. PAYMENTS SECTION
                detailSheet.mergeCells(`A${currentRow}:F${currentRow}`);
                const paymentsTitle = detailSheet.getCell(`A${currentRow}`);
                paymentsTitle.value = '💰 TO\'LOVLAR TARIXI';
                paymentsTitle.font = { bold: true, size: 12 };
                paymentsTitle.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFEF3C7' }
                };
                currentRow++;
                currentRow++; // Empty row

                // Get payments
                const payments = await query(`
                    SELECT *
                    FROM payments
                    WHERE sale_id = ?
                    ORDER BY payment_date ASC
                `, [sale.id]);

                if (payments.length > 0) {
                    const paymentsHeaderRow = detailSheet.getRow(currentRow);
                    paymentsHeaderRow.values = ['Sana', 'Summa', 'To\'lov turi', 'Izoh'];
                    paymentsHeaderRow.font = { bold: true };
                    paymentsHeaderRow.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                    });
                    currentRow++;

                    payments.forEach(payment => {
                        detailSheet.getRow(currentRow).values = [
                            new Date(payment.payment_date).toLocaleDateString('ru-RU'),
                            `$${parseFloat(payment.amount).toFixed(2)}`,
                            payment.payment_method || '-',
                            payment.notes || '-'
                        ];
                        currentRow++;
                    });
                } else {
                    detailSheet.getRow(currentRow).values = ['To\'lovlar mavjud emas'];
                    currentRow++;
                }
                currentRow++; // Empty row

                // 3. MARKUP HISTORY SECTION (if exists)
                if (sale.debt_id && sale.markup_type === 'fixed') {
                    detailSheet.mergeCells(`A${currentRow}:F${currentRow}`);
                    const markupTitle = detailSheet.getCell(`A${currentRow}`);
                    markupTitle.value = '📈 USTAMALAR TARIXI';
                    markupTitle.font = { bold: true, size: 12 };
                    markupTitle.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFDE2E4' }
                    };
                    currentRow++;
                    currentRow++; // Empty row

                    // Get markup history
                    const markupHistory = await query(`
                        SELECT *
                        FROM debt_fixed_markup_logs
                        WHERE debt_id = ?
                        ORDER BY applied_date ASC
                    `, [sale.debt_id]);

                    if (markupHistory.length > 0) {
                        const markupHeaderRow = detailSheet.getRow(currentRow);
                        markupHeaderRow.values = ['Sana', 'Ustama summasi', 'Qarz (oldin)', 'Qarz (keyin)', 'Izoh'];
                        markupHeaderRow.font = { bold: true };
                        markupHeaderRow.eachCell(cell => {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                        });
                        currentRow++;

                        markupHistory.forEach(markup => {
                            detailSheet.getRow(currentRow).values = [
                                new Date(markup.applied_date).toLocaleDateString('ru-RU'),
                                `$${parseFloat(markup.markup_value).toFixed(2)}`,
                                `$${parseFloat(markup.debt_before).toFixed(2)}`,
                                `$${parseFloat(markup.debt_after).toFixed(2)}`,
                                markup.notes || '-'
                            ];
                            currentRow++;
                        });
                    } else {
                        detailSheet.getRow(currentRow).values = ['Ustamalar mavjud emas'];
                        currentRow++;
                    }
                    currentRow++; // Empty row
                }

                // 4. PENALTIES SECTION
                detailSheet.mergeCells(`A${currentRow}:F${currentRow}`);
                const penaltiesTitle = detailSheet.getCell(`A${currentRow}`);
                penaltiesTitle.value = '⚠️ SHTRAFLAR TARIXI';
                penaltiesTitle.font = { bold: true, size: 12 };
                penaltiesTitle.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFECACA' }
                };
                currentRow++;
                currentRow++; // Empty row

                // Get penalties
                const penalties = await query(`
                    SELECT sp.*, d.current_amount as debt_amount
                    FROM seller_penalties sp
                    LEFT JOIN debts d ON sp.sale_id = d.sale_id
                    WHERE sp.sale_id = ?
                    ORDER BY sp.penalty_date ASC
                `, [sale.id]);

                if (penalties.length > 0) {
                    const penaltiesHeaderRow = detailSheet.getRow(currentRow);
                    penaltiesHeaderRow.values = ['Sana', 'Shtraf summasi', 'Qarz miqdori', 'Sabab'];
                    penaltiesHeaderRow.font = { bold: true };
                    penaltiesHeaderRow.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                    });
                    currentRow++;

                    penalties.forEach(penalty => {
                        detailSheet.getRow(currentRow).values = [
                            new Date(penalty.penalty_date).toLocaleDateString('ru-RU'),
                            `-$${parseFloat(penalty.penalty_amount).toFixed(2)}`,
                            `$${parseFloat(penalty.debt_amount || 0).toFixed(2)}`,
                            penalty.reason || '-'
                        ];
                        currentRow++;
                    });
                } else {
                    detailSheet.getRow(currentRow).values = ['Shtraflar mavjud emas'];
                    currentRow++;
                }
                currentRow++; // Empty row

                // Add visual separator between sales (3 empty rows with border)
                currentRow++; // Empty row
                currentRow++; // Empty row
                currentRow++; // Empty row
            }

            // Set column widths for detail sheet
            detailSheet.columns = [
                { width: 20 }, { width: 12 }, { width: 15 },
                { width: 15 }, { width: 15 }, { width: 20 }
            ];

            // Send file
            const fileName = `${SellerController.cyrillicToLatin(seller.full_name)}_${currentYear}_Yillik_Hisobot.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('Export annual sales error:', error);
            res.status(500).send('Error generating Excel file: ' + error.message);
        }
    }
}

module.exports = SellerController;
