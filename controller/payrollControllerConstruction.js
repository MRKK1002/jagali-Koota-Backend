const Payroll = require('../model/Payrollconstruction');

exports.generatePayroll = async (req, res) => {
    try {
        const { salary, bonus = 0, deductions = 0, presentDays } = req.body;
        const calculatedSalary = (salary / 30) * presentDays;
        const netPay = calculatedSalary + bonus - deductions;

        const payroll = new Payroll({ ...req.body, calculatedSalary, netPay });
        await payroll.save();
        res.status(201).json(payroll);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getAllPayrolls = async (req, res) => {
    const payrolls = await Payroll.find().populate('employeeId');
    res.json(payrolls);
};