const mongoose = require("mongoose");

const pendingPOSchema = new mongoose.Schema(
  {
    goodsReceiptNote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GoodsReceiptNote",
      required: true,
    },
    purchaseOrder: {            
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("pendingPO", pendingPOSchema);