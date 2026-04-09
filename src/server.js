const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const morgan = require('morgan');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { startDebtCron } = require('./cron/debt-markup');
const languageMiddleware = require('./middleware/language');

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const supplierRoutes = require('./routes/suppliers');
const sellerRoutes = require('./routes/sellers');
const customerRoutes = require('./routes/customers');
const stockIntakeRoutes = require('./routes/stock-intake');
const stockTransferRoutes = require('./routes/stock-transfer');
const salesRoutes = require('./routes/sales');
const debtRoutes = require('./routes/debts');
const dashboardRoutes = require('./routes/dashboard');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Language middleware - inject Uzbek translations into all views
app.use(languageMiddleware);

// Middleware to track the latest list view URL (for pagination/search preservation)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.xhr && !req.headers.accept?.includes('json')) {
        const pathParts = req.path.split('/').filter(Boolean);
        // Only track single-level paths like /products, /sales, /customers
        if (pathParts.length === 1 && !['login', 'logout', 'dashboard', 'api'].includes(pathParts[0])) {
            res.cookie(`last_${pathParts[0]}_url`, req.originalUrl, { maxAge: 900000, httpOnly: true });
        }
    }
    next();
});

// Make environment available to views
app.locals.env = process.env.NODE_ENV || 'development';

// Routes
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/products', productRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/sellers', sellerRoutes);
app.use('/customers', customerRoutes);
app.use('/stock-intake', stockIntakeRoutes);
app.use('/stock-transfer', stockTransferRoutes);
app.use('/sales', salesRoutes);
app.use('/debts', debtRoutes);
app.use('/reports', reportsRoutes);

// 404 handler
app.use((req, res) => {
    // Ensure lang is available even if middleware didn't run
    if (!res.locals.lang) {
        res.locals.lang = require('./config/lang-uz');
    }
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist',
        error: { status: 404 }
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    // Ensure lang is available even if middleware didn't run
    if (!res.locals.lang) {
        res.locals.lang = require('./config/lang-uz');
    }
    res.status(err.status || 500).render('error', {
        title: 'Error',
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.error('⚠️  Server starting without database connection');
        } else {
            // Apply migrations automatically matching schema constraints 
            const { query } = require('./config/database');
            try {
                // Check if profit_given exists in sales table
                const result = await query("SHOW COLUMNS FROM sales LIKE 'profit_given'");
                // MySQL2 promise wrapped custom 'query' returns the rows directly as result
                if (!result || result.length === 0) {
                    console.log('🔄 Applying migration: Adding profit_given to sales...');
                    await query("ALTER TABLE sales ADD COLUMN profit_given TINYINT(1) DEFAULT 0 COMMENT '0 = foyda berilmagan, 1 = foyda berilgan'");
                    await query("ALTER TABLE sales ADD COLUMN profit_given_at TIMESTAMP NULL COMMENT 'Foyda berilgan sana'");
                    console.log('✅ Migration profit_given applied successfully.');
                }

                // Check if is_deleted exists in products table
                const productDeletedCol = await query("SHOW COLUMNS FROM products LIKE 'is_deleted'");
                if (!productDeletedCol || productDeletedCol.length === 0) {
                    console.log('🔄 Applying migration: Adding is_deleted to products for soft delete...');
                    await query("ALTER TABLE products ADD COLUMN is_deleted TINYINT(1) DEFAULT 0 COMMENT '0 = faol, 1 = o''chirilgan'");
                    console.log('✅ Migration is_deleted applied successfully.');
                }

                // Check if sale_item_price_history table exists
                const priceHistoryTable = await query("SHOW TABLES LIKE 'sale_item_price_history'");
                if (!priceHistoryTable || priceHistoryTable.length === 0) {
                    console.log('🔄 Applying migration: Creating sale_item_price_history table...');
                    await query(`
                        CREATE TABLE IF NOT EXISTS sale_item_price_history (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            sale_item_id INT NOT NULL,
                            sale_id INT NOT NULL,
                            old_unit_price DECIMAL(12, 2) NOT NULL,
                            new_unit_price DECIMAL(12, 2) NOT NULL,
                            changed_by VARCHAR(100) NULL,
                            reason VARCHAR(500) NULL,
                            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
                            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
                            INDEX idx_sale_item (sale_item_id),
                            INDEX idx_sale (sale_id),
                            INDEX idx_changed_at (changed_at)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    `);
                    console.log('✅ Migration sale_item_price_history applied successfully.');
                }

                // Check if original_unit_price column exists in sale_items
                const originalPriceCol = await query("SHOW COLUMNS FROM sale_items LIKE 'original_unit_price'");
                if (!originalPriceCol || originalPriceCol.length === 0) {
                    console.log('🔄 Applying migration: Adding original_unit_price to sale_items...');
                    await query("ALTER TABLE sale_items ADD COLUMN original_unit_price DECIMAL(12, 2) NULL AFTER unit_price");
                    await query("UPDATE sale_items SET original_unit_price = unit_price WHERE original_unit_price IS NULL");
                    console.log('✅ Migration original_unit_price applied successfully.');
                }
            } catch (migrationError) {
                console.error('❌ Migration failed:', migrationError.message);
            }
        }

        // Start cron job for debt markup (DISABLED - using manual retroactive calculation instead)
        // startDebtCron();

        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('🚀 MegaDent POS System Started');
            console.log('='.repeat(50));
            console.log(`📡 Server running on: http://localhost:${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📊 Database: ${process.env.DB_NAME || 'megadent_pos'}`);
            console.log('='.repeat(50));

            // Server start bo'lganida Avtomatik Telegram Zaxirasini Yaratish (Agar ruxsat bo'lsa)
            const { triggerTelegramBackup } = require('./utils/telegramBackup');
            triggerTelegramBackup();
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
