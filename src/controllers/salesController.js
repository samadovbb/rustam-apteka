const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const Seller = require('../models/Seller');

class SalesController {
    static async index(req, res) {
        try {
            const sales = await Sale.getAll();
            res.render('sales/index', {
                title: 'Sales - MegaDent POS',
                sales
            });
        } catch (error) {
            console.error('Sales index error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async create(req, res) {
        try {
            const sellers = await Seller.getAll();

            res.render('sales/create', {
                title: 'New Sale',
                sellers,
                error: null
            });
        } catch (error) {
            console.error('Sale create error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async store(req, res) {
        try {
            const {
                customer_phone,
                customer_name,
                customer_address,
                seller_id,
                items,
                initial_payment,
                payment_method,
                debt_markup_type,
                debt_markup_value,
                debt_grace_months,
                sale_date
            } = req.body;

            // Find or create customer
            let customer = await Customer.findByPhone(customer_phone);
            if (!customer) {
                const customerId = await Customer.create({
                    full_name: customer_name,
                    phone: customer_phone,
                    address: customer_address
                }, req.user);
                customer = await Customer.findById(customerId);
            }

            // Parse items
            const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

            if (!parsedItems || parsedItems.length === 0) {
                throw new Error('At least one product is required');
            }

            // Prepare debt configuration if applicable
            let debtConfig = null;
            if (debt_markup_type && debt_markup_value) {
                debtConfig = {
                    markup_type: debt_markup_type,
                    markup_value: parseFloat(debt_markup_value),
                    grace_period_months: parseInt(debt_grace_months) || 0
                };
            }

            const saleId = await Sale.create(
                customer.id,
                seller_id,
                parsedItems,
                parseFloat(initial_payment) || 0,
                payment_method || 'naqt',
                debtConfig,
                sale_date || null,
                req.user
            );

            res.redirect(`/sales/${saleId}`);
        } catch (error) {
            console.error('Sale store error:', error);
            const sellers = await Seller.getAll();

            res.render('sales/create', {
                title: 'New Sale',
                sellers,
                error: error.message
            });
        }
    }

    static async view(req, res) {
        try {
            const sale = await Sale.findById(req.params.id);
            const items = await Sale.getItems(req.params.id);
            const payments = await Sale.getPayments(req.params.id);
            const profit = await Sale.calculateProfit(req.params.id);

            if (!sale) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Sale not found',
                    error: {}
                });
            }

            // Get initial payment (first payment by date)
            const initialPayment = payments.length > 0
                ? payments.reduce((earliest, payment) => {
                    return new Date(payment.payment_date) < new Date(earliest.payment_date) ? payment : earliest;
                  })
                : null;

            // Fetch debt information if exists
            const Debt = require('../models/Debt');
            let debt = null;
            let debtCalculation = null;
            let debtPaymentHistory = [];
            let markupLogs = [];

            if (sale.debt_id) {
                debt = await Debt.findById(sale.debt_id);
                if (debt) {
                    // Calculate current debt with markup
                    debtCalculation = Debt.calculateDebtWithMarkup(debt);

                    // Get debt payment history
                    debtPaymentHistory = await Debt.getPaymentHistory(sale.debt_id);

                    // Get markup logs
                    if (debt.markup_type === 'fixed') {
                        markupLogs = await Debt.getFixedMarkupLogs(sale.debt_id);
                    } else {
                        markupLogs = await Debt.getPercentMarkupLogs(sale.debt_id);
                    }
                }
            }

            // Fetch seller penalties for this sale
            const sellerPenalties = await Seller.getPenaltiesBySale(req.params.id);

            res.render('sales/view', {
                title: `Sale #${sale.id}`,
                sale,
                items,
                payments,
                profit,
                debt,
                debtCalculation,
                debtPaymentHistory,
                markupLogs,
                initialPayment,
                sellerPenalties
            });
        } catch (error) {
            console.error('Sale view error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async addPayment(req, res) {
        try {
            const { amount, payment_method, payment_date } = req.body;
            await Sale.addPayment(
                req.params.id,
                parseFloat(amount),
                payment_method || 'naqt',
                payment_date || null,
                req.user
            );

            res.redirect(`/sales/${req.params.id}`);
        } catch (error) {
            console.error('Add payment error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Calculate markup for this sale's debt
    static async calculateMarkup(req, res) {
        try {
            const Debt = require('../models/Debt');

            // Get sale to find debt_id
            const sale = await Sale.findById(req.params.id);
            if (!sale) {
                return res.status(404).json({ success: false, error: 'Savdo topilmadi' });
            }

            if (!sale.debt_id) {
                return res.status(400).json({ success: false, error: 'Bu savdo uchun qarz mavjud emas' });
            }

            // Check if markup type is fixed
            if (sale.markup_type !== 'fixed') {
                return res.json({
                    success: false,
                    error: 'Ustama faqat fixed turi uchun hisoblanadi. Bu qarzda percent ustama mavjud.'
                });
            }

            // Apply markup
            const result = await Debt.applyMarkup(sale.debt_id);

            if (!result) {
                return res.json({
                    success: false,
                    error: 'Ustama hisoblash mumkin emas. Qarz to\'langan yoki grace period hali tugamagan bo\'lishi mumkin.'
                });
            }

            res.json({
                success: true,
                message: `Ustama muvaffaqiyatli hisoblandi: +$${result.markupValue.toFixed(2)}`,
                result
            });
        } catch (error) {
            console.error('Calculate markup error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // API: Get seller inventory
    static async getSellerInventory(req, res) {
        try {
            const inventory = await Seller.getInventory(req.params.seller_id);
            res.json(inventory);
        } catch (error) {
            console.error('Get seller inventory error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // API: Get latest sale date
    // static async getLatestDate(req, res) {
    //     try {
    //         const result = await Sale.getLatestDate();
    //         const date = result ? new Date(result).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    //         res.json({ date });
    //     } catch (error) {
    //         console.error('Get latest sale date error:', error);
    //         res.json({ date: new Date().toISOString().split('T')[0] });
    //     }
    // }
    // API: Get latest sale date
    static async getLatestDate(req, res) {
        try {
            const result = await Sale.getLatestDate();
            let date;
            if (result) {
                const dateObj = new Date(result);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                date = `${year}-${month}-${day}`;
            } else {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                date = `${year}-${month}-${day}`;
            }
            res.json({ date });
        } catch (error) {
            console.error('Get latest sale date error:', error);
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            res.json({ date: `${year}-${month}-${day}` });
        }
    }
    // Update sale date
    static async updateSaleDate(req, res) {
        try {
            const { sale_date } = req.body;
            if (!sale_date) {
                return res.status(400).json({ success: false, error: 'Sana kiritilishi kerak' });
            }

            await Sale.updateSaleDate(req.params.id, sale_date, req.user);
            res.json({ success: true, message: 'Savdo sanasi muvaffaqiyatli yangilandi' });
        } catch (error) {
            console.error('Update sale date error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Update payment date
    static async updatePaymentDate(req, res) {
        try {
            const { payment_date } = req.body;
            if (!payment_date) {
                return res.status(400).json({ success: false, error: 'Sana kiritilishi kerak' });
            }

            await Sale.updatePaymentDate(req.params.payment_id, payment_date, req.user);
            res.json({ success: true, message: 'To\'lov sanasi muvaffaqiyatli yangilandi' });
        } catch (error) {
            console.error('Update payment date error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Delete a sale
    static async delete(req, res) {
        try {
            await Sale.delete(req.params.id, req.user);
            res.json({ success: true, message: 'Savdo muvaffaqiyatli o\'chirildi' });
        } catch (error) {
            console.error('Delete sale error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Change seller
    static async changeSeller(req, res) {
        try {
            const { seller_id } = req.body;
            if (!seller_id) {
                return res.status(400).json({ success: false, error: 'Sotuvchi tanlanishi kerak' });
            }

            await Sale.changeSeller(req.params.id, seller_id, req.user);
            res.json({ success: true, message: 'Sotuvchi muvaffaqiyatli o\'zgartirildi' });
        } catch (error) {
            console.error('Change seller error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Return items
    static async returnItems(req, res) {
        try {
            const { items, reason } = req.body;

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ success: false, error: 'Qaytariladigan mahsulotlar tanlanishi kerak' });
            }

            const result = await Sale.returnItems(
                req.params.id,
                items,
                reason || null,
                req.user
            );

            res.json({
                success: true,
                message: 'Mahsulotlar muvaffaqiyatli qaytarildi',
                result
            });
        } catch (error) {
            console.error('Return items error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Get return history
    static async getReturns(req, res) {
        try {
            const returns = await Sale.getReturns(req.params.id);
            res.json({ success: true, returns });
        } catch (error) {
            console.error('Get returns error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Export sale to Excel
    static async exportToExcel(req, res) {
        try {
            const ExcelJS = require('exceljs');
            const Sale = require('../models/Sale');
            const Debt = require('../models/Debt');
            const Seller = require('../models/Seller');

            // Payment method translation helper
            const translatePaymentMethod = (method) => {
                if (!method) return method;
                const translations = {
                    'naqt': 'naqt',
                    'card': 'karta',
                    'transfer': 'o\'tkazma',
                    'other': 'boshqa'
                };
                return translations[method.toLowerCase()] || method;
            };

            const sale = await Sale.findById(req.params.id);
            const items = await Sale.getItems(req.params.id);
            const payments = await Sale.getPayments(req.params.id);

            if (!sale) {
                return res.status(404).send('Sale not found');
            }

            // Fetch debt information if exists
            let debt = null;
            let debtCalculation = null;
            let debtPaymentHistory = [];
            let markupLogs = [];

            if (sale.debt_id) {
                debt = await Debt.findById(sale.debt_id);
                if (debt) {
                    debtCalculation = Debt.calculateDebtWithMarkup(debt);

                    // Get debt payment history
                    debtPaymentHistory = await Debt.getPaymentHistory(sale.debt_id);

                    // Get markup logs
                    if (debt.markup_type === 'fixed') {
                        markupLogs = await Debt.getFixedMarkupLogs(sale.debt_id);
                    } else {
                        markupLogs = await Debt.getPercentMarkupLogs(sale.debt_id);
                    }
                }
            }

            // Fetch seller penalties for this sale
            const sellerPenalties = await Seller.getPenaltiesBySale(req.params.id);

            // Create workbook
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Hisob');

            // Set column widths
            worksheet.columns = [
                { width: 5 },
                { width: 30 },
                { width: 12 },
                { width: 15 },
                { width: 15 },
                { width: 15 },
                { width: 15 }
            ];

            // Title
            worksheet.mergeCells('A1:G1');
            worksheet.getCell('A1').value = 'HISOB-FAKTURA';
            worksheet.getCell('A1').font = { size: 18, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

            // Sale info
            worksheet.addRow([]);
            worksheet.addRow(['', 'Hisob raqami:', `#${sale.id}`]);
            worksheet.addRow(['', 'Sana:', new Date(sale.sale_date).toLocaleDateString('ru-RU')]);
            worksheet.addRow(['', 'Mijoz:', sale.customer_name]);
            worksheet.addRow(['', 'Telefon:', sale.customer_phone]);
            worksheet.addRow(['', 'Sotuvchi:', sale.seller_name]);
            worksheet.addRow([]);

            // Items table header
            const headerRow = worksheet.addRow(['', 'Mahsulot', 'Miqdor', 'Kirim narxi', 'Sotuv narxi', 'Jami', 'Foyda']);
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

            // Items
            let totalProfit = 0;
            items.forEach(item => {
                const purchasePrice = parseFloat(item.purchase_price_at_sale || 0);
                const unitPrice = parseFloat(item.unit_price);
                const quantity = parseFloat(item.quantity);
                const subtotal = parseFloat(item.subtotal);
                const itemProfit = (unitPrice - purchasePrice) * quantity;
                totalProfit += itemProfit;

                const row = worksheet.addRow([
                    '',
                    item.product_name,
                    quantity,
                    `$${purchasePrice.toFixed(2)}`,
                    `$${unitPrice.toFixed(2)}`,
                    `$${subtotal.toFixed(2)}`,
                    `$${itemProfit.toFixed(2)}`
                ]);
                row.eachCell((cell, colNumber) => {
                    if (colNumber > 1) {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    }
                });
            });

            // Total
            worksheet.addRow([]);
            const totalRow = worksheet.addRow(['', '', '', '', '', 'Jami:', `$${parseFloat(sale.total_amount).toFixed(2)}`]);
            totalRow.font = { bold: true, size: 12 };
            totalRow.getCell(7).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' }
            };

            // Profit row
            const profitRow = worksheet.addRow(['', '', '', '', '', 'Foyda:', `$${totalProfit.toFixed(2)}`]);
            profitRow.font = { bold: true, size: 12, color: { argb: 'FF00AA00' } };
            profitRow.getCell(7).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD4EDDA' }
            };

            // Payment info
            worksheet.addRow([]);
            worksheet.addRow(['', 'To\'langan:', `$${parseFloat(sale.paid_amount).toFixed(2)}`]);
            const remainingRow = worksheet.addRow(['', 'Qoldiq:', `$${parseFloat(sale.remaining_amount).toFixed(2)}`]);
            if (sale.remaining_amount > 0) {
                remainingRow.getCell(3).font = { color: { argb: 'FFFF0000' }, bold: true };
            }

            // Debt info
            if (debt && debtCalculation) {
                worksheet.addRow([]);
                worksheet.addRow(['', 'QARZ MA\'LUMOTLARI']).font = { bold: true, size: 12 };
                worksheet.addRow(['', 'Asl qarz:', `$${parseFloat(debt.original_amount).toFixed(2)}`]);
                worksheet.addRow(['', 'Joriy qarz:', `$${parseFloat(debtCalculation.baseAmount).toFixed(2)}`]);
            }

            // Combined Payment and Markup History
            if (payments.length > 0 || markupLogs.length > 0) {
                worksheet.addRow([]);
                worksheet.addRow(['', 'TO\'LOV VA USTAMA TARIXI']).font = { bold: true, size: 12 };

                // Combine payments and markup logs
                let combinedHistory = [];

                // Add payments
                payments.forEach(payment => {
                    combinedHistory.push({
                        type: 'payment',
                        date: new Date(payment.payment_date),
                        payment: payment
                    });
                });

                // Add markup logs
                if (markupLogs && markupLogs.length > 0) {
                    markupLogs.forEach(markup => {
                        combinedHistory.push({
                            type: 'markup',
                            date: new Date(markup.calculation_date),
                            markup: markup
                        });
                    });
                }

                // Sort by date
                combinedHistory.sort((a, b) => a.date - b.date);

                // Header row
                const historyHeaderRow = worksheet.addRow(['', 'Sana', 'Summa', 'Turi', 'Qoldiq']);
                historyHeaderRow.font = { bold: true };
                historyHeaderRow.eachCell((cell, colNumber) => {
                    if (colNumber > 1) {
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
                    }
                });

                // Initial balance row
                let runningBalance = parseFloat(sale.total_amount);
                const initialRow = worksheet.addRow([
                    '',
                    new Date(sale.sale_date).toLocaleDateString('ru-RU'),
                    'Umumiy summa',
                    '-',
                    `$${runningBalance.toFixed(2)}`
                ]);
                initialRow.font = { bold: true };
                initialRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF8F9FA' }
                };
                initialRow.eachCell((cell, colNumber) => {
                    if (colNumber > 1) {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    }
                });

                // Add combined history entries
                combinedHistory.forEach(item => {
                    if (item.type === 'payment') {
                        runningBalance -= parseFloat(item.payment.amount);
                        const row = worksheet.addRow([
                            '',
                            item.date.toLocaleDateString('ru-RU'),
                            `-$${parseFloat(item.payment.amount).toFixed(2)}`,
                            translatePaymentMethod(item.payment.payment_method),
                            `$${runningBalance.toFixed(2)}`
                        ]);
                        row.getCell(3).font = { color: { argb: 'FF00AA00' }, bold: true };
                        row.eachCell((cell, colNumber) => {
                            if (colNumber > 1) {
                                cell.border = {
                                    top: { style: 'thin' },
                                    left: { style: 'thin' },
                                    bottom: { style: 'thin' },
                                    right: { style: 'thin' }
                                };
                            }
                        });
                    } else if (item.type === 'markup') {
                        const markupValue = parseFloat(item.markup.markup_value || 0);
                        runningBalance += markupValue;

                        const markupDisplay = debt && debt.markup_type === 'fixed'
                            ? `+$${markupValue.toFixed(2)}`
                            : `${parseFloat(item.markup.markup_percent || 0).toFixed(2)}% = +$${markupValue.toFixed(2)}`;

                        const row = worksheet.addRow([
                            '',
                            item.date.toLocaleDateString('ru-RU'),
                            markupDisplay,
                            'Ustama',
                            `$${runningBalance.toFixed(2)}`
                        ]);
                        row.getCell(3).font = { color: { argb: 'FFFF9900' }, bold: true };
                        row.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFF8E1' }
                        };
                        row.eachCell((cell, colNumber) => {
                            if (colNumber > 1) {
                                cell.border = {
                                    top: { style: 'thin' },
                                    left: { style: 'thin' },
                                    bottom: { style: 'thin' },
                                    right: { style: 'thin' }
                                };
                            }
                        });
                    }
                });

                // Final balance row
                const finalRow = worksheet.addRow([
                    '',
                    '',
                    '',
                    'QOLDIQ:',
                    `$${runningBalance.toFixed(2)}`
                ]);
                finalRow.font = { bold: true, size: 12 };
                finalRow.getCell(5).font = {
                    color: { argb: runningBalance > 0 ? 'FFFF0000' : 'FF00AA00' },
                    bold: true,
                    size: 12
                };
                finalRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFF3CD' }
                };
                finalRow.eachCell((cell, colNumber) => {
                    if (colNumber > 1) {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    }
                });
            }

            // Debt payment history (separate from sale payments)
            if (debtPaymentHistory.length > 0) {
                worksheet.addRow([]);
                worksheet.addRow(['', 'QARZ BO\'YICHA TO\'LOVLAR TARIXI']).font = { bold: true, size: 12 };

                const debtPaymentHeaderRow = worksheet.addRow(['', 'Sana', 'Summa', 'Usul', '']);
                debtPaymentHeaderRow.font = { bold: true };
                debtPaymentHeaderRow.eachCell((cell, colNumber) => {
                    if (colNumber > 1 && colNumber <= 4) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFE0FFE0' }
                        };
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    }
                });

                debtPaymentHistory.forEach(payment => {
                    const row = worksheet.addRow([
                        '',
                        new Date(payment.payment_date).toLocaleDateString('ru-RU'),
                        `-$${parseFloat(payment.amount).toFixed(2)}`,
                        translatePaymentMethod(payment.payment_method),
                        ''
                    ]);
                    row.getCell(3).font = { color: { argb: 'FF00AA00' }, bold: true };
                    row.eachCell((cell, colNumber) => {
                        if (colNumber > 1 && colNumber <= 4) {
                            cell.border = {
                                top: { style: 'thin' },
                                left: { style: 'thin' },
                                bottom: { style: 'thin' },
                                right: { style: 'thin' }
                            };
                        }
                    });
                });
            }

            // Seller Penalties
            if (sellerPenalties && sellerPenalties.length > 0) {
                worksheet.addRow([]);
                worksheet.addRow(['', 'SOTUVCHI JAZOLARI']).font = { bold: true, size: 12 };

                const penaltyHeaderRow = worksheet.addRow(['', 'Sana', 'Summa', 'Sabab', '']);
                penaltyHeaderRow.font = { bold: true };
                penaltyHeaderRow.eachCell((cell, colNumber) => {
                    if (colNumber > 1 && colNumber <= 4) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFE0E0' }
                        };
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    }
                });

                let totalPenalties = 0;
                sellerPenalties.forEach(penalty => {
                    totalPenalties += parseFloat(penalty.penalty_amount);
                    const row = worksheet.addRow([
                        '',
                        new Date(penalty.penalty_date).toLocaleDateString('ru-RU'),
                        `-$${parseFloat(penalty.penalty_amount).toFixed(2)}`,
                        penalty.reason || 'Sababsiz',
                        ''
                    ]);
                    row.getCell(3).font = { color: { argb: 'FFFF0000' }, bold: true };
                    row.eachCell((cell, colNumber) => {
                        if (colNumber > 1 && colNumber <= 4) {
                            cell.border = {
                                top: { style: 'thin' },
                                left: { style: 'thin' },
                                bottom: { style: 'thin' },
                                right: { style: 'thin' }
                            };
                        }
                    });
                });

                // Total penalties row
                const totalPenaltyRow = worksheet.addRow([
                    '',
                    '',
                    '',
                    'JAMI JAZOLAR:',
                    `-$${totalPenalties.toFixed(2)}`
                ]);
                totalPenaltyRow.font = { bold: true, size: 11 };
                totalPenaltyRow.getCell(5).font = {
                    color: { argb: 'FFFF0000' },
                    bold: true,
                    size: 11
                };
                totalPenaltyRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFE0E0' }
                };
                totalPenaltyRow.eachCell((cell, colNumber) => {
                    if (colNumber > 1) {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    }
                });
            }

            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Hisob_${sale.id}_${Date.now()}.xlsx`);

            // Write to response
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('Export to Excel error:', error);
            res.status(500).send('Error generating Excel file');
        }
    }
}

module.exports = SalesController;
