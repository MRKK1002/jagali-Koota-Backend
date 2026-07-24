const express = require('express');
const router = express.Router();
const BillCounter = require('../model/billCounterModel');
const asyncHandler = require('express-async-handler');

// Reset bill numbers for today
router.post('/reset-today', asyncHandler(async (req, res) => {
  try {
    const { branchId, category, resetKOT = true } = req.body;
    
    const today = new Date().toISOString().split('T')[0];

    // Build query filter
    const filter = { date: today };
    if (branchId) filter.branchId = branchId;
    if (category) filter.category = category;
    
    // Find matching counters before reset
    const countersBeforeReset = await BillCounter.find(filter).populate('branchId', 'name');
    
    if (countersBeforeReset.length === 0) {
      return res.json({
        success: true,
        message: 'No bill counters found for today. No reset needed.',
        countersReset: 0,
        nextBillNumber: '001'
      });
    }
    
    // Prepare update object
    const updateFields = {
      lastBillNumber: 0,
      lastInvoiceNumber: 0,
      updatedAt: new Date()
    };
    
    if (resetKOT) {
      updateFields.lastKOTNumber = 0;
    }
    
    // Reset counters
    const result = await BillCounter.updateMany(filter, { $set: updateFields });
    
    // Get counters after reset for verification
    const countersAfterReset = await BillCounter.find(filter).populate('branchId', 'name');

    res.json({
      success: true,
      message: `Successfully reset ${result.modifiedCount} bill counter(s) to 0`,
      countersReset: result.modifiedCount,
      nextBillNumber: '001',
      resetDetails: {
        date: today,
        branchId: branchId || 'All branches',
        category: category || 'All categories',
        resetKOT: resetKOT
      },
      countersBeforeReset: countersBeforeReset.map(counter => ({
        branchId: counter.branchId._id,
        branchName: counter.branchId.name,
        category: counter.category,
        lastBillNumber: counter.lastBillNumber,
        lastInvoiceNumber: counter.lastInvoiceNumber,
        lastKOTNumber: counter.lastKOTNumber
      })),
      countersAfterReset: countersAfterReset.map(counter => ({
        branchId: counter.branchId._id,
        branchName: counter.branchId.name,
        category: counter.category,
        lastBillNumber: counter.lastBillNumber,
        lastInvoiceNumber: counter.lastInvoiceNumber,
        lastKOTNumber: counter.lastKOTNumber
      }))
    });
    
  } catch (error) {
    console.error('❌ API: Error resetting bill numbers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset bill numbers',
      error: error.message
    });
  }
}));

// Get current bill counters status
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const { branchId, category, date } = req.query;
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Build query filter
    const filter = { date: targetDate };
    if (branchId) filter.branchId = branchId;
    if (category) filter.category = category;
    
    const counters = await BillCounter.find(filter).populate('branchId', 'name');
    
    res.json({
      success: true,
      date: targetDate,
      counters: counters.map(counter => ({
        branchId: counter.branchId._id,
        branchName: counter.branchId.name,
        category: counter.category,
        lastBillNumber: counter.lastBillNumber,
        lastInvoiceNumber: counter.lastInvoiceNumber,
        lastKOTNumber: counter.lastKOTNumber,
        nextBillNumber: String(counter.lastBillNumber + 1).padStart(3, '0'),
        nextInvoiceNumber: String(counter.lastInvoiceNumber + 1).padStart(3, '0'),
        nextKOTNumber: `KOT-${String(counter.lastKOTNumber + 1).padStart(3, '0')}`,
        createdAt: counter.createdAt,
        updatedAt: counter.updatedAt
      }))
    });
    
  } catch (error) {
    console.error('❌ API: Error getting bill counter status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bill counter status',
      error: error.message
    });
  }
}));

// Reset bill numbers for specific date
router.post('/reset-date', asyncHandler(async (req, res) => {
  try {
    const { date, branchId, category, resetKOT = true } = req.body;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required (format: YYYY-MM-DD)'
      });
    }

    // Build query filter
    const filter = { date };
    if (branchId) filter.branchId = branchId;
    if (category) filter.category = category;
    
    // Find matching counters before reset
    const countersBeforeReset = await BillCounter.find(filter).populate('branchId', 'name');
    
    if (countersBeforeReset.length === 0) {
      return res.json({
        success: true,
        message: `No bill counters found for ${date}. No reset needed.`,
        countersReset: 0,
        nextBillNumber: '001'
      });
    }
    
    // Prepare update object
    const updateFields = {
      lastBillNumber: 0,
      lastInvoiceNumber: 0,
      updatedAt: new Date()
    };
    
    if (resetKOT) {
      updateFields.lastKOTNumber = 0;
    }
    
    // Reset counters
    const result = await BillCounter.updateMany(filter, { $set: updateFields });
    
    // Get counters after reset for verification
    const countersAfterReset = await BillCounter.find(filter).populate('branchId', 'name');

    res.json({
      success: true,
      message: `Successfully reset ${result.modifiedCount} bill counter(s) to 0 for ${date}`,
      countersReset: result.modifiedCount,
      nextBillNumber: '001',
      resetDetails: {
        date: date,
        branchId: branchId || 'All branches',
        category: category || 'All categories',
        resetKOT: resetKOT
      },
      countersBeforeReset: countersBeforeReset.map(counter => ({
        branchId: counter.branchId._id,
        branchName: counter.branchId.name,
        category: counter.category,
        lastBillNumber: counter.lastBillNumber,
        lastInvoiceNumber: counter.lastInvoiceNumber,
        lastKOTNumber: counter.lastKOTNumber
      })),
      countersAfterReset: countersAfterReset.map(counter => ({
        branchId: counter.branchId._id,
        branchName: counter.branchId.name,
        category: counter.category,
        lastBillNumber: counter.lastBillNumber,
        lastInvoiceNumber: counter.lastInvoiceNumber,
        lastKOTNumber: counter.lastKOTNumber
      }))
    });
    
  } catch (error) {
    console.error('❌ API: Error resetting bill numbers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset bill numbers',
      error: error.message
    });
  }
}));

module.exports = router;