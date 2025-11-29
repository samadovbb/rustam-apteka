const express = require('express');
const router = express.Router();
const DebtController = require('../controllers/debtController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', DebtController.index);
router.get('/:id', DebtController.view);
router.post('/:id/apply-markup', DebtController.applyManualMarkup);
router.post('/:id/status', DebtController.updateStatus);

module.exports = router;
