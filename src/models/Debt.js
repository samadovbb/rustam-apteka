const { query, transaction } = require('../config/database');
const AuditLog = require('./AuditLog');

class Debt {
    static async getAll(status = 'active', limit = 100) {
        const sql = `
            SELECT d.*, c.full_name as customer_name, c.phone as customer_phone,
                   s.id as sale_id, s.sale_date, s.total_amount as sale_total
            FROM debts d
            JOIN customers c ON d.customer_id = c.id
            JOIN sales s ON d.sale_id = s.id
            WHERE d.status = '${status}'
            ORDER BY d.created_at DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql, []);
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

    // Calculate debt with markup WITHOUT updating database (for display only)
    static calculateDebtWithMarkup(debt) {
        const now = new Date();
        const graceEnd = new Date(debt.grace_end_date);
        const currentAmount = parseFloat(debt.current_amount);

        // If no markup type is set, return current amount with no markup
        if (!debt.markup_type || !debt.markup_value) {
            return {
                baseAmount: currentAmount,
                monthsOverdue: 0,
                markupAmount: 0,
                totalWithMarkup: currentAmount
            };
        }

        // If still in grace period, no markup applies
        if (now < graceEnd) {
            return {
                baseAmount: currentAmount,
                monthsOverdue: 0,
                markupAmount: 0,
                totalWithMarkup: currentAmount
            };
        }

        // Calculate months past grace period
        const monthsOverdue = Math.max(0, Math.floor(
            (now.getTime() - graceEnd.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        ));

        let markupAmount = 0;

        if (debt.markup_type === 'fixed') {
            // Fixed markup per month
            markupAmount = parseFloat(debt.markup_value) * monthsOverdue;
        } else if (debt.markup_type === 'percent') {
            // Percent markup - simple interest (not compound)
            const markupPercent = parseFloat(debt.markup_value);
            markupAmount = (currentAmount * markupPercent * monthsOverdue) / 100;
        }

        return {
            baseAmount: currentAmount,
            monthsOverdue,
            markupAmount,
            totalWithMarkup: currentAmount + markupAmount
        };
    }

    // Apply markup for a debt (monthly calculation)
    static async applyMarkup(debtId) {
        return await transaction(async (conn) => {
            // Get debt details
            const [debts] = await conn.execute(
                `SELECT d.*, s.sale_date
                 FROM debts d
                 LEFT JOIN sales s ON d.sale_id = s.id
                 WHERE d.id = ?`,
                [debtId]
            );

            if (!debts[0]) {
                return null;
            }

            const debt = debts[0];
            const graceEndDate = new Date(debt.grace_end_date);
            const currentDate = new Date();

            // Check if grace period has ended
            if (currentDate < graceEndDate) {
                return null; // Still in grace period
            }

            const currentAmount = parseFloat(debt.current_amount);

            // If debt is already paid (0 or less), don't apply markup
            if (currentAmount <= 0) {
                return null;
            }

            // Get all payments to track when debt was paid
            const [payments] = await conn.execute(`
                SELECT p.payment_date, p.amount
                FROM payments p
                WHERE p.sale_id = (SELECT sale_id FROM debts WHERE id = ?)
                ORDER BY p.payment_date ASC
            `, [debtId]);

            // Calculate running balance to find when debt became 0
            let runningBalance = parseFloat((await conn.execute(
                `SELECT total_amount FROM sales WHERE id = (SELECT sale_id FROM debts WHERE id = ?)`,
                [debtId]
            ))[0][0].total_amount);

            let debtPaidDate = null;
            for (const payment of payments) {
                runningBalance -= parseFloat(payment.amount);
                if (runningBalance <= 0) {
                    debtPaidDate = new Date(payment.payment_date);
                    break;
                }
            }

            // Calculate until debt is paid or current date
            const endDate = debtPaidDate || currentDate;

            // Start from grace end date + 1 day
            let checkDate = new Date(graceEndDate);
            checkDate.setDate(checkDate.getDate() + 1);

            let totalMarkupAdded = 0;
            let monthCount = 0;
            const markupsAdded = [];

            while (checkDate <= endDate) {
                const checkDateStr = checkDate.toISOString().split('T')[0];
                monthCount++;

                // Check if markup already logged for this date
                const [existing] = await conn.execute(
                    debt.markup_type === 'fixed'
                        ? `SELECT id FROM debt_fixed_markup_logs WHERE debt_id = ? AND DATE(calculation_date) = ?`
                        : `SELECT id FROM debt_percent_markup_logs WHERE debt_id = ? AND DATE(calculation_date) = ?`,
                    [debtId, checkDateStr]
                );

                if (existing.length === 0) {
                    // Calculate markup
                    let markupValue;
                    const debtBeforeMarkup = currentAmount + totalMarkupAdded;

                    if (debt.markup_type === 'fixed') {
                        markupValue = parseFloat(debt.markup_value);
                        const debtAfterMarkup = debtBeforeMarkup + markupValue;

                        await conn.execute(
                            `INSERT INTO debt_fixed_markup_logs
                             (debt_id, calculation_date, remaining_debt, markup_value, total_after_markup)
                             VALUES (?, ?, ?, ?, ?)`,
                            [debtId, checkDateStr, debtBeforeMarkup, markupValue, debtAfterMarkup]
                        );
                    } else {
                        const markupPercent = parseFloat(debt.markup_value);
                        markupValue = (debtBeforeMarkup * markupPercent) / 100;
                        const debtAfterMarkup = debtBeforeMarkup + markupValue;

                        await conn.execute(
                            `INSERT INTO debt_percent_markup_logs
                             (debt_id, calculation_date, remaining_debt, markup_percent, markup_value, total_after_markup)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [debtId, checkDateStr, debtBeforeMarkup, markupPercent, markupValue, debtAfterMarkup]
                        );
                    }

                    totalMarkupAdded += markupValue;
                    markupsAdded.push({ date: checkDateStr, amount: markupValue });
                }

                // Move to same day next month
                checkDate.setMonth(checkDate.getMonth() + 1);
            }

            if (totalMarkupAdded > 0) {
                // Update debt current_amount and last_markup_date
                const newAmount = currentAmount + totalMarkupAdded;
                await conn.execute(
                    `UPDATE debts
                     SET current_amount = ?, last_markup_date = CURDATE()
                     WHERE id = ?`,
                    [newAmount, debtId]
                );

                // Cleanup: Remove markups added after debt was paid (if any)
                if (debtPaidDate) {
                    const cleanupDate = debtPaidDate.toISOString().split('T')[0];
                    const deletedFixed = await conn.execute(
                        `DELETE FROM debt_fixed_markup_logs
                         WHERE debt_id = ? AND DATE(calculation_date) > ?`,
                        [debtId, cleanupDate]
                    );
                    const deletedPercent = await conn.execute(
                        `DELETE FROM debt_percent_markup_logs
                         WHERE debt_id = ? AND DATE(calculation_date) > ?`,
                        [debtId, cleanupDate]
                    );

                    const deletedCount = deletedFixed[0].affectedRows + deletedPercent[0].affectedRows;
                    if (deletedCount > 0) {
                        console.log(`Cleaned up ${deletedCount} markup(s) added after debt was paid`);
                    }
                }

                return {
                    debtId,
                    previousAmount: currentAmount,
                    markupValue: totalMarkupAdded,
                    newAmount,
                    monthsAdded: monthCount,
                    markupsAdded
                };
            }

            return null;
        });
    }

    static async changeGracePeriod(debtId, newGracePeriodMonths, user = null) {
        return await transaction(async (conn) => {
            // Get current debt details
            const [debts] = await conn.execute(
                'SELECT * FROM debts WHERE id = ?',
                [debtId]
            );

            if (!debts[0]) {
                throw new Error('Debt not found');
            }

            const debt = debts[0];
            const oldGracePeriod = debt.grace_period_months;

            // Calculate new grace_end_date
            // grace_end_date = sale_date + grace_period_months
            const [sales] = await conn.execute(
                'SELECT sale_date FROM sales WHERE id = ?',
                [debt.sale_id]
            );

            if (!sales[0]) {
                throw new Error('Associated sale not found');
            }

            const saleDate = new Date(sales[0].sale_date);
            const newGraceEndDate = new Date(saleDate);
            newGraceEndDate.setMonth(newGraceEndDate.getMonth() + parseInt(newGracePeriodMonths));

            // Update debt with new grace period
            await conn.execute(
                `UPDATE debts SET
                    grace_period_months = ?,
                    grace_end_date = ?,
                    original_grace_period_months = COALESCE(original_grace_period_months, ?),
                    grace_period_changed_at = NOW()
                WHERE id = ?`,
                [newGracePeriodMonths, newGraceEndDate, oldGracePeriod, debtId]
            );

            // Log the change
            await AuditLog.log(
                'debts',
                debtId,
                'update',
                { grace_period_months: oldGracePeriod },
                { grace_period_months: newGracePeriodMonths },
                user
            );

            return {
                debtId,
                oldGracePeriod,
                newGracePeriod: newGracePeriodMonths,
                newGraceEndDate
            };
        });
    }

    static async processMonthlyMarkups() {
        const sql = `
            SELECT id FROM debts
            WHERE status = 'active'
            AND markup_type IS NOT NULL
            AND markup_value IS NOT NULL
            AND grace_end_date < CURDATE()
            AND current_amount > 0
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

    static async getLatestPaymentDate() {
        const sql = `
            SELECT DATE(p.payment_date) as latest_date
            FROM payments p
            JOIN debt_payments dp ON p.id = dp.payment_id
            ORDER BY p.payment_date DESC
            LIMIT 1
        `;
        const results = await query(sql);
        return results[0]?.latest_date || null;
    }
}

module.exports = Debt;
