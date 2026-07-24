const express = require('express');
const router = express.Router();
const receptionistAccessController = require('../controller/receptionistAccessController');

// Public route for login
router.post('/login', receptionistAccessController.loginReceptionistAccess);

// Admin routes
router.get('/', receptionistAccessController.getAllReceptionistAccess);
router.get('/:id', receptionistAccessController.getReceptionistAccessById);
router.post('/', receptionistAccessController.createReceptionistAccess);
router.put('/:id', receptionistAccessController.updateReceptionistAccess);
router.delete('/:id', receptionistAccessController.deleteReceptionistAccess);

module.exports = router;