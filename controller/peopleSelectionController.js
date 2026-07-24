const PeopleSelection = require('../model/PeopleSelection');
const Branch = require('../model/Branch');
const Table = require('../model/Table');
const asyncHandler = require('express-async-handler');

const createPeopleSelection = asyncHandler(async (req, res) => {
  if (!req.body) {
    res.status(400);
    throw new Error('Request body is missing');
  }

  const { branchId, tableId, peopleCount, status } = req.body;

  if (!branchId || !tableId || !peopleCount) {
    res.status(400);
    throw new Error('Branch ID, table ID, and people count are required');
  }

  // Verify that the branch exists
  const branch = await Branch.findById(branchId);
  if (!branch) {
    res.status(404);
    throw new Error('Branch not found');
  }

  // Verify that the table exists and check capacity
  const table = await Table.findById(tableId);
  if (!table) {
    res.status(404);
    throw new Error('Table not found');
  }

  // Validate peopleCount against table capacity
  if (peopleCount > table.capacity) {
    res.status(400);
    throw new Error(`People count (${peopleCount}) exceeds table capacity (${table.capacity})`);
  }

  const peopleSelection = new PeopleSelection({ branchId, tableId, peopleCount, status });
  const createdPeopleSelection = await peopleSelection.save();

  res.status(201).json(createdPeopleSelection);
});

const getPeopleSelections = asyncHandler(async (req, res) => {
  const { branchId, tableId } = req.query;
  const query = {};
  if (branchId) query.branchId = branchId;
  if (tableId) query.tableId = tableId;

  const peopleSelections = await PeopleSelection.find(query)
    .populate('branchId', 'name')
    .populate('tableId', 'number capacity');
  res.json(peopleSelections);
});

const getPeopleSelectionById = asyncHandler(async (req, res) => {
  const peopleSelection = await PeopleSelection.findById(req.params.id)
    .populate('branchId', 'name')
    .populate('tableId', 'number capacity');

  if (peopleSelection) {
    res.json(peopleSelection);
  } else {
    res.status(404);
    throw new Error('People selection not found');
  }
});

const updatePeopleSelection = asyncHandler(async (req, res) => {
  if (!req.body) {
    res.status(400);
    throw new Error('Request body is missing');
  }

  const { branchId, tableId, peopleCount, status } = req.body;
  const updateData = { branchId, tableId, peopleCount, status };

  // Remove undefined fields
  Object.keys(updateData).forEach(key => 
    updateData[key] === undefined && delete updateData[key]
  );

  // Verify branch and table if provided
  if (updateData.branchId) {
    const branch = await Branch.findById(updateData.branchId);
    if (!branch) {
      res.status(404);
      throw new Error('Branch not found');
    }
  }

  if (updateData.tableId) {
    const table = await Table.findById(updateData.tableId);
    if (!table) {
      res.status(404);
      throw new Error('Table not found');
    }
    // Validate peopleCount against new table capacity if tableId or peopleCount is updated
    if (updateData.peopleCount && updateData.peopleCount > table.capacity) {
      res.status(400);
      throw new Error(`People count (${updateData.peopleCount}) exceeds table capacity (${table.capacity})`);
    }
  }

  // If only peopleCount is updated, validate against the existing table's capacity
  if (updateData.peopleCount && !updateData.tableId) {
    const peopleSelection = await PeopleSelection.findById(req.params.id);
    if (!peopleSelection) {
      res.status(404);
      throw new Error('People selection not found');
    }
    const table = await Table.findById(peopleSelection.tableId);
    if (updateData.peopleCount > table.capacity) {
      res.status(400);
      throw new Error(`People count (${updateData.peopleCount}) exceeds table capacity (${table.capacity})`);
    }
  }

  const updatedPeopleSelection = await PeopleSelection.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate('branchId', 'name')
    .populate('tableId', 'number capacity');

  if (!updatedPeopleSelection) {
    res.status(404);
    throw new Error('People selection not found');
  }

  res.json(updatedPeopleSelection);
});

const deletePeopleSelection = asyncHandler(async (req, res) => {
  const peopleSelection = await PeopleSelection.findById(req.params.id);

  if (!peopleSelection) {
    res.status(404);
    throw new Error('People selection not found');
  }

  await PeopleSelection.deleteOne({ _id: req.params.id });
  res.json({ message: 'People selection removed successfully' });
});

module.exports = {
  createPeopleSelection,
  getPeopleSelections,
  getPeopleSelectionById,
  updatePeopleSelection,
  deletePeopleSelection,
};