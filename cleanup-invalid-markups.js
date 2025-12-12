const { query, transaction } = require('./src/config/database');

/**
 * Cleanup script to remove invalid markup logs that were added after debt became 0
 * This script analyzes payment and markup history to find markups added when debt was already paid
 */

async function cleanupInvalidMarkups() {
    console.log('Starting cleanup of invalid markup logs...\n');

    try {
        // Get all debts with markup logs
        const debts = await query(`
            SELECT DISTINCT d.id, d.sale_id, d.markup_type
            FROM debts d
            WHERE d.markup_type IS NOT NULL
        `);

        console.log(`Found ${debts.length} debts with markup configuration\n`);

        let totalFixed = 0;
        let totalPercent = 0;

        for (const debt of debts) {
            console.log(`Processing debt #${debt.id} (sale #${debt.sale_id})...`);

            // Get sale total
            const [sale] = await query('SELECT total_amount, sale_date FROM sales WHERE id = ?', [debt.sale_id]);
            if (!sale) continue;

            // Get all payments for this sale
            const payments = await query(`
                SELECT id, payment_date, amount
                FROM payments
                WHERE sale_id = ?
                ORDER BY payment_date ASC
            `, [debt.sale_id]);

            // Get all markup logs
            let markupLogs = [];
            if (debt.markup_type === 'fixed') {
                markupLogs = await query(`
                    SELECT id, calculation_date, markup_value
                    FROM debt_fixed_markup_logs
                    WHERE debt_id = ?
                    ORDER BY calculation_date ASC
                `, [debt.id]);
            } else {
                markupLogs = await query(`
                    SELECT id, calculation_date, markup_value
                    FROM debt_percent_markup_logs
                    WHERE debt_id = ?
                    ORDER BY calculation_date ASC
                `, [debt.id]);
            }

            if (markupLogs.length === 0) continue;

            // Combine and sort by date
            const timeline = [];

            payments.forEach(p => {
                timeline.push({
                    type: 'payment',
                    date: new Date(p.payment_date),
                    amount: parseFloat(p.amount),
                    id: p.id
                });
            });

            markupLogs.forEach(m => {
                timeline.push({
                    type: 'markup',
                    date: new Date(m.calculation_date),
                    amount: parseFloat(m.markup_value),
                    id: m.id
                });
            });

            timeline.sort((a, b) => a.date - b.date);

            // Calculate running balance and find invalid markups
            let runningBalance = parseFloat(sale.total_amount);
            const invalidMarkupIds = [];

            for (const item of timeline) {
                if (item.type === 'payment') {
                    runningBalance -= item.amount;
                } else if (item.type === 'markup') {
                    // If balance is already 0 or negative before adding markup, it's invalid
                    if (runningBalance <= 0) {
                        invalidMarkupIds.push(item.id);
                        console.log(`  - Found invalid markup #${item.id} on ${item.date.toLocaleDateString('ru-RU')} (balance was already $${runningBalance.toFixed(2)})`);
                    } else {
                        runningBalance += item.amount;
                    }
                }
            }

            // Delete invalid markups
            if (invalidMarkupIds.length > 0) {
                const tableName = debt.markup_type === 'fixed'
                    ? 'debt_fixed_markup_logs'
                    : 'debt_percent_markup_logs';

                const placeholders = invalidMarkupIds.map(() => '?').join(',');
                await query(
                    `DELETE FROM ${tableName} WHERE id IN (${placeholders})`,
                    invalidMarkupIds
                );

                if (debt.markup_type === 'fixed') {
                    totalFixed += invalidMarkupIds.length;
                } else {
                    totalPercent += invalidMarkupIds.length;
                }

                console.log(`  ✓ Deleted ${invalidMarkupIds.length} invalid markup(s)\n`);
            } else {
                console.log(`  ✓ No invalid markups found\n`);
            }
        }

        console.log('═'.repeat(60));
        console.log('Cleanup completed!');
        console.log(`Total invalid fixed markups deleted: ${totalFixed}`);
        console.log(`Total invalid percent markups deleted: ${totalPercent}`);
        console.log(`Total deleted: ${totalFixed + totalPercent}`);
        console.log('═'.repeat(60));

    } catch (error) {
        console.error('Error during cleanup:', error);
        throw error;
    }
}

// Run the cleanup
cleanupInvalidMarkups()
    .then(() => {
        console.log('\n✓ Script finished successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n✗ Script failed:', error);
        process.exit(1);
    });
