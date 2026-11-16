const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

/**
 * Telegram xabarnomalari (admin uchun):
 *  - har bir sotuvdan keyin chek ko'rinishidagi xabar
 *  - muddati kelgan qarzlar ro'yxati (har kuni + bot buyrug'i orqali)
 *
 * .env:
 *  TELEGRAM_BOT_TOKEN       - bot tokeni (majburiy)
 *  TELEGRAM_ADMIN_CHAT_ID   - admin chat ID (bo'lmasa TELEGRAM_CHAT_ID ishlatiladi)
 *  TELEGRAM_DEBT_CRON       - kunlik qarzlar ro'yxati jadvali (default: har kuni 09:00)
 *  TELEGRAM_BOT_POLLING     - 'false' bo'lsa bot buyruqlarni tinglamaydi
 */

const MAX_MESSAGE_LENGTH = 4000;

const getToken = () => process.env.TELEGRAM_BOT_TOKEN;
const getAdminChatId = () => process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
const isConfigured = () => !!(getToken() && getAdminChatId());
const apiUrl = (method) => `https://api.telegram.org/bot${getToken()}/${method}`;

// ---------- formatting helpers ----------

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (value) => {
    const d = new Date(value);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};
const formatTime = (value) => {
    const d = new Date(value);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
// 20.50 -> "20.5", 16.00 -> "16"
const formatNumber = (value) => String(parseFloat((parseFloat(value) || 0).toFixed(2)));

const PAYMENT_METHODS = {
    naqt: 'NAQD',
    card: 'KARTA',
    transfer: "O'TKAZMA",
    other: 'BOSHQA'
};

// ---------- sending ----------

// Split long text into Telegram-sized chunks on line boundaries
const splitMessage = (text) => {
    const chunks = [];
    let current = '';
    for (const line of text.split('\n')) {
        if (current.length + line.length + 1 > MAX_MESSAGE_LENGTH) {
            chunks.push(current);
            current = '';
        }
        current += (current ? '\n' : '') + line;
    }
    if (current) chunks.push(current);
    return chunks;
};

// Returns true on success. Never throws - the POS must keep working offline.
const sendMessage = async (text, chatId = getAdminChatId()) => {
    if (!getToken() || !chatId) {
        return false;
    }

    try {
        for (const chunk of splitMessage(text)) {
            await axios.post(apiUrl('sendMessage'), { chat_id: chatId, text: chunk }, { timeout: 15000 });
        }
        return true;
    } catch (error) {
        const reason = error.response?.data?.description || error.message;
        console.error('❌ Telegram xabar yuborilmadi:', reason);
        return false;
    }
};

// ---------- sale notification ----------

const buildSaleMessage = (sale, items, payments) => {
    const saleDate = new Date(sale.sale_date);
    const now = new Date();
    // Sale date usually comes from a date picker (no time part) - show the real time for today's sales
    const isToday = formatDate(saleDate) === formatDate(now);
    const dateLine = isToday
        ? `${formatTime(now)} ${formatDate(now)}`
        : `${formatDate(saleDate)} (kiritildi: ${formatTime(now)} ${formatDate(now)})`;

    const total = parseFloat(sale.total_amount) || 0;
    const paid = parseFloat(sale.paid_amount) || 0;
    const debt = Math.max(0, total - paid);

    const lines = [
        `🧾 Sotuv #${sale.id}`,
        '',
        `Sana: ${dateLine}`,
        `Sotuvchi: ${sale.seller_name}`,
        `Mijoz: ${sale.customer_name}`,
        `Tel: ${sale.customer_phone}`,
        ''
    ];

    items.forEach((item, index) => {
        const quantity = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unit_price) || 0;
        lines.push(`${index + 1}. ${item.product_name}`);
        lines.push(`    ${formatNumber(quantity)} x ${formatNumber(price)} = ${formatNumber(quantity * price)}`);
        lines.push('');
    });

    lines.push(`JAMI: ${formatNumber(total)}`);
    lines.push(`TO'LANDI: ${formatNumber(paid)}`);
    lines.push(`QARZ: ${formatNumber(debt)}`);

    const method = payments[0]?.payment_method;
    lines.push(`To'lov: ${paid > 0 ? (PAYMENT_METHODS[method] || 'NAQD') : 'QARZGA'}`);

    return lines.join('\n');
};

const notifySale = async (saleId) => {
    if (!isConfigured()) {
        return false;
    }

    try {
        const Sale = require('../models/Sale');
        const sale = await Sale.findById(saleId);
        if (!sale) {
            return false;
        }

        const [items, payments] = await Promise.all([
            Sale.getItems(saleId),
            Sale.getPayments(saleId)
        ]);

        let text = buildSaleMessage(sale, items, payments);

        if (sale.debt_id) {
            const Debt = require('../models/Debt');
            const debt = await Debt.findById(sale.debt_id);
            if (debt?.grace_end_date) {
                text += `\nQarz muddati: ${formatDate(debt.grace_end_date)}`;
            }
        }

        return await sendMessage(text);
    } catch (error) {
        console.error('❌ Sotuv haqida Telegram xabari xatosi:', error.message);
        return false;
    }
};

// ---------- due debts ----------

