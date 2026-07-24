const Payment = require('../model/Payment');
const Invoice = require('../model/Invoice');

const generateId = (prefix) => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

module.exports = {
  createPayment: async (req, res) => {
    try {
      const { vendorId, amount, paymentMode, remarks } = req.body;
      const invoice = await Invoice.findOne({ vendorId, amount, paymentStatus: 'unpaid' });
      if (!invoice) return res.status(400).json({ message: 'Matching unpaid invoice not found' });

      const payment = new Payment({
        paymentId: generateId('PAY'),
        vendorId,
        amount,
        paymentMode,
        paymentDate: new Date(),
        remarks
      });
      await payment.save();
      await Invoice.findOneAndUpdate(
        { invoiceId: invoice.invoiceId },
        { paymentStatus: 'paid' }
      );
      res.status(201).json(payment);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};