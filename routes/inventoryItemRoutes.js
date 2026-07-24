const express = require('express');
const router = express.Router();
const inventoryItemController = require('../controller/inventoryItemController');

// CRUD routes
router.post('/', inventoryItemController.createInventoryItem);
router.get('/', inventoryItemController.getAllInventoryItems);
router.get('/:id', inventoryItemController.getInventoryItem);
router.put('/:id', inventoryItemController.updateInventoryItem);
router.delete('/:id', inventoryItemController.deleteInventoryItem);

// Specialized procurement routes
router.get('/low-stock', inventoryItemController.getLowStockItems);
router.post('/:id/movement', inventoryItemController.recordStockMovement);
router.post('/:id/allocate', inventoryItemController.allocateToProject);
router.get('/reports/valuation', inventoryItemController.getInventoryValuation);

module.exports = router;