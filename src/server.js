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
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
