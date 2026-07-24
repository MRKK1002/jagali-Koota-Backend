const PendingPO = require("../model/pendingPO");

// Create a new Pending PO
exports.createPendingPO = async (req, res) => {
  try {
    const pendingPO = new PendingPO(req.body);
    await pendingPO.save();
    res.status(201).json(pendingPO);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all Pending POs
exports.getAllPendingPOs = async (req, res) => {
  try {
    const pendingPOs = await PendingPO.find()
      .populate("goodsReceiptNote")
      .populate("purchaseOrder");
    res.json(pendingPOs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a Pending PO by ID
exports.getPendingPOById = async (req, res) => {
  try {
    const pendingPO = await PendingPO.findById(req.params.id)
      .populate("goodsReceiptNote")
      .populate("purchaseOrder");
    if (!pendingPO) return res.status(404).json({ error: "Not found" });
    res.json(pendingPO);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a Pending PO
exports.updatePendingPO = async (req, res) => {
  try {
    const pendingPO = await PendingPO.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!pendingPO) return res.status(404).json({ error: "Not found" });
    res.json(pendingPO);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete a Pending PO
exports.deletePendingPO = async (req, res) => {
  try {
    const pendingPO = await PendingPO.findByIdAndDelete(req.params.id);
    if (!pendingPO) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};