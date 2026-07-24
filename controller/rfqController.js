const RFQ = require('../model/RFQ');

const generateId = (prefix) => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

module.exports = {
  createRFQ: async (req, res) => {
    try {
      const { materials, requestedBy, vendorIds } = req.body;
      const rfq = new RFQ({
        rfqId: generateId('RFQ'),
        materials,
        requestedBy,
        vendorIds
      });
      await rfq.save();
      res.status(201).json(rfq);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};