const mongoose = require('mongoose');

const payslipSchema = new mongoose.Schema({
    payrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payrollconstruction' },
    generatedAt: { type: Date, default: Date.now },
    filePath: String // e.g., saved PDF location
});

module.exports = mongoose.model('Payslip', payslipSchema);