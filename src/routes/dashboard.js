const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { authMiddleware } = require('../middleware/auth');

// All dashboard routes require authentication
router.use(authMiddleware);

// Dashboard home
router.get('/', DashboardController.index);

module.exports = router;
