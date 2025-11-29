const express = require('express');
const router = express.Router();
const StockTransferController = require('../controllers/stockTransferController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', StockTransferController.index);
router.get('/create', StockTransferController.create);
router.post('/', StockTransferController.store);
router.get('/:id', StockTransferController.view);

module.exports = router;
