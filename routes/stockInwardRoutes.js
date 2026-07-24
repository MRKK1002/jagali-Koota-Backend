const express = require('express');
const router = express.Router();
const stockInwardController = require('../controller/stockInvardController');

router.post('/', stockInwardController.createStockInward);
router.get('/', stockInwardController.getAllStockInwards);
router.get('/:id', stockInwardController.getStockInwardById);
router.put('/:id', stockInwardController.updateStockInward);
router.delete('/:id', stockInwardController.deleteStockInward);

module.exports = router;


