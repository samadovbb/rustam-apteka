const express = require('express');
const router = express.Router();
const SellerController = require('../controllers/sellerController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', SellerController.index);
router.get('/create', SellerController.create);
router.post('/', SellerController.store);
router.get('/:id/view', SellerController.view);
router.get('/:id/edit', SellerController.edit);
router.post('/:id', SellerController.update);
router.post('/:id/delete', SellerController.delete);
router.get('/:id/inventory', SellerController.inventory);

// API routes
router.get('/api/search', SellerController.search);

module.exports = router;
