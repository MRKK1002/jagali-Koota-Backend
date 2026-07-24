const Customer = require('../model/customerDetailsModel');
const Branch = require('../model/Branch');
const asyncHandler = require('express-async-handler');

exports.addCustomer = asyncHandler(async (req, res) => {
  const { customerName, phoneNumber, branchId } = req.body;

  // Validate input
  if (!customerName || !customerName.trim()) {
    res.status(400);
    throw new Error('Customer name is required');
  }

  if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
    res.status(400);
    throw new Error('Phone number must be a valid 10-digit number');
  }

  if (!branchId) {
    res.status(400);
    throw new Error('Branch is required');
  }

  // Verify branch exists
  const branch = await Branch.findById(branchId);
  if (!branch) {
    res.status(404);
    throw new Error('Selected branch not found');
  }

  // Create new customer
  const customer = new Customer({
    customerName: customerName.trim(),
    phoneNumber: phoneNumber.trim(),
    branch: branchId,
  });

  // Save to database
  await customer.save();

  // Populate branch details in response
  const populatedCustomer = await Customer.findById(customer._id).populate('branch');

  // Respond with success
  res.status(201).json({
    message: 'Customer added successfully',
    customer: {
      customerName: populatedCustomer.customerName,
      phoneNumber: populatedCustomer.phoneNumber,
      branch: {
        id: populatedCustomer.branch._id,
        name: populatedCustomer.branch.name,
        location: populatedCustomer.branch.address,
      },
      id: populatedCustomer._id,
    },
  });
});