const Debt = require('../models/Debt');

class DebtController {
    static async index(req, res) {
        try {
            const status = req.query.status || 'active';
            const debts = await Debt.getAll(status);
            const stats = await Debt.getDebtStatistics();

            res.render('debts/index', {
                title: 'Debts - MegaDent POS',
                debts,
                stats,
                currentStatus: status
            });
        } catch (error) {
            console.error('Debts index error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async view(req, res) {
        try {
            const debt = await Debt.findById(req.params.id);

            if (!debt) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Debt not found',
                    error: {}
                });
            }

            const paymentHistory = await Debt.getPaymentHistory(req.params.id);

            let markupLogs = [];
            if (debt.markup_type === 'fixed') {
                markupLogs = await Debt.getFixedMarkupLogs(req.params.id);
            } else {
                markupLogs = await Debt.getPercentMarkupLogs(req.params.id);
            }

            // Calculate current debt with markup dynamically (not from database)
            const debtCalculation = Debt.calculateDebtWithMarkup(debt);

            res.render('debts/view', {
                title: `Debt #${debt.id}`,
                debt,
                debtCalculation,
                paymentHistory,
                markupLogs
            });
        } catch (error) {
            console.error('Debt view error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async applyManualMarkup(req, res) {
        try {
            const result = await Debt.applyMarkup(req.params.id);

            if (!result) {
                return res.json({
                    success: false,
                    message: 'Qarz hali imtiyoz davrida yoki faol emas'
                });
            }

            res.json({
                success: true,
                message: 'Ustama muvaffaqiyatli qo\'shildi',
                result
            });
        } catch (error) {
            console.error('Apply markup error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async updateStatus(req, res) {
        try {
            const { status } = req.body;
            await Debt.updateStatus(req.params.id, status);

            res.redirect(`/debts/${req.params.id}`);
        } catch (error) {
            console.error('Update debt status error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async getLatestPaymentDate(req, res) {
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

    // Change grace period
    static async changeGracePeriod(req, res) {
        try {
            const { grace_period_months } = req.body;

            if (!grace_period_months) {
                return res.status(400).json({ success: false, error: 'Imtiyoz davri kiritilishi kerak' });
            }

            const result = await Debt.changeGracePeriod(
                req.params.id,
                parseInt(grace_period_months),
                req.user
            );

            res.json({
                success: true,
                message: 'Imtiyoz davri muvaffaqiyatli o\'zgartirildi',
                result
            });
        } catch (error) {
            console.error('Change grace period error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Export debt to Excel
    static async exportToExcel(req, res) {
        try {
            const ExcelJS = require('exceljs');

            // Payment method translation helper
            const translatePaymentMethod = (method) => {
                if (!method) return method;
                const translations = {
                    'cash': 'naqt',
                    'card': 'karta',
                    'transfer': 'o\'tkazma',
                    'other': 'boshqa'
                };
                return translations[method.toLowerCase()] || method;
            };

            const debt = await Debt.findById(req.params.id);

            if (!debt) {
                return res.status(404).send('Debt not found');
            }

            const debtCalculation = Debt.calculateDebtWithMarkup(debt);
            const paymentHistory = await Debt.getPaymentHistory(req.params.id);

            let markupLogs = [];
            if (debt.markup_type === 'fixed') {
                markupLogs = await Debt.getFixedMarkupLogs(req.params.id);
            } else {
                markupLogs = await Debt.getPercentMarkupLogs(req.params.id);
            }

            // Create workbook
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Qarz');

            // Set column widths
            worksheet.columns = [
                { width: 5 },
                { width: 30 },
                { width: 20 },
                { width: 20 }
            ];

            // Title
            worksheet.mergeCells('A1:D1');
            worksheet.getCell('A1').value = 'QARZ HISOBOTI';
            worksheet.getCell('A1').font = { size: 18, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

            // Debt info
            worksheet.addRow([]);
            worksheet.addRow(['', 'Qarz raqami:', `#${debt.id}`]);
            worksheet.addRow(['', 'Mijoz:', debt.customer_name]);
            worksheet.addRow(['', 'Telefon:', debt.customer_phone]);
            worksheet.addRow(['', 'Savdo sanasi:', new Date(debt.sale_date).toLocaleDateString('ru-RU')]);
            worksheet.addRow(['', 'Savdo raqami:', `#${debt.sale_id}`]);
            worksheet.addRow([]);

            // Debt amounts
            worksheet.addRow(['', 'QARZ MIQDORLARI']).font = { bold: true, size: 12 };
            worksheet.addRow(['', 'Asl qarz:', `$${parseFloat(debt.original_amount).toFixed(2)}`]);
            worksheet.addRow(['', 'Joriy qarz (asosiy):', `$${parseFloat(debtCalculation.baseAmount).toFixed(2)}`]);

            if (debtCalculation.monthsOverdue > 0) {
                worksheet.addRow([]);
                const overdueRow = worksheet.addRow(['', 'Imtiyoz muddati tugagan:', `${debtCalculation.monthsOverdue} oy oldin`]);
                overdueRow.getCell(3).font = { color: { argb: 'FFFF9900' }, bold: true };

                const markupRow = worksheet.addRow(['', 'Ustama (hisoblangan):', `$${parseFloat(debtCalculation.markupAmount).toFixed(2)}`]);
                markupRow.getCell(3).font = { color: { argb: 'FFFF9900' }, bold: true };

                const totalRow = worksheet.addRow(['', 'JAMI QARZ (ustama bilan):', `$${parseFloat(debtCalculation.totalWithMarkup).toFixed(2)}`]);
                totalRow.font = { bold: true, size: 12 };
                totalRow.getCell(3).font = { color: { argb: 'FFFF0000' }, bold: true, size: 12 };
            } else {
                const totalRow = worksheet.addRow(['', 'JAMI QARZ:', `$${parseFloat(debtCalculation.baseAmount).toFixed(2)}`]);
                totalRow.font = { bold: true, size: 12 };
            }

            // Grace period info
            worksheet.addRow([]);
            worksheet.addRow(['', 'Imtiyoz muddati:', `${debt.grace_period_months} oy`]);
            worksheet.addRow(['', 'Imtiyoz tugash sanasi:', new Date(debt.grace_end_date).toLocaleDateString('ru-RU')]);
            worksheet.addRow(['', 'Ustama turi:', debt.markup_type === 'fixed' ? 'Qat\'iy' : 'Foiz']);
            worksheet.addRow(['', 'Ustama stavkasi:', debt.markup_type === 'fixed' ? `$${parseFloat(debt.markup_value).toFixed(2)} har oy` : `${parseFloat(debt.markup_value).toFixed(2)}% har oy`]);

            // Payment history
            if (paymentHistory.length > 0) {
                worksheet.addRow([]);
                worksheet.addRow(['', 'TO\'LOVLAR TARIXI (qarzni kamaytiradi)']).font = { bold: true, size: 12 };

                const paymentHeaderRow = worksheet.addRow(['', 'Sana', 'Summa', 'Usul']);
                paymentHeaderRow.font = { bold: true };
                paymentHeaderRow.eachCell((cell, colNumber) => {
                    if (colNumber > 1) {
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

                paymentHistory.forEach(payment => {
                    const row = worksheet.addRow([
                        '',
                        new Date(payment.payment_date).toLocaleDateString('ru-RU'),
                        `-$${parseFloat(payment.amount).toFixed(2)}`,
                        translatePaymentMethod(payment.payment_method)
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
                });
            }

            // Markup history
            if (markupLogs.length > 0) {
                worksheet.addRow([]);
                worksheet.addRow(['', 'USTAMA TARIXI (qarzni oshiradi)']).font = { bold: true, size: 12 };

                const markupHeaderRow = worksheet.addRow(['', 'Sana', 'Qarz (oldingi)', 'Ustama']);
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
                        markupValue
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
            res.setHeader('Content-Disposition', `attachment; filename=Qarz_${debt.id}_${Date.now()}.xlsx`);

            // Write to response
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('Export debt to Excel error:', error);
            res.status(500).send('Error generating Excel file');
        }
    }
}

module.exports = DebtController;
