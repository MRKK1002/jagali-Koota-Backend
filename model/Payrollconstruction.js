const mongoose = require('mongoose');

const payrollconstructionSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    month: Number,
    year: Number,
    presentDays: Number,
    absentDays: Number,
    leaveDays: Number,
    bonus: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    calculatedSalary: Number,
    netPay: Number
});

module.exports = mongoose.model('Payrollconstruction', payrollconstructionSchema);