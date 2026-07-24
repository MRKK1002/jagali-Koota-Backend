const GRN = require("../model/GRN");
const PurchaseOrder = require("../model/poModel");

const generateId = (prefix) => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

module.exports = {
  createGRN: async (req, res) => {
    try {
      const { poId, items, receivedBy, remarks } = req.body;
      const po = await PurchaseOrder.findOne({ poId });
      if (!po) return res.status(404).json({ message: "PO not found" });

      // Check if full quantity is already received
      const existingGRNs = await GRN.find({ poId });
      const totalReceived = existingGRNs.reduce(
        (sum, grn) =>
          sum + grn.items.reduce((s, item) => s + item.receivedQty, 0),
        0
      );
      const poTotalQty = po.items.reduce((sum, item) => sum + item.quantity, 0);
      if (totalReceived >= poTotalQty) {
        return res
          .status(400)
          .json({ message: "Full PO quantity already received" });
      }

      const grn = new GRN({
        grnId: generateId("GRN"),
        poId,
        items,
        receivedBy,
        receivedDate: new Date(),
        remarks,
      });
      await grn.save();
      res.status(201).json(grn);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  updateQCStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { QCstatus, notes } = req.body;
      const grn = await GRN.findOneAndUpdate(
        { grnId: id },
        { QCstatus, notes },
        { new: true }
      );
      if (!grn) return res.status(404).json({ message: "GRN not found" });
      res.json(grn);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
};