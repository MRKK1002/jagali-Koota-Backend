const Payslip = require('../model/Payslip');

// Create a new payslip
exports.createPayslip = async (req, res) => {
  try {
    const payslip = new Payslip(req.body);
    await payslip.save();
    res.status(201).json(payslip);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get all payslips (populate payrollId)
exports.getAllPayslips = async (req, res) => {
  try {
    const payslips = await Payslip.find().populate('payrollId');
    res.json(payslips);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single payslip by ID
exports.getPayslipById = async (req, res) => {
  try {
    const payslip = await Payslip.findById(req.params.id).populate('payrollId');
    if (!payslip) return res.status(404).json({ message: 'Payslip not found' });
    res.json(payslip);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a payslip by ID
exports.updatePayslip = async (req, res) => {
  try {
    const payslip = await Payslip.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('payrollId');
    if (!payslip) return res.status(404).json({ message: 'Payslip not found' });
    res.json(payslip);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a payslip by ID
exports.deletePayslip = async (req, res) => {
  try {
    const payslip = await Payslip.findByIdAndDelete(req.params.id);
    if (!payslip) return res.status(404).json({ message: 'Payslip not found' });
    res.json({ message: 'Payslip deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};