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

            res.render('debts/view', {
                title: `Debt #${debt.id}`,
                debt,
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
                    message: 'Debt is still in grace period or not active'
                });
            }

            res.json({
                success: true,
                message: 'Markup applied successfully',
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
}

module.exports = DebtController;
