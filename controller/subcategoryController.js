const Subcategory = require('../model/subcategoryModel');

// Get all subcategories
exports.getAllSubcategories = async (req, res) => {
  try {
    const { categoryId, branchId } = req.query;
    const filter = {};
    
    if (categoryId) filter.categoryId = categoryId;
    if (branchId) filter.branchId = branchId;
    
    const subcategories = await Subcategory.find(filter)
      .populate('categoryId', 'name')
      .populate('branchId', 'name')
      .sort({ name: 1 });
    
    res.status(200).json(subcategories);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ message: 'Error fetching subcategories', error: error.message });
  }
};

// Get subcategory by ID
exports.getSubcategoryById = async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id)
      .populate('categoryId', 'name')
      .populate('branchId', 'name');
    
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
    
    res.status(200).json(subcategory);
  } catch (error) {
    console.error('Error fetching subcategory:', error);
    res.status(500).json({ message: 'Error fetching subcategory', error: error.message });
  }
};

// Create new subcategory
exports.createSubcategory = async (req, res) => {
  try {
    const { name, categoryId, branchId, description } = req.body;
    
    // Check if subcategory already exists
    const existingSubcategory = await Subcategory.findOne({ 
      name, 
      categoryId, 
      branchId 
    });
    
    if (existingSubcategory) {
      return res.status(400).json({ 
        message: 'Subcategory with this name already exists in this category and branch' 
      });
    }
    
    const subcategory = new Subcategory({
      name,
      categoryId,
      branchId,
      description
    });
    
    await subcategory.save();
    
    const populatedSubcategory = await Subcategory.findById(subcategory._id)
      .populate('categoryId', 'name')
      .populate('branchId', 'name');
    
    res.status(201).json(populatedSubcategory);
  } catch (error) {
    console.error('Error creating subcategory:', error);
    res.status(500).json({ message: 'Error creating subcategory', error: error.message });
  }
};

// Update subcategory
exports.updateSubcategory = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    
    const subcategory = await Subcategory.findByIdAndUpdate(
      req.params.id,
      { name, description, isActive },
      { new: true, runValidators: true }
    )
      .populate('categoryId', 'name')
      .populate('branchId', 'name');
    
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
    
    res.status(200).json(subcategory);
  } catch (error) {
    console.error('Error updating subcategory:', error);
    res.status(500).json({ message: 'Error updating subcategory', error: error.message });
  }
};

// Delete subcategory
exports.deleteSubcategory = async (req, res) => {
  try {
    const subcategory = await Subcategory.findByIdAndDelete(req.params.id);
    
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
    
    res.status(200).json({ message: 'Subcategory deleted successfully' });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({ message: 'Error deleting subcategory', error: error.message });
  }
};