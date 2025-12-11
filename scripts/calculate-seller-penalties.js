#!/usr/bin/env node

/**
 * Calculate Seller Penalties for Outstanding Debts
 *
 * This script calculates monthly penalties for sellers based on outstanding debts.
 * For each sale with unpaid debt, a 1% penalty is applied on the remaining debt
 * at the end of each month.
 *
 * Usage: node scripts/calculate-seller-penalties.js
 */

const { query } = require('../src/config/database');

async function calculateSellerPenalties() {
    try {
        console.log('Starting seller penalty calculation...\n');

        // Get all sales that have debts (paid_amount < total_amount)
        const salesWithDebts = await query(`
            SELECT s.id, s.seller_id, s.sale_date, s.total_amount, s.paid_amount,
                   sel.full_name as seller_name,
                   c.full_name as customer_name
            FROM sales s
            JOIN sellers sel ON s.seller_id = sel.id
            JOIN customers c ON s.customer_id = c.id
            WHERE s.paid_amount < s.total_amount
            ORDER BY s.sale_date ASC
        `);

        console.log(`Found ${salesWithDebts.length} sales with outstanding debts.\n`);

        let totalPenalties = 0;
        let penaltyCount = 0;

        // Process each sale
        for (const sale of salesWithDebts) {
            console.log(`Processing Sale #${sale.id} - ${sale.customer_name} (Seller: ${sale.seller_name})`);
            console.log(`  Sale Date: ${sale.sale_date.toISOString().split('T')[0]}`);
            console.log(`  Total: $${sale.total_amount}, Paid: $${sale.paid_amount}`);

            // Get all payments for this sale, ordered by date
            const payments = await query(`
                SELECT payment_date, amount
                FROM sale_payments
                WHERE sale_id = ?
                ORDER BY payment_date ASC
            `, [sale.id]);

            // Calculate penalties month by month
            const saleDate = new Date(sale.sale_date);
            const currentDate = new Date();

            // Start from the end of the first month after sale
            let checkDate = new Date(saleDate.getFullYear(), saleDate.getMonth() + 1, 0); // Last day of sale month
            if (checkDate <= saleDate) {
                // If sale was on last day of month, move to next month
                checkDate = new Date(saleDate.getFullYear(), saleDate.getMonth() + 2, 0);
            }

            let runningBalance = parseFloat(sale.total_amount);
            let paymentIndex = 0;

            while (checkDate <= currentDate) {
                const checkDateStr = checkDate.toISOString().split('T')[0];

                // Apply all payments up to this check date
                while (paymentIndex < payments.length) {
                    const payment = payments[paymentIndex];
                    const paymentDate = new Date(payment.payment_date);

                    if (paymentDate <= checkDate) {
                        runningBalance -= parseFloat(payment.amount);
                        paymentIndex++;
                    } else {
                        break;
                    }
                }

                // If there's still debt at this check date, apply penalty
                if (runningBalance > 0.01) { // Using 0.01 to handle floating point precision
                    const penaltyAmount = runningBalance * 0.01; // 1% penalty

                    // Check if penalty already exists for this sale and date
                    const existingPenalty = await query(`
                        SELECT id FROM seller_penalties
                        WHERE sale_id = ? AND penalty_date = ?
                    `, [sale.id, checkDateStr]);

                    if (existingPenalty.length === 0) {
                        // Insert new penalty
                        await query(`
                            INSERT INTO seller_penalties
                            (seller_id, sale_id, penalty_date, remaining_debt, penalty_amount, notes)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `, [
                            sale.seller_id,
                            sale.id,
                            checkDateStr,
                            runningBalance.toFixed(2),
                            penaltyAmount.toFixed(2),
                            `Monthly penalty: 1% of remaining debt`
                        ]);

                        console.log(`  ✓ Penalty added for ${checkDateStr}: $${penaltyAmount.toFixed(2)} (Debt: $${runningBalance.toFixed(2)})`);
                        totalPenalties += penaltyAmount;
                        penaltyCount++;
                    } else {
                        console.log(`  - Penalty already exists for ${checkDateStr}`);
                    }
                } else {
                    console.log(`  ✓ Debt fully paid by ${checkDateStr}, no more penalties`);
                    break; // Debt is paid off, no more penalties needed
                }

                // Move to end of next month
                checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth() + 2, 0);
            }

            console.log('');
        }

        console.log('='.repeat(60));
        console.log(`Calculation complete!`);
        console.log(`Total penalties calculated: ${penaltyCount}`);
        console.log(`Total penalty amount: $${totalPenalties.toFixed(2)}`);
        console.log('='.repeat(60));

        process.exit(0);
    } catch (error) {
        console.error('Error calculating seller penalties:', error);
        process.exit(1);
    }
}

// Run the script
calculateSellerPenalties();
