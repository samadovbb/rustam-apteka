const express = require('express');
const router = express.Router();
const SupplierController = require('../controllers/supplierController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', SupplierController.index);
router.get('/create', SupplierController.create);
router.post('/', SupplierController.store);
router.get('/:id/view', SupplierController.view);
router.get('/:id/edit', SupplierController.edit);
router.post('/:id', SupplierController.update);
router.post('/:id/delete', SupplierController.delete);

// API routes
router.get('/api/search', SupplierController.search);

module.exports = router;
