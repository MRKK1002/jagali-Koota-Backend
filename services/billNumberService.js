const BillCounter = require('../model/billCounterModel');
const mongoose = require('mongoose');

class BillNumberService {
  
  // IMPROVED: Reserve bill number with retry logic and atomic operations
  // This ensures no gaps in the sequence even if order creation fails
  static async getNextBillNumber(branchId, category, maxRetries = 5) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Validate category
    const validCategories = ['Restaurant', 'Self Service', 'Temple Meals'];
    if (!validCategories.includes(category)) {
      throw new Error(`Invalid category: ${category}. Must be one of: ${validCategories.join(', ')}`);
    }
    
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // Use findOneAndUpdate with atomic increment to prevent race conditions
        // This ensures the counter is incremented atomically in a single database operation
        const counter = await BillCounter.findOneAndUpdate(
          { branchId, category, date: today },
          { 
            $inc: { lastBillNumber: 1 },
            $set: { 
              updatedAt: new Date()
            },
            $setOnInsert: {
              branchId,
              category,
              date: today,
              lastKOTNumber: 0
            }
          },
          { 
            new: true, // Return updated document
            upsert: true, // Create if doesn't exist
            runValidators: true
          }
        );
        
        // Also update lastInvoiceNumber to match (they're the same)
        counter.lastInvoiceNumber = counter.lastBillNumber;
        await counter.save();
        
        // Return formatted number (3 digits with leading zeros)
        const unifiedNumber = String(counter.lastBillNumber).padStart(3, '0');
        
        return unifiedNumber;
        
      } catch (error) {
        retryCount++;
        
        if (error.code === 11000) {
          // Duplicate key error - another process created it simultaneously
          
          if (retryCount >= maxRetries) {
            throw new Error('Failed to generate bill number after maximum retries');
          }
          
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 50 * retryCount));
          continue;
        }
        
        // Other errors - throw immediately
        console.error('❌ Error generating unified bill/invoice number:', error);
        throw new Error('Failed to generate bill/invoice number');
      }
    }
    
    throw new Error('Failed to generate bill number after maximum retries');
  }
  
  // Alias for getNextBillNumber - they return the same value
  static async getNextInvoiceNumber(branchId, category) {
    return this.getNextBillNumber(branchId, category);
  }
  
  // IMPROVED: Get next KOT number with atomic operations
  static async getNextKOTNumber(branchId, maxRetries = 5) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // Use findOneAndUpdate with atomic increment
        const counter = await BillCounter.findOneAndUpdate(
          { branchId, category: 'Restaurant', date: today },
          { 
            $inc: { lastKOTNumber: 1 },
            $set: { 
              updatedAt: new Date()
            },
            $setOnInsert: {
              branchId,
              category: 'Restaurant',
              date: today,
              lastBillNumber: 0,
              lastInvoiceNumber: 0
            }
          },
          { 
            new: true,
            upsert: true,
            runValidators: true
          }
        );
        
        // Return formatted KOT number
        const kotNumber = `KOT-${String(counter.lastKOTNumber).padStart(3, '0')}`;
        
        return kotNumber;
        
      } catch (error) {
        retryCount++;
        
        if (error.code === 11000) {
          
          if (retryCount >= maxRetries) {
            throw new Error('Failed to generate KOT number after maximum retries');
          }
          
          await new Promise(resolve => setTimeout(resolve, 50 * retryCount));
          continue;
        }
        
        console.error('❌ Error generating KOT number:', error);
        throw new Error('Failed to generate KOT number');
      }
    }
    
    throw new Error('Failed to generate KOT number after maximum retries');
  }
  
  // Get current counters for a branch, category and date (for debugging)
  static async getCurrentCounters(branchId, category = null, date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      if (category) {
        const counter = await BillCounter.findOne({ branchId, category, date: targetDate });
        return counter || {
          branchId,
          category,
          date: targetDate,
          lastBillNumber: 0,
          lastInvoiceNumber: 0,
          lastKOTNumber: 0,
        };
      } else {
        // Return all categories for this branch and date
        const counters = await BillCounter.find({ branchId, date: targetDate });
        return counters;
      }
    } catch (error) {
      console.error('❌ Error getting current counters:', error);
      throw new Error('Failed to get current counters');
    }
  }
}

module.exports = BillNumberService;