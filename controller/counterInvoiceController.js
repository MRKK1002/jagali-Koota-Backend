const Invoice = require('../model/counterInvoiceModel');
const Branch = require('../model/Branch');
const BillNumberService = require('../services/billNumberService');
const BillNumberQueueService = require('../services/billNumberQueueService');
const asyncHandler = require('express-async-handler');

exports.addInvoice = asyncHandler(async (req, res) => {
  const { customerName, phoneNumber, branchId, date, time } = req.body;

  if (!customerName || !customerName.trim()) {
    res.status(400);
    throw new Error('Customer name is required');
  }
  if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
    res.status(400);
    throw new Error('Phone number must be a valid 10-digit number');
  }
  if (!branchId) {
    res.status(400);
    throw new Error('Branch is required');
  }
  if (!date || !time) {
    res.status(400);
    throw new Error('Date and time are required');
  }

  const branch = await Branch.findById(branchId);
  if (!branch) {
    res.status(404);
    throw new Error('Selected branch not found');
  }

  const invoiceNumber = await BillNumberService.getNextInvoiceNumber(branchId);

  const invoice = new Invoice({
    invoiceNumber,
    customerName: customerName.trim(),
    phoneNumber: phoneNumber.trim(),
    branch: branchId,
    date,
    time,
  });

  await invoice.save();
  const populatedInvoice = await Invoice.findById(invoice._id).populate('branch');

  res.status(201).json({
    message: 'Invoice created successfully',
    invoice: {
      invoiceNumber: populatedInvoice.invoiceNumber,
      customerName: populatedInvoice.customerName,
      phoneNumber: populatedInvoice.phoneNumber,
      branch: {
        id: populatedInvoice.branch._id,
        name: populatedInvoice.branch.name,
        location: populatedInvoice.branch.address,
      },
      date: populatedInvoice.date,
      time: populatedInvoice.time,
      id: populatedInvoice._id,
    },
  });
});

// Get next bill number for self-service (uses queue to handle concurrent requests)
exports.getNextBillNumber = asyncHandler(async (req, res) => {
  const { branchId } = req.params;
  const { category } = req.query;

  if (!branchId) {
    res.status(400);
    throw new Error('Branch ID is required');
  }

  const validCategories = ['Restaurant', 'Self Service', 'Temple Meals'];
  if (!category || !validCategories.includes(category)) {
    res.status(400);
    throw new Error(`Category is required and must be one of: ${validCategories.join(', ')}`);
  }

  const branch = await Branch.findById(branchId);
  if (!branch) {
    res.status(404);
    throw new Error('Branch not found');
  }

  try {
    const billNumber = await BillNumberQueueService.requestBillNumber(branchId, category);

    res.status(200).json({
      success: true,
      billNumber,
      branchId,
      category,
      date: new Date().toISOString().split('T')[0],
      message: 'Bill number generated successfully'
    });
  } catch (error) {
    console.error('Error generating bill number:', error);
    res.status(500);
    throw new Error('Failed to generate bill number');
  }
});

// Get next KOT number
exports.getNextKOTNumber = asyncHandler(async (req, res) => {
  const { branchId } = req.params;

  if (!branchId) {
    res.status(400);
    throw new Error('Branch ID is required');
  }

  const branch = await Branch.findById(branchId);
  if (!branch) {
    res.status(404);
    throw new Error('Branch not found');
  }

  try {
    const kotNumber = await BillNumberQueueService.requestKOTNumber(branchId);

    res.status(200).json({
      success: true,
      kotNumber,
      branchId,
      date: new Date().toISOString().split('T')[0],
      message: 'KOT number generated successfully'
    });
  } catch (error) {
    console.error('Error generating KOT number:', error);
    res.status(500);
    throw new Error('Failed to generate KOT number');
  }
});

// Get current counters for debugging
exports.getCurrentCounters = asyncHandler(async (req, res) => {
  const { branchId } = req.params;

  if (!branchId) {
    res.status(400);
    throw new Error('Branch ID is required');
  }

  try {
    const counters = await BillNumberService.getCurrentCounters(branchId);
    const queueStatus = BillNumberQueueService.getQueueStatus();
    res.status(200).json({
      success: true,
      branchId,
      counters,
      queueStatus,
      message: 'Current counters and queue status retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting current counters:', error);
    res.status(500);
    throw new Error('Failed to get current counters');
  }
});

// Get last bill number from today's orders — used by frontend to seed local counter after session clear.
// Checks both CounterOrder collection and BillCounter for the highest value.
exports.getLastBillNumber = asyncHandler(async (req, res) => {
  const { branchId } = req.params;
  const { category } = req.query;

  if (!branchId) {
    res.status(400);
    throw new Error('Branch ID is required');
  }

  try {
    const CounterOrder = require('../model/counterOrderModel');
    const BillCounter = require('../model/billCounterModel');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const query = {
      branch: branchId,
      invoiceNumber: { $ne: null, $exists: true },
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    };

    if (category) {
      query.categoryName = new RegExp(`^${category.trim()}$`, 'i');
    }

    const orders = await CounterOrder.find(query, { invoiceNumber: 1 }).lean();

    let maxBillNumber = 0;
    for (const order of orders) {
      const num = parseInt(order.invoiceNumber, 10);
      if (!isNaN(num) && num > maxBillNumber) {
        maxBillNumber = num;
      }
    }

    // Also check BillCounter as a fallback (covers cases where counter was incremented but order not yet saved)
    const today = now.toISOString().split('T')[0];
    const counterQuery = { branchId, date: today };
    if (category) counterQuery.category = category;
    const dbCounters = await BillCounter.find(counterQuery).lean();
    for (const c of dbCounters) {
      if (c.lastBillNumber > maxBillNumber) maxBillNumber = c.lastBillNumber;
    }

    res.status(200).json({
      success: true,
      branchId,
      category: category || null,
      lastBillNumber: maxBillNumber,
      message: 'Last bill number retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting last bill number:', error);
    res.status(500);
    throw new Error('Failed to get last bill number');
  }
});