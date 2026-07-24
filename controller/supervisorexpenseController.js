const Expense = require('../model/supervisorExpense');
const mongoose = require('mongoose');

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private
const   getExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find({})
            .populate('submittedBy', 'name email')
            .populate('project', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: expenses.length,
            expenses
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
const createExpense = async (req, res) => {
    try {
        const { amount, description, category, date, vendor, receipt, submittedBy, project } = req.body;

        const expense = await Expense.create({
            amount,
            description,
            category,
            date: date || Date.now(),
            vendor,
            receipt,
            submittedBy,
            project
        });

        res.status(201).json({
            success: true,
            expense
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                error: messages
            });
        } else {
            return res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    }
};

// @desc    Update expense status
// @route   PUT /api/expenses/:id/status
// @access  Private/Admin
const updateExpenseStatus = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                error: 'No expense found'
            });
        }

        expense.status = req.body.status;
        await expense.save();

        res.status(200).json({
            success: true,
            expense
        });
    } catch (error) {
        console.error(error); // Add this line
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Get expense statistics
// @route   GET /api/expenses/stats
// @access  Private
const getExpenseStats = async (req, res) => {
    try {
        const stats = await Expense.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            },
            {
                $group: {
                    _id: null,
                    totalExpenses: { $sum: '$count' },
                    totalAmount: { $sum: '$totalAmount' },
                    statuses: { $push: { status: '$_id', count: '$count', amount: '$totalAmount' } }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            stats: stats[0] || { totalExpenses: 0, totalAmount: 0, statuses: [] }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

module.exports = {
    getExpenses,
    createExpense,
    updateExpenseStatus,
    getExpenseStats
};