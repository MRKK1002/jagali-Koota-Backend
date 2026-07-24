const Leave = require('../model/LeaveApplication');

exports.applyLeave = async (req, res) => {
    try {
        const leave = new Leave(req.body);
        await leave.save();
        res.status(201).json(leave);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getAllLeaves = async (req, res) => {
    const leaves = await Leave.find().populate('employeeId');
    res.json(leaves);
};

exports.updateLeaveStatus = async (req, res) => {
    const updated = await Leave.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
};