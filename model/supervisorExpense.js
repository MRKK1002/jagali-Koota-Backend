const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: {
            values: ['Materials', 'Labor', 'Equipment', 'Food', 'Transportation', 'Utilities', 'Other'],
            message: '{VALUE} is not a valid category'
        }
    },
    date: {
        type: Date,
        required: [true, 'Date is required'],
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    vendor: {
        type: String,
        trim: true,
        maxlength: [100, 'Vendor name cannot exceed 100 characters']
    },
    receipt: {
        type: String,
        default: 'No receipt'
    },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    }
}, {
    timestamps: true
});

// Add indexes for better query performance
expenseSchema.index({ status: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ date: 1 });

module.exports = mongoose.models.Expense || mongoose.model("Expense", expenseSchema);