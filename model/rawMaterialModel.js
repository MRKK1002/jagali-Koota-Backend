const mongoose = require("mongoose")

const rawMaterialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
    
    },
    unit: {
      type: String,
      required: true,
     
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    minLevel: {
      type: Number,
      required: true,
      min: 0,
      default: 5,
    },
    supplier: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["In Stock", "Low Stock", "Out of Stock"],
      default: function () {
        if (this.quantity === 0) return "Out of Stock"
        if (this.quantity <= this.minLevel) return "Low Stock"
        return "In Stock"
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for total value
rawMaterialSchema.virtual("totalValue").get(function () {
  return this.quantity * this.price
})

// Pre-save middleware to update status
rawMaterialSchema.pre("save", function (next) {
  if (this.quantity === 0) {
    this.status = "Out of Stock"
  } else if (this.quantity <= this.minLevel) {
    this.status = "Low Stock"
  } else {
    this.status = "In Stock"
  }
  next()
})

// Index for better search performance
rawMaterialSchema.index({ name: "text", category: 1 })

module.exports = mongoose.model("RawMaterial", rawMaterialSchema)