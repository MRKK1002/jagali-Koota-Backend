const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  name: String,
  quantity: Number,
  unit: String,
  rate: Number,
  amount: Number,
});

const goodsReceiptNoteSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true },
   supplierId: {
       type: mongoose.Schema.Types.ObjectId,
       ref: "Supplier",
       required: [true, 'Branch ID is required']
     },
    receiptDate: { type: Date, required: true },
    items: { type: [itemSchema], required: true }, // <-- Array of objects
    status: {
      type: String,
      enum: ["Received", "Partial", "Pending"],
      required: true,
    },
    quantity: { type: String, required: true },
    notes: { type: String },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GoodsReceiptNote", goodsReceiptNoteSchema);