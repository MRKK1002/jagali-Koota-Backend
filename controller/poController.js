const PurchaseOrder = require("../model/poModel");

// Create a new Purchase Order
exports.createPO = async (req, res) => {
  try {
    const po = new PurchaseOrder(req.body);
    await po.save();
    res.status(201).json(po);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all Purchase Orders
exports.getAllPOs = async (req, res) => {
  try {
    const pos = await PurchaseOrder.find().populate("vendorId",'name');
    res.json(pos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single Purchase Order by ID
exports.getPOById = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate("vendorId",'name');
    if (!po) return res.status(404).json({ error: "PO not found" });
    res.json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a Purchase Order
exports.updatePO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!po) return res.status(404).json({ error: "PO not found" });
    res.json(po);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete a Purchase Order
exports.deletePO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findByIdAndDelete(req.params.id);
    if (!po) return res.status(404).json({ error: "PO not found" });
    res.json({ message: "PO deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};