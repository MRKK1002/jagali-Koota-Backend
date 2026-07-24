const Role = require('../model/roleModel');
const asyncHandler = require('express-async-handler');


const getRoles = asyncHandler(async (req, res) => {
  const roles = await Role.find();
  res.status(200).json(roles);
});


const getRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  
  if (!role) {
    res.status(404);
    throw new Error('Role not found');
  }
  
  res.status(200).json(role);
});


const createRole = asyncHandler(async (req, res) => {
  const { 
    name, 
    department, 
    description, 
    skills, 
    responsibilities, 
    experienceLevel, 
    budgetMin, 
    budgetMax 
  } = req.body;

  if (!name || !department || !description || !experienceLevel || !budgetMin || !budgetMax) {
    res.status(400);
    throw new Error('Please provide all required fields');
  }

  const role = await Role.create({
    name,
    department,
    description,
    skills,
    responsibilities: responsibilities.filter(r => r.trim() !== ''),
    experienceLevel,
    budgetRange: {
      min: budgetMin,
      max: budgetMax
    }
  });

  res.status(201).json(role);
});


const updateRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);

  if (!role) {
    res.status(404);
    throw new Error('Role not found');
  }

  const { 
    name, 
    department, 
    description, 
    skills, 
    responsibilities, 
    experienceLevel, 
    budgetMin, 
    budgetMax 
  } = req.body;

  const updatedRole = await Role.findByIdAndUpdate(
    req.params.id,
    {
      name,
      department,
      description,
      skills,
      responsibilities: responsibilities.filter(r => r.trim() !== ''),
      experienceLevel,
      budgetRange: {
        min: budgetMin,
        max: budgetMax
      }
    },
    { new: true }
  );

  res.status(200).json(updatedRole);
});


const deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);

  if (!role) {
    res.status(404);
    throw new Error('Role not found');
  }

  await Role.findByIdAndDelete(req.params.id);
  res.status(200).json({ id: req.params.id });
});

module.exports = {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole
};