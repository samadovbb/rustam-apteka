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
}

module.exports = DebtController;
