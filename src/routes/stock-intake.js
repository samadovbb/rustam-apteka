const express = require('express');
const router = express.Router();
const StockIntakeController = require('../controllers/stockIntakeController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', StockIntakeController.index);
router.get('/create', StockIntakeController.create);
router.post('/', StockIntakeController.store);
router.get('/:id', StockIntakeController.view);

// API routes
router.get('/api/latest-date', StockIntakeController.getLatestDate);

module.exports = router;
