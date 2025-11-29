const cron = require('node-cron');
const Debt = require('../models/Debt');
require('dotenv').config();

/**
 * Cron job to process monthly debt markups
 * Default schedule: Run on 1st day of every month at midnight (0 0 1 * *)
 * Can be configured via DEBT_CRON_SCHEDULE environment variable
 */
const startDebtCron = () => {
    const schedule = process.env.DEBT_CRON_SCHEDULE || '0 0 1 * *';

    const job = cron.schedule(schedule, async () => {
        console.log('='.repeat(50));
        console.log('🔄 Running monthly debt markup processing...');
        console.log('Time:', new Date().toISOString());
        console.log('='.repeat(50));

        try {
            const results = await Debt.processMonthlyMarkups();

            if (results.length === 0) {
                console.log('✅ No debts to process at this time');
            } else {
                console.log(`✅ Processed ${results.length} debt(s):`);
                results.forEach((result, index) => {
                    console.log(`  ${index + 1}. Debt ID: ${result.debtId}`);
                    console.log(`     Previous: $${result.previousAmount.toFixed(2)}`);
                    console.log(`     Markup: $${result.markupValue.toFixed(2)}`);
                    console.log(`     New Amount: $${result.newAmount.toFixed(2)}`);
                });

                // Get updated statistics
                const stats = await Debt.getDebtStatistics();
                console.log('');
                console.log('📊 Debt Statistics:');
                console.log(`   Total Active Debts: ${stats.active_count}`);
                console.log(`   Total Active Amount: $${parseFloat(stats.total_active_debt || 0).toFixed(2)}`);
            }
        } catch (error) {
            console.error('❌ Error processing debt markups:', error);
        }

        console.log('='.repeat(50));
    }, {
        scheduled: true,
        timezone: "Asia/Tashkent" // Adjust timezone as needed
    });

    console.log('⏰ Debt markup cron job scheduled:', schedule);
    console.log('   Timezone: Asia/Tashkent');

    return job;
};

/**
 * Manual trigger for debt markup processing
 * Can be called directly for testing or manual execution
 */
const triggerManualMarkup = async () => {
    console.log('🔧 Manual debt markup processing triggered...');
    try {
        const results = await Debt.processMonthlyMarkups();
        console.log(`✅ Processed ${results.length} debt(s)`);
        return results;
    } catch (error) {
        console.error('❌ Manual markup processing failed:', error);
        throw error;
    }
};

module.exports = {
    startDebtCron,
    triggerManualMarkup
};
