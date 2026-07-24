const mongoose = require("mongoose")

const serverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Server/Waiter name is required"],
    trim: true,
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: [true, "Branch is required"],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

serverSchema.index({ branch: 1, isActive: 1 })
serverSchema.index({ name: 1, branch: 1 }, { unique: true })

module.exports = mongoose.model("Server", serverSchema)
