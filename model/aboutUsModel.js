const mongoose = require("mongoose")

const aboutUsSchema = new mongoose.Schema(
  {
    
    description: {
      type: String,
      required: true,
      trim: true,
    },
    mission: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model("AboutUs", aboutUsSchema)