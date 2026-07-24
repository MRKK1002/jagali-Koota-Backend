const express = require('express');
const router = express.Router();
const customerController = require('../controller/customerDetailsController');

// POST endpoint to add a customer
router.post('/customers', customerController.addCustomer);

module.exports = router;