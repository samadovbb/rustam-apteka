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
router.post('/:id/calculate-markup', SalesController.calculateMarkup);
router.put('/:id/date', SalesController.updateSaleDate);
router.put('/:id/payment/:payment_id/date', SalesController.updatePaymentDate);
router.delete('/:id', SalesController.delete);

// New features: change seller and return items
router.put('/:id/seller', SalesController.changeSeller);
router.post('/:id/return', SalesController.returnItems);
router.get('/:id/returns', SalesController.getReturns);

// Export to Excel
router.get('/:id/export', SalesController.exportToExcel);

// API routes
router.get('/api/seller/:seller_id/inventory', SalesController.getSellerInventory);
router.get('/api/latest-date', SalesController.getLatestDate);

module.exports = router;
