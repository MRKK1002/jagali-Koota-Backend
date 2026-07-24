const express = require('express');
const router = express.Router();
const {
    getExpenses,
    createExpense,
    updateExpenseStatus,

    getExpenseStats
} = require('../controller/supervisorexpenseController');


router.route('/getall')
    .get(getExpenses)
    .post(createExpense);

router.route('/stats')
    .get(getExpenseStats);



router.route('/:id/status')
    .put(updateExpenseStatus);

module.exports = router;