const express = require('express');
const router = express.Router();
const {
  createIndent,
  getIndents,
  updateIndentStatus,
  deleteIndent
} = require('../controller/indentController');

router.route('/')
  .post(createIndent)
  .get(getIndents);

router.route('/:id')
  .patch(updateIndentStatus)
  .delete(deleteIndent);

module.exports = router;