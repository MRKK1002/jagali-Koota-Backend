const express = require('express');
const router = express.Router();
const categoryAccessController = require('../controller/categoryAccessController');

// Public route for login
router.post('/login', categoryAccessController.loginCategoryAccess);

// Admin routes
router.get('/', categoryAccessController.getAllCategoryAccess);
router.get('/:id', categoryAccessController.getCategoryAccessById);
router.post('/', categoryAccessController.createCategoryAccess);
router.put('/:id', categoryAccessController.updateCategoryAccess);
router.delete('/:id', categoryAccessController.deleteCategoryAccess);

module.exports = router;