const Employee = require('../model/Employee');

exports.addEmployee = async (req, res) => {
    try {
        const newEmp = new Employee(req.body);
        await newEmp.save();
        res.status(201).json(newEmp);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getAllEmployees = async (req, res) => {
    const employees = await Employee.find();
    res.json(employees);
};

exports.getEmployeeById = async (req, res) => {
    const emp = await Employee.findById(req.params.id);
    res.json(emp);
};

exports.updateEmployee = async (req, res) => {
    const emp = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(emp);
};

exports.deleteEmployee = async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Employee deleted' });
};