const buildDueDebtsMessage = (debts, title) => {
    const lines = [`📋 ${title} (${formatDate(new Date())})`, ''];

    if (debts.length === 0) {
        lines.push("✅ Ro'yxat bo'sh.");
        return lines.join('\n');
    }

    let total = 0;
    debts.forEach((debt, index) => {
        total += debt.amount_due;
        const days = parseInt(debt.days_overdue) || 0;
        let dueNote = 'bugun';
        if (days > 0) dueNote = `${days} kun o'tdi`;
        if (days < 0) dueNote = `${Math.abs(days)} kun qoldi`;

        lines.push(`${index + 1}. ${debt.customer_name} — ${debt.customer_phone}`);
        lines.push(`    Sotuv #${debt.sale_id} (${formatDate(debt.sale_date)}), sotuvchi: ${debt.seller_name}`);
        lines.push(`    Muddat: ${formatDate(debt.grace_end_date)} (${dueNote})`);
        lines.push(`    Qoldiq: $${formatNumber(debt.amount_due)}`);
        lines.push('');
    });

    lines.push(`Jami: ${debts.length} ta qarz, $${formatNumber(total)}`);
    return lines.join('\n');
};

const DUE_RANGES = {
    overdue: { title: 'Muddati kelgan qarzlar', options: { daysAhead: 0 } },
    7: { title: '7 kun ichida muddati keladigan qarzlar', options: { daysAhead: 7, onlyUpcoming: true } },
    30: { title: '30 kun ichida muddati keladigan qarzlar', options: { daysAhead: 30, onlyUpcoming: true } }
};

const getDueRange = (range) => DUE_RANGES[range] || DUE_RANGES.overdue;

const sendDueDebts = async (range = 'overdue', chatId = getAdminChatId()) => {
    const Debt = require('../models/Debt');
    const { title, options } = getDueRange(range);
    const debts = await Debt.getDueDebts(options);
    const sent = await sendMessage(buildDueDebtsMessage(debts, title), chatId);
    return { sent, count: debts.length };
};

// ---------- bot commands (long polling) ----------

const HELP_TEXT = [
    'MegaDent POS bot',
    '',
    '/qarzlar — muddati kelgan qarzlar',
    '/yaqin — 7 kun ichida muddati keladigan qarzlar',
    '/oy — 30 kun ichida muddati keladigan qarzlar'
].join('\n');

const handleCommand = async (message) => {
    // Only the admin chat may query the bot
    if (String(message.chat.id) !== String(getAdminChatId())) {
        return;
    }
    // Skip commands queued while the server was off
    if (Date.now() / 1000 - message.date > 120) {
        return;
    }

    const command = (message.text || '').trim().split(/\s+/)[0].split('@')[0].toLowerCase();

    try {
        if (command === '/qarzlar') {
            await sendDueDebts('overdue', message.chat.id);
        } else if (command === '/yaqin') {
            await sendDueDebts('7', message.chat.id);
        } else if (command === '/oy') {
            await sendDueDebts('30', message.chat.id);
        } else if (command === '/start' || command === '/help') {
            await sendMessage(HELP_TEXT, message.chat.id);
        }
    } catch (error) {
        console.error('❌ Telegram buyrug\'ini bajarishda xato:', error.message);
        await sendMessage('Xatolik yuz berdi: ' + error.message, message.chat.id);
    }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const startPolling = async () => {
    let offset = 0;
    let lastError = null;

    while (true) {
        try {
            const response = await axios.get(apiUrl('getUpdates'), {
                params: { offset, timeout: 30, allowed_updates: JSON.stringify(['message']) },
                timeout: 40000
            });

            lastError = null;
            for (const update of response.data.result || []) {
                offset = update.update_id + 1;
                if (update.message?.text) {
                    await handleCommand(update.message);
                }
            }
        } catch (error) {
            const status = error.response?.status;
            const reason = error.response?.data?.description || error.code || error.message;

            // Log each distinct problem once, not on every retry (e.g. while offline)
            if (reason !== lastError) {
                console.error('⚠️ Telegram bot tinglashda xato:', reason);
                if (status === 409) {
                    console.error('   Shu token bilan boshqa joyda ham bot ishlayapti (yoki webhook o\'rnatilgan).');
                }
                lastError = reason;
            }

            if (status === 401 || status === 404) {
                console.error('   Token noto\'g\'ri — bot buyruqlari o\'chirildi.');
                return;
            }
            await sleep(status === 409 ? 60000 : 15000);
        }
    }
};

// ---------- startup ----------

const start = () => {
    if (!isConfigured()) {
        console.log('⚠️ Telegram xabarnomalari o\'chiq: TELEGRAM_BOT_TOKEN yoki chat ID .env da yo\'q');
        return;
    }

    const schedule = process.env.TELEGRAM_DEBT_CRON || '0 9 * * *';
    if (cron.validate(schedule)) {
        cron.schedule(schedule, async () => {
            try {
                await sendDueDebts('overdue');
            } catch (error) {
                console.error('❌ Kunlik qarzlar ro\'yxatini yuborishda xato:', error.message);
            }
        }, { timezone: 'Asia/Tashkent' });
        console.log(`⏰ Muddati kelgan qarzlar Telegramga yuboriladi: ${schedule} (Asia/Tashkent)`);
    } else {
        console.error('❌ TELEGRAM_DEBT_CRON noto\'g\'ri formatda:', schedule);
    }

    if (process.env.TELEGRAM_BOT_POLLING !== 'false') {
        startPolling();
        console.log('🤖 Telegram bot buyruqlarni tinglayapti: /qarzlar, /yaqin, /oy');
    }
};

module.exports = {
    start,
    isConfigured,
    sendMessage,
    notifySale,
    sendDueDebts,
    getDueRange
};
