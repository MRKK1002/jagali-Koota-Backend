const mongoose = require("mongoose")

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["Home", "Work", "Other"],
      required: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// Ensure a user can only have one default address
addressSchema.pre("save", async function (next) {
  if (this.isDefault) {
    await this.constructor.updateMany({ userId: this.userId, _id: { $ne: this._id } }, { $set: { isDefault: false } })
  }
  next()
})

module.exports = mongoose.model("Address", addressSchema)