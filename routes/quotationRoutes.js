const express = require('express');
const router = express.Router();
const quotationController = require('../controller/quotationController');

router.post('/', quotationController.submitQuotation);

module.exports = router;