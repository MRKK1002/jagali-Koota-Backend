const mongoose = require('mongoose');

// Earnings Sub-Schema
const earningsSchema = new mongoose.Schema({
    basicSalary: Number,
    hra: Number,
    da: Number,
    conveyanceAllowance: Number,
    medicalAllowance: Number,
    siteAllowance: Number,
    overtimePay: Number,
    safetyBonus: Number,
    attendanceBonus: Number,
    totalEarnings: Number
}, { _id: false });

// Deductions Sub-Schema
const deductionsSchema = new mongoose.Schema({
    pf: Number,
    professionalTax: Number,
    esi: Number,
    incomeTax: Number,
    loanEmi: Number,
    uniformCharges: Number,
    safetyEquipmentCharges: Number,
    otherDeductions: Number,
    totalDeductions: Number
}, { _id: false });

const employeeSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    department: String,
    designation: String,
    joiningDate: Date,
    salary: Number,
    role: String,
    earnings: earningsSchema,
    deductions: deductionsSchema,
    leaveBalance: { type: Number, default: 12 },
    adharNumber: { type: String }, 
    panNumber: { type: String }    
});

module.exports = mongoose.model('Employee', employeeSchema);