const express = require('express');
const router = express.Router();
const {
    generatePayroll,
    getAllPayrolls
} = require('../controller/payrollControllerConstruction');

router.post('/', generatePayroll);
router.get('/', getAllPayrolls);


module.exports = router;