const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    purpose: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    branchId: { type: String, required: true },
    slip: {
        name: String,
        size: Number,
        url: String
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Expense", expenseSchema);