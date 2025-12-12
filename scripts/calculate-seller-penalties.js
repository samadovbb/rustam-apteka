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

        // Get all sales (including fully paid ones, to calculate penalties for historical debts)
        const salesWithDebts = await query(`
            SELECT s.id, s.seller_id, s.sale_date, s.total_amount, s.paid_amount,
                   sel.full_name as seller_name,
                   c.full_name as customer_name
            FROM sales s
            JOIN sellers sel ON s.seller_id = sel.id
            JOIN customers c ON s.customer_id = c.id
            ORDER BY s.sale_date ASC
        `);

        console.log(`Found ${salesWithDebts.length} sales to process (including fully paid).\n`);

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
                FROM payments
                WHERE sale_id = ?
                ORDER BY payment_date ASC
            `, [sale.id]);

            // Calculate penalties month by month (based on sale date + 1 day)
            const saleDate = new Date(sale.sale_date);
            const currentDate = new Date();

            // Start from one month after sale date (same day of month) + 1 day
            let checkDate = new Date(saleDate);
            checkDate.setMonth(checkDate.getMonth() + 1);
            checkDate.setDate(checkDate.getDate() + 1); // Add 1 day

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

                // Move to same day next month
                checkDate.setMonth(checkDate.getMonth() + 1);
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
