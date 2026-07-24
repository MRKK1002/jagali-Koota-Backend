const express = require('express');
const router = express.Router();
const leaveController = require('../controller/leaveController');

// Apply for leave
router.post('/', leaveController.applyLeave);

// Get all leave applications
router.get('/', leaveController.getAllLeaves);

// Update leave status by ID
router.put('/:id', leaveController.updateLeaveStatus);

module.exports = router;