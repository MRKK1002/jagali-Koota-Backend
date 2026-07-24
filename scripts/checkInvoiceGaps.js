/**
 * Invoice Number Gap Checker
 * 
 * This script checks for gaps in invoice numbers and helps diagnose
 * why numbers might be skipped (e.g., 015 -> 017, missing 016)
 * 
 * Usage: node scripts/checkInvoiceGaps.js
 */

const mongoose = require('mongoose');
const CounterOrder = require('../model/counterOrderModel');
const BillCounter = require('../model/billCounterModel');
require('dotenv').config();

async function checkInvoiceGaps() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-virat', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to database\n');
    
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 Checking invoice numbers for date: ${today}\n`);
    
    // Get all bill counters for today
    const counters = await BillCounter.find({ date: today }).populate('branchId', 'name');
    
    console.log('📊 Current Bill Counters:');
    console.log('═'.repeat(80));
    
    for (const counter of counters) {
      const branchName = counter.branchId?.name || 'Unknown Branch';
      console.log(`\n🏢 Branch: ${branchName}`);
      console.log(`📂 Category: ${counter.category}`);
      console.log(`🧾 Last Bill Number: ${counter.lastBillNumber}`);
      console.log(`🍽️  Last KOT Number: ${counter.lastKOTNumber}`);
      
      // Get all orders for this branch and category today
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      
      const orders = await CounterOrder.find({
        branch: counter.branchId._id,
        categoryName: counter.category,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        invoiceNumber: { $exists: true, $ne: null, $ne: '' }
      }).sort({ invoiceNumber: 1 }).select('invoiceNumber paymentStatus orderStatus createdAt');
      
      console.log(`\n📋 Orders with Invoice Numbers: ${orders.length}`);
      
      if (orders.length > 0) {
        // Extract invoice numbers and check for gaps
        const invoiceNumbers = orders.map(o => {
          const num = o.invoiceNumber;
          // Handle both numeric and string formats
          if (typeof num === 'string') {
            return parseInt(num.replace(/\D/g, '')) || 0;
          }
          return parseInt(num) || 0;
        }).filter(n => n > 0).sort((a, b) => a - b);
        
        console.log(`\n🔢 Invoice Numbers Used: ${invoiceNumbers.join(', ')}`);
        
        // Check for gaps
        const gaps = [];
        for (let i = 1; i < invoiceNumbers.length; i++) {
          const current = invoiceNumbers[i];
          const previous = invoiceNumbers[i - 1];
          
          if (current - previous > 1) {
            // Found a gap
            for (let missing = previous + 1; missing < current; missing++) {
              gaps.push(missing);
            }
          }
        }
        
        if (gaps.length > 0) {
          console.log(`\n⚠️  GAPS FOUND: Missing invoice numbers: ${gaps.join(', ')}`);
          console.log(`   Total gaps: ${gaps.length}`);
          
          // Check if these numbers exist in database with different status
          for (const gapNum of gaps) {
            const gapNumStr = String(gapNum).padStart(3, '0');
            const missingOrder = await CounterOrder.findOne({
              branch: counter.branchId._id,
              categoryName: counter.category,
              $or: [
                { invoiceNumber: gapNumStr },
                { invoiceNumber: gapNum },
                { invoiceNumber: String(gapNum) }
              ]
            });
            
            if (missingOrder) {
              console.log(`   ℹ️  Invoice ${gapNumStr} exists but status: ${missingOrder.paymentStatus}/${missingOrder.orderStatus}`);
            } else {
              console.log(`   ❌ Invoice ${gapNumStr} not found in database (number was generated but order not saved)`);
            }
          }
        } else {
          console.log(`\n✅ No gaps found - all invoice numbers are sequential`);
        }
        
        // Check if counter matches highest invoice number
        const highestInvoice = Math.max(...invoiceNumbers);
        if (counter.lastBillNumber !== highestInvoice) {
          console.log(`\n⚠️  Counter mismatch: Counter shows ${counter.lastBillNumber} but highest invoice is ${highestInvoice}`);
          console.log(`   Difference: ${counter.lastBillNumber - highestInvoice} numbers`);
        }
      } else {
        console.log(`   No orders found with invoice numbers`);
      }
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 Summary:');
    console.log(`   Total counters checked: ${counters.length}`);
    console.log(`   Date: ${today}`);
    
    // Check for orders without invoice numbers
    const ordersWithoutInvoice = await CounterOrder.countDocuments({
      createdAt: { 
        $gte: new Date(today + 'T00:00:00.000Z'),
        $lte: new Date(today + 'T23:59:59.999Z')
      },
      paymentStatus: 'completed',
      $or: [
        { invoiceNumber: { $exists: false } },
        { invoiceNumber: null },
        { invoiceNumber: '' }
      ]
    });
    
    if (ordersWithoutInvoice > 0) {
      console.log(`\n⚠️  Found ${ordersWithoutInvoice} completed orders without invoice numbers`);
    }
    
    console.log('\n✅ Gap check completed\n');
    
  } catch (error) {
    console.error('❌ Error checking invoice gaps:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

// Run the check
checkInvoiceGaps();
