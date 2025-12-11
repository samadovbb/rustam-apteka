#!/usr/bin/env node
/**
 * Retroactive Fixed Markup Calculator
 *
 * This script calculates and applies fixed markups to debts based on actual payment history.
 * It looks at when payments were made and applies markup for the months the payment was late.
 */

const { query, transaction } = require('../src/config/database');
require('dotenv').config();

/**
 * Calculate months between two dates
 */
function monthsDifference(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    const months = (d2.getFullYear() - d1.getFullYear()) * 12 +
                   (d2.getMonth() - d1.getMonth());

    return Math.max(0, months);
}

/**
 * Main function to calculate retroactive markups
 */
async function calculateRetroactiveMarkups() {
    try {
        console.log('='.repeat(70));
        console.log('🔄 RETROACTIVE FIXED MARKUP CALCULATION');
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
            console.log(`  Fixed Markup: $${parseFloat(debt.markup_value).toFixed(2)}/month`);
            console.log(`  Grace End Date: ${debt.grace_end_date}`);

            // Get all payments for this debt
            const payments = await query(`
                SELECT p.*, pay.payment_date
                FROM debt_payments dp
                JOIN payments pay ON dp.payment_id = pay.id
                WHERE dp.debt_id = ?
                ORDER BY pay.payment_date ASC
            `, [debt.id]);

            if (payments.length === 0) {
                console.log(`  ⚠️  No payments found for this debt`);
                continue;
            }

            console.log(`\n  📋 Found ${payments.length} payment(s):`);

            let debtMarkupTotal = 0;

            for (const payment of payments) {
                const paymentDate = new Date(payment.payment_date);
                const graceEndDate = new Date(debt.grace_end_date);

                console.log(`\n  Payment Date: ${payment.payment_date}`);
                console.log(`  Payment Amount: $${parseFloat(payment.amount).toFixed(2)}`);

                // Check if payment was made after grace period
                if (paymentDate <= graceEndDate) {
                    console.log(`  ✓ Payment made during grace period - no markup`);
                    continue;
                }

                // Calculate months late
                const monthsLate = monthsDifference(graceEndDate, paymentDate);

                if (monthsLate === 0) {
                    console.log(`  ✓ Payment made in the first month after grace - no markup`);
                    continue;
                }

                // Calculate markup
                const markupAmount = monthsLate * parseFloat(debt.markup_value);
                debtMarkupTotal += markupAmount;

                console.log(`  ⚠️  Payment was ${monthsLate} month(s) late`);
                console.log(`  💰 Markup to add: $${markupAmount.toFixed(2)} (${monthsLate} × $${parseFloat(debt.markup_value).toFixed(2)})`);

                // Add markup log
                await transaction(async (conn) => {
                    // Check if markup already logged for this payment
                    const [existing] = await conn.execute(`
                        SELECT id FROM debt_fixed_markup_logs
                        WHERE debt_id = ? AND applied_date = ?
                    `, [debt.id, payment.payment_date]);

                    if (existing.length > 0) {
                        console.log(`  ℹ️  Markup already logged for this payment date`);
                        return;
                    }

                    // Insert markup log
                    await conn.execute(`
                        INSERT INTO debt_fixed_markup_logs
                        (debt_id, markup_amount, months_count, applied_date)
                        VALUES (?, ?, ?, ?)
                    `, [debt.id, markupAmount, monthsLate, payment.payment_date]);

                    console.log(`  ✅ Markup log created`);
                });
            }

            if (debtMarkupTotal > 0) {
                // Update debt current_amount
                const newCurrentAmount = parseFloat(debt.current_amount) + debtMarkupTotal;

                await query(`
                    UPDATE debts
                    SET current_amount = ?
                    WHERE id = ?
                `, [newCurrentAmount, debt.id]);

                console.log(`\n  📈 Total Markup for this debt: $${debtMarkupTotal.toFixed(2)}`);
                console.log(`  💵 Updated Current Amount: $${parseFloat(debt.current_amount).toFixed(2)} → $${newCurrentAmount.toFixed(2)}`);

                processedCount++;
                totalMarkupAdded += debtMarkupTotal;
            } else {
                console.log(`\n  ℹ️  No markup needed for this debt`);
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
