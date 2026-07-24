const express = require('express');
const router = express.Router();
const { createPeopleSelection, getPeopleSelections, getPeopleSelectionById, updatePeopleSelection, deletePeopleSelection } = require('../controller/peopleSelectionController');

// Routes
router.route('/')
  .post(createPeopleSelection)
  .get(getPeopleSelections);

router.route('/:id')
  .get(getPeopleSelectionById)
  .put(updatePeopleSelection)
  .delete(deletePeopleSelection); 

   
    

module.exports = router;