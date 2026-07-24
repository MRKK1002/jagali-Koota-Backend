const Quotation = require('../model/Quotation');

module.exports = {
  submitQuotation: async (req, res) => {
    try {
      const { vendorId, materialId, quotedPrice, deliveryTerms, validity } = req.body;
      const quotation = new Quotation({
        vendorId,
        materialId,
        quotedPrice,
        deliveryTerms,
        validity
      });
      await quotation.save();
      res.status(201).json(quotation);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};