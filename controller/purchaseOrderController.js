const PurchaseOrder = require("../model/purchaseOrder");

// Get all purchase orders
exports.getAll = async (req, res) => {
  try {
    const orders = await PurchaseOrder.find()
      .populate("supplierId", "name")
      .populate("branchId", "name");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single purchase order by ID
exports.getOne = async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id)
      .populate("supplierId", "name")
      .populate("branchId", "name");
    if (!order) return res.status(404).json({ error: "Not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new purchase order
exports.create = async (req, res) => {
  try {
    const order = new PurchaseOrder(req.body);
    await order.save();
    res.status(201).json(order);
  } catch (err) {

    res.status(400).json({ error: err.message });
  }
};

// Update a purchase order
exports.update = async (req, res) => {
  try {
    const order = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Not found" });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete a purchase order
exports.remove = async (req, res) => {
  try {
    const order = await PurchaseOrder.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};