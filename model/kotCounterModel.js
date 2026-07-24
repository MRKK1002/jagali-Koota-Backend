const mongoose = require("mongoose")

// Global KOT counter for generating sequential KOT numbers
const kotCounterSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      unique: true, // One counter per branch
    },
    currentKotNumber: {
      type: Number,
      default: 0,
      required: true,
    },
    lastResetDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

// Method to get next KOT number for a branch
kotCounterSchema.statics.getNextKotNumber = async function (branchId) {
  try {
    
    // Find and increment the counter atomically
    const counter = await this.findOneAndUpdate(
      { branchId },
      { $inc: { currentKotNumber: 1 } },
      { 
        new: true, 
        upsert: true, // Create if doesn't exist
        setDefaultsOnInsert: true 
      }
    )

    const kotNumber = `RES-KOT-${String(counter.currentKotNumber).padStart(3, '0')}`
    
    return kotNumber
  } catch (error) {
    console.error("❌ Error generating KOT number:", error)
    // Fallback to timestamp-based KOT if counter fails
    const fallbackKot = `RES-KOT-${Date.now()}`
    return fallbackKot
  }
}

// Method to reset counter (optional - for daily/monthly reset)
kotCounterSchema.statics.resetCounter = async function (branchId) {
  await this.findOneAndUpdate(
    { branchId },
    { 
      currentKotNumber: 0,
      lastResetDate: new Date()
    },
    { upsert: true }
  )
}

module.exports = mongoose.model("KotCounter", kotCounterSchema)