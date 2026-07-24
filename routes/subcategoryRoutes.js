const express = require('express');
const router = express.Router();
const subcategoryController = require('../controller/subcategoryController');

// Get all subcategories (with optional filters)
router.get('/', subcategoryController.getAllSubcategories);

// Get subcategory by ID
router.get('/:id', subcategoryController.getSubcategoryById);

// Create new subcategory
router.post('/', subcategoryController.createSubcategory);

// Update subcategory
router.put('/:id', subcategoryController.updateSubcategory);

// Delete subcategory
router.delete('/:id', subcategoryController.deleteSubcategory);

module.exports = router;