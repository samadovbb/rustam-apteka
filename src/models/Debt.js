const { query, transaction } = require('../config/database');

class Debt {
    static async getAll(status = 'active', limit = 100) {
        const sql = `
            SELECT d.*, c.full_name as customer_name, c.phone as customer_phone,
                   s.id as sale_id, s.sale_date, s.total_amount as sale_total
            FROM debts d
            JOIN customers c ON d.customer_id = c.id
            JOIN sales s ON d.sale_id = s.id
            WHERE d.status = ?
            ORDER BY d.created_at DESC
            LIMIT ?
        `;
        return await query(sql, [status, limit]);
    }

    static async findById(id) {
        const sql = `
            SELECT d.*, c.full_name as customer_name, c.phone as customer_phone,
                   s.id as sale_id, s.sale_date, s.total_amount as sale_total
            FROM debts d
            JOIN customers c ON d.customer_id = c.id
            JOIN sales s ON d.sale_id = s.id
            WHERE d.id = ?
            LIMIT 1
        `;
        const results = await query(sql, [id]);
        return results[0] || null;
    }

    static async getByCustomer(customerId, status = 'active') {
        const sql = `
            SELECT d.*, s.sale_date, s.total_amount as sale_total
            FROM debts d
            JOIN sales s ON d.sale_id = s.id
            WHERE d.customer_id = ? AND d.status = ?
            ORDER BY d.created_at DESC
        `;
        return await query(sql, [customerId, status]);
    }

    static async getFixedMarkupLogs(debtId) {
        const sql = `
            SELECT * FROM debt_fixed_markup_logs
            WHERE debt_id = ?
            ORDER BY calculation_date DESC
        `;
        return await query(sql, [debtId]);
    }

    static async getPercentMarkupLogs(debtId) {
        const sql = `
            SELECT * FROM debt_percent_markup_logs
            WHERE debt_id = ?
            ORDER BY calculation_date DESC
        `;
        return await query(sql, [debtId]);
    }

    static async getPaymentHistory(debtId) {
        const sql = `
            SELECT dp.*, p.payment_date, p.payment_method
            FROM debt_payments dp
            JOIN payments p ON dp.payment_id = p.id
            WHERE dp.debt_id = ?
            ORDER BY p.payment_date DESC
        `;
        return await query(sql, [debtId]);
    }

    static async applyMarkup(debtId) {
        return await transaction(async (conn) => {
            // Get debt details
            const [debts] = await conn.execute(
                `SELECT * FROM debts WHERE id = ? AND status = 'active'`,
                [debtId]
            );

            if (!debts[0]) {
                return null;
            }

            const debt = debts[0];
            const now = new Date();
            const graceEnd = new Date(debt.grace_end_date);

            // Check if grace period has ended
            if (now < graceEnd) {
                return null; // Still in grace period
            }

            const currentAmount = parseFloat(debt.current_amount);
            let markupValue;
            let totalAfterMarkup;

            if (debt.markup_type === 'fixed') {
                // Fixed markup
                markupValue = parseFloat(debt.markup_value);
                totalAfterMarkup = currentAmount + markupValue;

                // Insert log
                await conn.execute(
                    `INSERT INTO debt_fixed_markup_logs
                     (debt_id, remaining_debt, markup_value, total_after_markup)
                     VALUES (?, ?, ?, ?)`,
                    [debtId, currentAmount, markupValue, totalAfterMarkup]
                );
            } else {
                // Percent markup
                const markupPercent = parseFloat(debt.markup_value);
                markupValue = (currentAmount * markupPercent) / 100;
                totalAfterMarkup = currentAmount + markupValue;

                // Insert log
                await conn.execute(
                    `INSERT INTO debt_percent_markup_logs
                     (debt_id, remaining_debt, markup_percent, markup_value, total_after_markup)
                     VALUES (?, ?, ?, ?, ?)`,
                    [debtId, currentAmount, markupPercent, markupValue, totalAfterMarkup]
                );
            }

            // Update debt
            await conn.execute(
                `UPDATE debts
                 SET current_amount = ?, last_markup_date = CURDATE()
                 WHERE id = ?`,
                [totalAfterMarkup, debtId]
            );

            return {
                debtId,
                previousAmount: currentAmount,
                markupValue,
                newAmount: totalAfterMarkup
            };
        });
    }

    static async processMonthlyMarkups() {
        const sql = `
            SELECT id FROM debts
            WHERE status = 'active'
            AND grace_end_date < CURDATE()
            AND (last_markup_date IS NULL OR last_markup_date < DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        `;
        const debtsToProcess = await query(sql);

        const results = [];
        for (const debt of debtsToProcess) {
            try {
                const result = await this.applyMarkup(debt.id);
                if (result) {
                    results.push(result);
                }
            } catch (error) {
                console.error(`Error processing debt ${debt.id}:`, error);
            }
        }

        return results;
    }

    static async updateStatus(debtId, status) {
        const sql = 'UPDATE debts SET status = ? WHERE id = ?';
        await query(sql, [status, debtId]);
    }

    static async getTotalActiveDebt() {
        const sql = `
            SELECT SUM(current_amount) as total
            FROM debts
            WHERE status = 'active'
        `;
        const results = await query(sql);
        return parseFloat(results[0]?.total || 0);
    }

    static async getDebtStatistics() {
        const sql = `
            SELECT
                COUNT(*) as total_count,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN status = 'active' THEN current_amount ELSE 0 END) as total_active_debt,
                SUM(original_amount) as total_original_debt,
                SUM(CASE WHEN status = 'paid' THEN original_amount ELSE 0 END) as total_recovered
            FROM debts
        `;
        const results = await query(sql);
        return results[0] || {};
    }
}

module.exports = Debt;
