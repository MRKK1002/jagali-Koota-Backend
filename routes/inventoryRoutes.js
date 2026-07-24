const express = require('express');
const router = express.Router();
const {
  getInventoryByBranch,
  updateProductStock,
  bulkUpdateStock,
  getStockHistory,
  getLowStockProducts,
  exportInventory
} = require('../controller/inventoryController');

// @route   GET /api/v1/hotel/inventory/:branchId
// @desc    Get inventory for a specific branch
router.get('/:branchId', getInventoryByBranch);

// @route   PUT /api/v1/hotel/inventory/update/:productId
// @desc    Update stock for a single product
router.put('/update/:productId', updateProductStock);

// @route   PUT /api/v1/hotel/inventory/bulk-update
// @desc    Bulk update stock for multiple products
router.put('/bulk-update', bulkUpdateStock);

// @route   GET /api/v1/hotel/inventory/history/:productId
// @desc    Get stock history for a product
router.get('/history/:productId', getStockHistory);

// @route   GET /api/v1/hotel/inventory/low-stock/:branchId
// @desc    Get low stock products for a branch
router.get('/low-stock/:branchId', getLowStockProducts);

// @route   GET /api/v1/hotel/inventory/export/:branchId
// @desc    Export inventory to CSV
router.get('/export/:branchId', exportInventory);

module.exports = router;