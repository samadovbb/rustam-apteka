#!/usr/bin/env node
/**
 * Retroactive Fixed Markup Calculator (Monthly)
 *
 * This script calculates and applies fixed markups to debts MONTH BY MONTH.
 * Each month after grace period gets a separate markup until debt is paid.
 */

const { query, transaction } = require('../src/config/database');
require('dotenv').config();

/**
 * Main function to calculate retroactive markups
 */
async function calculateRetroactiveMarkups() {
    try {
        console.log('='.repeat(70));
        console.log('🔄 RETROACTIVE FIXED MARKUP CALCULATION (MONTHLY)');
        console.log('='.repeat(70));
        console.log('');

        // Get all debts with fixed markup type
        const debts = await query(`
            SELECT d.*, s.sale_date
            FROM debts d
            LEFT JOIN sales s ON d.sale_id = s.id
            WHERE d.markup_type = 'fixed'
            AND d.markup_value IS NOT NULL
            AND d.markup_value > 0
            ORDER BY d.id
        `);

        if (debts.length === 0) {
            console.log('ℹ️  No debts with fixed markup found.');
            return;
        }

        console.log(`📊 Found ${debts.length} debt(s) with fixed markup`);
        console.log('');

        let processedCount = 0;
        let totalMarkupAdded = 0;

        for (const debt of debts) {
            console.log(`\n${'─'.repeat(70)}`);
            console.log(`Processing Debt ID: ${debt.id}`);
            console.log(`  Customer ID: ${debt.customer_id}`);
            console.log(`  Original Amount: $${parseFloat(debt.original_amount).toFixed(2)}`);
            console.log(`  Current Amount: $${parseFloat(debt.current_amount).toFixed(2)}`);
            console.log(`  Status: ${debt.status}`);
            console.log(`  Fixed Markup: $${parseFloat(debt.markup_value).toFixed(2)}/month`);
            console.log(`  Grace End Date: ${debt.grace_end_date}`);

            const graceEndDate = new Date(debt.grace_end_date);
            const currentDate = new Date();

            // Determine when debt was paid (if it was)
            let debtPaidDate = null;
            if (debt.status === 'paid') {
                // Get the last payment date for this debt
                const lastPayment = await query(`
                    SELECT MAX(pay.payment_date) as last_payment_date
                    FROM debt_payments dp
                    JOIN payments pay ON dp.payment_id = pay.id
                    WHERE dp.debt_id = ?
                `, [debt.id]);

                if (lastPayment[0] && lastPayment[0].last_payment_date) {
                    debtPaidDate = new Date(lastPayment[0].last_payment_date);
                    console.log(`  ✓ Debt was paid on: ${debtPaidDate.toISOString().split('T')[0]}`);
                }
            }

            // Calculate until debt is paid or current date
            const endDate = debtPaidDate || currentDate;

            // Start from the first month after grace period
            let checkDate = new Date(graceEndDate.getFullYear(), graceEndDate.getMonth() + 1, 0); // End of first month after grace

            let debtMarkupTotal = 0;
            let monthCount = 0;

            console.log(`\n  📅 Calculating markup month by month:`);

            while (checkDate <= endDate) {
                const checkDateStr = checkDate.toISOString().split('T')[0];
                monthCount++;

                // Check if markup already logged for this month
                const existing = await query(`
                    SELECT id FROM debt_fixed_markup_logs
                    WHERE debt_id = ? AND DATE(calculation_date) = ?
                `, [debt.id, checkDateStr]);

                if (existing.length > 0) {
                    console.log(`  ${checkDateStr} - Already logged, skipping`);
                } else {
                    const markupAmount = parseFloat(debt.markup_value);

                    // Insert markup log for this month
                    await transaction(async (conn) => {
                        const currentDebt = parseFloat(debt.current_amount);
                        await conn.execute(`
                            INSERT INTO debt_fixed_markup_logs
                            (debt_id, calculation_date, remaining_debt, markup_value, total_after_markup)
                            VALUES (?, ?, ?, ?, ?)
                        `, [
                            debt.id,
                            checkDateStr,
                            currentDebt,
                            markupAmount,
                            currentDebt + markupAmount
                        ]);
                    });

                    debtMarkupTotal += markupAmount;
                    console.log(`  ${checkDateStr} - Added $${markupAmount.toFixed(2)} markup`);
                }

                // Move to the end of next month
                checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth() + 2, 0);
            }

            if (debtMarkupTotal > 0) {
                // Update debt current_amount
                const newCurrentAmount = parseFloat(debt.current_amount) + debtMarkupTotal;

                await query(`
                    UPDATE debts
                    SET current_amount = ?
                    WHERE id = ?
                `, [newCurrentAmount, debt.id]);

                console.log(`\n  📈 Total months: ${monthCount}`);
                console.log(`  📈 Total Markup for this debt: $${debtMarkupTotal.toFixed(2)}`);
                console.log(`  💵 Updated Current Amount: $${parseFloat(debt.current_amount).toFixed(2)} → $${newCurrentAmount.toFixed(2)}`);

                processedCount++;
                totalMarkupAdded += debtMarkupTotal;
            } else {
                console.log(`\n  ℹ️  No new markup needed for this debt`);
            }
        }

        console.log(`\n${'═'.repeat(70)}`);
        console.log('📊 SUMMARY');
        console.log(`${'═'.repeat(70)}`);
        console.log(`Total Debts Processed: ${debts.length}`);
        console.log(`Debts with Markup Added: ${processedCount}`);
        console.log(`Total Markup Added: $${totalMarkupAdded.toFixed(2)}`);
        console.log(`${'═'.repeat(70)}`);
        console.log('✅ Retroactive markup calculation completed!');
        console.log('');

    } catch (error) {
        console.error('❌ Error calculating retroactive markups:', error);
        throw error;
    }
}

// Run the script
calculateRetroactiveMarkups()
    .then(() => {
        console.log('Exiting...');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
