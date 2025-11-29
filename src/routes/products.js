const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');
const { authMiddleware, apiAuthMiddleware } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// List products
router.get('/', ProductController.index);

// Create product
router.get('/create', ProductController.create);
router.post('/', ProductController.store);

// Edit product
router.get('/:id/edit', ProductController.edit);
router.post('/:id', ProductController.update);

// Delete product
router.post('/:id/delete', ProductController.delete);

// API routes
router.get('/api/search', ProductController.search);
router.get('/api/barcode/:barcode', ProductController.getByBarcode);

module.exports = router;
