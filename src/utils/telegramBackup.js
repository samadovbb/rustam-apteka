const mysqldump = require('mysqldump');
const FormData = require('form-data');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function triggerTelegramBackup() {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        // If credentials are not set in .env, just politely skip
        if (!token || !chatId) {
            console.log('⚠️ Telegram backup skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing in .env');
            return;
        }

        const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const dbName = process.env.DB_NAME || 'megadent_pos';
        const backupFileName = `backup_${dbName}_${dateStr}.sql`;
        const backupDir = path.join(__dirname, '../../backups');
        
        // Ensure backups directory exists
        if (!fs.existsSync(backupDir)){
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const backupFilePath = path.join(backupDir, backupFileName);

        console.log('📦 Baza zaxira qilinmoqda (Backup)...');
        // Dump database using the javascript-based wrapper
        await mysqldump({
            connection: {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: dbName,
                port: process.env.DB_PORT || 3306,
            },
            dumpToFile: backupFilePath,
        });
        
        console.log(`✅ Zaxira (.sql) fayli tayyor: ${backupFileName}`);
        
        // Send to Telegram
        console.log('🚀 Telegramga jonatilmoqda...');
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('document', fs.createReadStream(backupFilePath));
        form.append('caption', `📁 Avtomatik Server Zaxirasi (Backup) \n🗓 Sana: ${new Date().toLocaleString('uz-UZ')} \n💻 Tizim: MegaDent POS \n🛡 Server ishga tushirildi va holat yozib olindi.`);

        const response = await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form, {
            headers: {
                ...form.getHeaders()
            }
        });

        if (response.data && response.data.ok) {
            console.log('✅ Zaxira Telegram botga muvaffaqiyatli uzatildi!');
            
            // Delete local file to save disk space
            fs.unlinkSync(backupFilePath);
            console.log("🗑️ Lokal fayl xotirani tejash uchun o'chirib tashlandi.");
        } else {
            console.error('❌ Telegram javobida xatolik yuz berdi:', response.data);
        }

    } catch (error) {
        console.error('❌ Telegram Backup xatosi:', error.message);
    }
}

module.exports = { triggerTelegramBackup };
