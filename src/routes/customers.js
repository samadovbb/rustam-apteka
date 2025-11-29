const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/customerController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', CustomerController.index);
router.get('/create', CustomerController.create);
router.post('/', CustomerController.store);
router.get('/:id/edit', CustomerController.edit);
router.post('/:id', CustomerController.update);
router.post('/:id/delete', CustomerController.delete);

// API routes
router.get('/api/search', CustomerController.search);
router.get('/api/phone/:phone', CustomerController.getByPhone);

module.exports = router;
