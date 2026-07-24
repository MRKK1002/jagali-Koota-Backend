const GoodsReceiptNote = require("../model/goodReceipNotes");

// Get all GRNs
exports.getAllGRNs = async (req, res) => {
  try {
    const grns = await GoodsReceiptNote.find()
      .populate('supplierId', 'name')
      .populate('branchId','name')
    //   .populate('categoryId', 'name')
      .sort({ createdAt: -1 });
    res.json(grns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single GRN
exports.getGRN = async (req, res) => {
  try {
    const grn = await GoodsReceiptNote.findById(req.params.id)
      .populate("purchaseOrderId", "invoiceNumber")
      .populate("supplierId", "name")
      .populate("branchId", "name");
    if (!grn) return res.status(404).json({ error: "GRN not found" });
    res.json(grn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create GRN
exports.createGRN = async (req, res) => {
  try {
    const grn = new GoodsReceiptNote(req.body);
    await grn.save();
    res.status(201).json(grn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Update GRN
exports.updateGRN = async (req, res) => {
  try {
    const grn = await GoodsReceiptNote.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!grn) return res.status(404).json({ error: "GRN not found" });
    res.json(grn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete GRN
exports.deleteGRN = async (req, res) => {
  try {
    const grn = await GoodsReceiptNote.findByIdAndDelete(req.params.id);
    if (!grn) return res.status(404).json({ error: "GRN not found" });
    res.json({ message: "GRN deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};