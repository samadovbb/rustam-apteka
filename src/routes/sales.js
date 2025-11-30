const express = require('express');
const router = express.Router();
const SalesController = require('../controllers/salesController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', SalesController.index);
router.get('/create', SalesController.create);
router.post('/', SalesController.store);
router.get('/:id', SalesController.view);
router.post('/:id/payment', SalesController.addPayment);

// API routes
router.get('/api/seller/:seller_id/inventory', SalesController.getSellerInventory);
router.get('/api/latest-date', SalesController.getLatestDate);

module.exports = router;
