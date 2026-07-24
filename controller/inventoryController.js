const asyncHandler = require('express-async-handler');
const Menu = require('../model/menuModel');
const StockHistory = require('../model/stockHistoryModel');
const Branch = require('../model/Branch');
const Order = require('../model/orderModel');

// @desc    Get inventory for a specific branch
// @route   GET /api/v1/hotel/inventory/:branchId
// @access  Private
const getInventoryByBranch = asyncHandler(async (req, res) => {
  const { branchId } = req.params;
  const { categoryId, status, lowStock } = req.query;

  // Build filter object
  let filter = { branchId };

  if (categoryId) {
    filter.categoryId = categoryId;
  }

  if (status === 'out_of_stock') {
    filter.stock = { $lte: 0 };
  } else if (status === 'low_stock') {
    filter.stock = { $gt: 0, $lte: 5 }; // Assuming lowStockAlert default is 5
  }

  if (lowStock === 'true') {
    filter.$expr = {
      $lte: ['$stock', '$lowStockAlert']
    };
  }

  const inventory = await Menu.find(filter)
    .populate('categoryId', 'name')
    .populate('branchId', 'name')
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    data: inventory,
    count: inventory.length
  });
});

// @desc    Update stock for a single product
// @route   PUT /api/v1/hotel/inventory/update/:productId
// @access  Private
const updateProductStock = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    const { stock, changeType, notes } = req.body;
    const updatedBy = req.user?.id || req.admin?.id || 'system';

    if (!stock && stock !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock value is required'
      });
    }

    const product = await Menu.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const oldStock = product.stock;
    const newStock = parseInt(stock);

    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock cannot be negative'
      });
    }

    // Update product stock
    product.stock = newStock;
    product.isActive = newStock > 0;
    await product.save();

    // Log stock history (only if StockHistory model exists)
    try {
      await StockHistory.create({
        productId: product._id,
        branchId: product.branchId,
        updatedBy,
        oldStock,
        newStock,
        changeType: changeType || 'manual',
        quantity: Math.abs(newStock - oldStock),
        notes
      });
    } catch (historyError) {

      // Continue without failing the main operation
    }

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: {
        productId: product._id,
        oldStock,
        newStock,
        isActive: product.isActive
      }
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// @desc    Bulk update stock for multiple products
// @route   PUT /api/v1/hotel/inventory/bulk-update
// @access  Private
const bulkUpdateStock = asyncHandler(async (req, res) => {
  try {
    const { products } = req.body;
    const updatedBy = req.user?.id || req.admin?.id || 'system';

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Products array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const item of products) {
      try {
        const { productId, stock, changeType, notes } = item;

        if (!productId || (stock === undefined || stock === null)) {
          errors.push({
            productId,
            error: 'Product ID and stock are required'
          });
          continue;
        }

        const product = await Menu.findById(productId);
        if (!product) {
          errors.push({
            productId,
            error: 'Product not found'
          });
          continue;
        }

        const oldStock = product.stock;
        const newStock = parseInt(stock);

        if (newStock < 0) {
          errors.push({
            productId,
            error: 'Stock cannot be negative'
          });
          continue;
        }

        // Update product stock
        product.stock = newStock;
        product.isActive = newStock > 0;
        await product.save();

        // Log stock history (only if StockHistory model exists)
        try {
          await StockHistory.create({
            productId: product._id,
            branchId: product.branchId,
            updatedBy,
            oldStock,
            newStock,
            changeType: changeType || 'bulk_update',
            quantity: Math.abs(newStock - oldStock),
            notes
          });
        } catch (historyError) {

          // Continue without failing the main operation
        }

        results.push({
          productId: product._id,
          oldStock,
          newStock,
          isActive: product.isActive
        });
      } catch (error) {
        errors.push({
          productId: item.productId,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Updated ${results.length} products successfully`,
      data: {
        updated: results,
        errors: errors
      }
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// @desc    Get stock history for a product
// @route   GET /api/v1/hotel/inventory/history/:productId
// @access  Private
const getStockHistory = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const history = await StockHistory.find({ productId })
    .populate('updatedBy', 'name email')
    .populate('orderId', 'orderNumber')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await StockHistory.countDocuments({ productId });

  res.status(200).json({
    success: true,
    data: history,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get low stock products for a branch
// @route   GET /api/v1/hotel/inventory/low-stock/:branchId
// @access  Private
const getLowStockProducts = asyncHandler(async (req, res) => {
  const { branchId } = req.params;

  const lowStockProducts = await Menu.find({
    branchId,
    $expr: {
      $lte: ['$stock', '$lowStockAlert']
    },
    stock: { $gt: 0 }
  })
    .populate('categoryId', 'name')
    .populate('branchId', 'name')
    .sort({ stock: 1 });

  res.status(200).json({
      success: true,
    data: lowStockProducts,
    count: lowStockProducts.length
  });
});

// @desc    Export inventory to CSV
// @route   GET /api/v1/hotel/inventory/export/:branchId
// @access  Private
const exportInventory = asyncHandler(async (req, res) => {
  const { branchId } = req.params;

  const inventory = await Menu.find({ branchId })
    .populate('categoryId', 'name')
    .populate('branchId', 'name')
    .sort({ name: 1 });

  // Convert to CSV format
  const csvHeader = 'Product Name,Category,Branch,Current Stock,Low Stock Alert,Status,Price\n';
  const csvData = inventory.map(item => {
    const status = item.stock > 0 ? 'Available' : 'Out of Stock';
    return `"${item.name}","${item.categoryId?.name || 'N/A'}","${item.branchId?.name || 'N/A'}",${item.stock},${item.lowStockAlert},"${status}",${item.price}`;
  }).join('\n');

  const csv = csvHeader + csvData;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="inventory-${branchId}-${new Date().toISOString().split('T')[0]}.csv"`);
  res.status(200).send(csv);
});

module.exports = {
  getInventoryByBranch,
  updateProductStock,
  bulkUpdateStock,
  getStockHistory,
  getLowStockProducts,
  exportInventory
};