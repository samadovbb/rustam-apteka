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

            res.render('sales/view', {
                title: `Sale #${sale.id}`,
                sale,
                items,
                payments,
                profit,
                debt,
                debtCalculation,
                debtPaymentHistory,
                markupLogs
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

            // Create workbook
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Hisob');

            // Set column widths
            worksheet.columns = [
                { width: 5 },
                { width: 30 },
                { width: 15 },
                { width: 15 },
                { width: 15 }
            ];

            // Title
            worksheet.mergeCells('A1:E1');
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
            const headerRow = worksheet.addRow(['', 'Mahsulot', 'Miqdor', 'Narx', 'Jami']);
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
            items.forEach(item => {
                const row = worksheet.addRow([
                    '',
                    item.product_name,
                    item.quantity,
                    `$${parseFloat(item.unit_price).toFixed(2)}`,
                    `$${parseFloat(item.subtotal).toFixed(2)}`
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
            const totalRow = worksheet.addRow(['', '', '', 'Jami:', `$${parseFloat(sale.total_amount).toFixed(2)}`]);
            totalRow.font = { bold: true, size: 12 };
            totalRow.getCell(5).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' }
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

                if (debtCalculation.monthsOverdue > 0) {
                    worksheet.addRow(['', 'Imtiyoz muddati tugagan:', `${debtCalculation.monthsOverdue} oy oldin`]);
                    worksheet.addRow(['', 'Ustama:', `$${parseFloat(debtCalculation.markupAmount).toFixed(2)}`]);
                    const totalDebtRow = worksheet.addRow(['', 'Jami qarz (ustama bilan):', `$${parseFloat(debtCalculation.totalWithMarkup).toFixed(2)}`]);
                    totalDebtRow.font = { bold: true };
                    totalDebtRow.getCell(3).font = { color: { argb: 'FFFF0000' }, bold: true };
                }
            }

            // Payment history
            if (payments.length > 0) {
                worksheet.addRow([]);
                worksheet.addRow(['', 'TO\'LOVLAR TARIXI']).font = { bold: true, size: 12 };
                const paymentHeaderRow = worksheet.addRow(['', 'Sana', 'Summa', 'Usul', '']);
                paymentHeaderRow.font = { bold: true };

                payments.forEach(payment => {
                    worksheet.addRow([
                        '',
                        new Date(payment.payment_date).toLocaleDateString('ru-RU'),
                        `$${parseFloat(payment.amount).toFixed(2)}`,
                        translatePaymentMethod(payment.payment_method),
                        ''
                    ]);
                });
            }

            // Debt payment history (separate from sale payments)
            if (debtPaymentHistory.length > 0) {
                worksheet.addRow([]);
                worksheet.addRow(['', 'QARZ BO\'YICHA TO\'LOVLAR TARIXI (qarzni kamaytiradi)']).font = { bold: true, size: 12 };

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

            // Markup history
            if (markupLogs.length > 0) {
                worksheet.addRow([]);
                worksheet.addRow(['', 'USTAMA TARIXI (qarzni oshiradi)']).font = { bold: true, size: 12 };

                const markupHeaderRow = worksheet.addRow(['', 'Sana', 'Qarz (oldingi)', 'Ustama', 'Qarz (keyingi)']);
                markupHeaderRow.font = { bold: true };
                markupHeaderRow.eachCell((cell, colNumber) => {
                    if (colNumber > 1) {
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

                markupLogs.forEach(log => {
                    const markupValue = debt.markup_type === 'fixed'
                        ? `+$${parseFloat(log.markup_value || 0).toFixed(2)}`
                        : `${parseFloat(log.markup_percent || 0).toFixed(2)}% = +$${parseFloat(log.markup_value || 0).toFixed(2)}`;

                    const row = worksheet.addRow([
                        '',
                        new Date(log.calculation_date).toLocaleDateString('ru-RU'),
                        `$${parseFloat(log.remaining_debt || 0).toFixed(2)}`,
                        markupValue,
                        `$${parseFloat(log.total_after_markup || 0).toFixed(2)}`
                    ]);
                    row.getCell(4).font = { color: { argb: 'FFFF9900' }, bold: true };
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
