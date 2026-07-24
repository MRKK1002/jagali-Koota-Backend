const Table = require('../model/Table');
const Branch = require('../model/Branch');
const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const { uploadFile2, deleteFile } = require('../middleware/AWS');

const createTable = asyncHandler(async (req, res) => {
  if (!req.body) {
    res.status(400);b 
    throw new Error('Request body is missing');
  } 

  const { branchId, categoryId, number, capacity, status } = req.body;
  const image = req.file ? await uploadFile2(req.file,'table') : null;

  if (!branchId || !number) {
    res.status(400);
    throw new Error('Branch ID and number are required');
  }

  const branch = await Branch.findById(branchId);
  if (!branch) {
    res.status(404);
    throw new Error('Branch not found');
  }

  const tableData = { branchId, number, status, image };
  if (categoryId) {
    tableData.categoryId = categoryId;
  }
  if (capacity) {
    tableData.capacity = parseInt(capacity);
  }

  const table = new Table(tableData);
  const createdTable = await table.save();

  // Populate category before returning
  const populatedTable = await Table.findById(createdTable._id)
    .populate('branchId', 'name')
    .populate('categoryId', 'name');

  res.status(201).json(populatedTable);
});

const getTables = asyncHandler(async (req, res) => {
  const { branchId, categoryId } = req.query;
  const query = {};
  if (branchId) query.branchId = branchId;
  if (categoryId) query.categoryId = categoryId;
  
  const tables = await Table.find(query)
    .populate('branchId', 'name')
    .populate('categoryId', 'name');
  res.json(tables);
});

const getTableById = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.id)
    .populate('branchId', 'name')
    .populate('categoryId', 'name');

  if (table) {
    res.json(table);
  } else {
    res.status(404);
    throw new Error('Table not found');
  }
});

const updateTable = asyncHandler(async (req, res) => {
  if (!req.body) {
    res.status(400);
    throw new Error('Request body is missing');
  }

  const { branchId, categoryId, number, capacity, status } = req.body;
  const updateData = {};
  
  // Only include fields that are provided
  if (branchId !== undefined) updateData.branchId = branchId;
  if (categoryId !== undefined) updateData.categoryId = categoryId;
  if (number !== undefined) updateData.number = number;
  if (status !== undefined) updateData.status = status;
  if (capacity !== undefined) updateData.capacity = parseInt(capacity);

  // Handle image upload
  if (req.file) {
    updateData.image = await uploadFile2(req.file, 'table');

    const table = await Table.findById(req.params.id);
    if (table && table.image) {
       deleteFile(table.image);
    }
  }

  // Only validate branchId if it's being updated
  if (updateData.branchId) {
    const branch = await Branch.findById(updateData.branchId);
    if (!branch) {
      res.status(404);
      throw new Error('Branch not found');
    }
  }

  const updatedTable = await Table.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate('branchId', 'name')
    .populate('categoryId', 'name');

  if (!updatedTable) {
    res.status(404);
    throw new Error('Table not found');
  }

  res.json(updatedTable);
});

const deleteTable = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.id);

  if (!table) {
    res.status(404);
    throw new Error('Table not found');
  }

  if (table.image) {
  deleteFile(table.image);
  }

  await Table.deleteOne({ _id: req.params.id });
  res.json({ message: 'Table removed successfully' });
});

module.exports = {
  createTable,
  getTables,
  getTableById,
  updateTable,
  deleteTable,
};