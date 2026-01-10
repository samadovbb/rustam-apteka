/**
 * Qarzlar jadvalidagi current_amount ni to'g'rilash scripti
 *
 * Bu script quyidagilarni bajaradi:
 * 1. Barcha qarzlar uchun to'lovlar yig'indisini hisoblaydi
 * 2. current_amount = original_amount - to'lovlar yig'indisi
 * 3. O'zgarishlar haqida hisobot chiqaradi
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDebtAmounts() {
    let connection;

    try {
        // Ma'lumotlar bazasiga ulanish
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'megadent_pos'
        });

        console.log('Ma\'lumotlar bazasiga ulanish muvaffaqiyatli\n');

        // 1. Hozirgi holatni tekshirish
        console.log('=== HOZIRGI HOLAT ===');
        const [currentState] = await connection.execute(`
            SELECT
                d.id,
                d.original_amount,
                COALESCE(SUM(dp.amount), 0) as total_paid,
                d.current_amount,
                (d.original_amount - COALESCE(SUM(dp.amount), 0)) as should_be,
                ABS(d.current_amount - (d.original_amount - COALESCE(SUM(dp.amount), 0))) as difference
            FROM debts d
            LEFT JOIN debt_payments dp ON d.id = dp.debt_id
            GROUP BY d.id, d.original_amount, d.current_amount
            HAVING ABS(difference) > 0.01
            ORDER BY d.id
        `);

        if (currentState.length === 0) {
            console.log('Barcha qarzlar to\'g\'ri! Hech qanday o\'zgarish talab qilinmaydi.\n');
            await connection.end();
            return;
        }

        console.log(`${currentState.length} ta qarzda xatolik topildi:\n`);
        console.table(currentState.map(row => ({
            'Qarz ID': row.id,
            'Original': `$${parseFloat(row.original_amount).toFixed(2)}`,
            'To\'langan': `$${parseFloat(row.total_paid).toFixed(2)}`,
            'Hozirgi': `$${parseFloat(row.current_amount).toFixed(2)}`,
            'Bo\'lishi kerak': `$${parseFloat(row.should_be).toFixed(2)}`,
            'Farq': `$${parseFloat(row.difference).toFixed(2)}`
        })));

        // 2. Foydalanuvchidan tasdiqlash (avtomatik tasdiqlash uchun process.env.AUTO_CONFIRM ishlatiladi)
        if (!process.env.AUTO_CONFIRM) {
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise(resolve => {
                readline.question('\nO\'zgarishlarni qo\'llashni xohlaysizmi? (ha/yo\'q): ', resolve);
            });
            readline.close();

            if (answer.toLowerCase() !== 'ha' && answer.toLowerCase() !== 'yes') {
                console.log('Bekor qilindi.');
                await connection.end();
                return;
            }
        }

        // 3. current_amount ni yangilash
        console.log('\n=== O\'ZGARISHLAR QO\'LLANMOQDA ===');
        const [updateResult] = await connection.execute(`
            UPDATE debts d
            LEFT JOIN (
                SELECT debt_id, SUM(amount) as total_paid
                FROM debt_payments
                GROUP BY debt_id
            ) dp ON d.id = dp.debt_id
            SET d.current_amount = d.original_amount - COALESCE(dp.total_paid, 0)
        `);

        console.log(`${updateResult.affectedRows} ta qarz yangilandi\n`);

        // 4. Natijalarni tekshirish
        console.log('=== YANGILANGAN HOLAT ===');
        const [finalState] = await connection.execute(`
            SELECT
                d.id,
                d.original_amount,
                COALESCE(SUM(dp.amount), 0) as total_paid,
                d.current_amount,
                (d.original_amount - COALESCE(SUM(dp.amount), 0)) as calculated,
                CASE
                    WHEN ABS(d.current_amount - (d.original_amount - COALESCE(SUM(dp.amount), 0))) < 0.01 THEN 'OK'
                    ELSE 'XATO'
                END as status
            FROM debts d
            LEFT JOIN debt_payments dp ON d.id = dp.debt_id
            GROUP BY d.id, d.original_amount, d.current_amount
            ORDER BY d.id
            LIMIT 20
        `);

        console.table(finalState.map(row => ({
            'Qarz ID': row.id,
            'Original': `$${parseFloat(row.original_amount).toFixed(2)}`,
            'To\'langan': `$${parseFloat(row.total_paid).toFixed(2)}`,
            'Current': `$${parseFloat(row.current_amount).toFixed(2)}`,
            'Hisoblangan': `$${parseFloat(row.calculated).toFixed(2)}`,
            'Status': row.status
        })));

        // 5. Xulosa
        const [summary] = await connection.execute(`
            SELECT
                COUNT(*) as total_debts,
                SUM(CASE WHEN ABS(d.current_amount - (d.original_amount - COALESCE(dp.total_paid, 0))) < 0.01 THEN 1 ELSE 0 END) as correct_debts,
                SUM(CASE WHEN ABS(d.current_amount - (d.original_amount - COALESCE(dp.total_paid, 0))) >= 0.01 THEN 1 ELSE 0 END) as incorrect_debts
            FROM debts d
            LEFT JOIN (
                SELECT debt_id, SUM(amount) as total_paid
                FROM debt_payments
                GROUP BY debt_id
            ) dp ON d.id = dp.debt_id
        `);

        console.log('\n=== XULOSA ===');
        console.log(`Jami qarzlar: ${summary[0].total_debts}`);
        console.log(`To'g'ri: ${summary[0].correct_debts}`);
        console.log(`Xato: ${summary[0].incorrect_debts}`);

        if (summary[0].incorrect_debts > 0) {
            console.log('\n⚠️  Diqqat: Ba\'zi qarzlar hali ham noto\'g\'ri!');
        } else {
            console.log('\n✅ Barcha qarzlar muvaffaqiyatli to\'g\'rilandi!');
        }

        await connection.end();
        console.log('\nMa\'lumotlar bazasidan uzildi.');

    } catch (error) {
        console.error('Xatolik yuz berdi:', error);
        if (connection) {
            await connection.end();
        }
        process.exit(1);
    }
}

// Scriptni ishga tushirish
if (require.main === module) {
    fixDebtAmounts();
}

module.exports = { fixDebtAmounts };
