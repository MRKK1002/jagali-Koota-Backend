const Category = require('../model/Category');
const Menu = require('../model/menuModel');
const { invalidateMenuCache } = require('./menuController');
const fs = require('fs').promises;
const path = require('path');
const { uploadFile2, deleteFile } = require('../middleware/AWS');

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const { name, branchId, branchName, branchAddress, _id, loginPassword, cancelOrderPassword, gstRate } = req.body;

    // Validate required fields
    if (!branchId || branchId.trim() === '') {
      return res.status(400).json({ message: 'Branch ID is required' });
    }
    
    // Build branch object (required by crm_backend format)
    const branchData = {
      id: branchId,
      name: branchName || 'Unknown Branch',
      address: branchAddress || 'Address not available'
    };
    
    // Check if category with the same name already exists for this branch
    const existingCategory = await Category.findOne({ name, 'branch.id': branchId });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this name already exists for this branch' });
    }

    // Handle image upload - always use local storage for reliability
    let image = null;
    if (req.file) {
      // Always use local storage path
      if (req.file.path) {
        const uploadsIndex = req.file.path.indexOf('uploads');
        image = uploadsIndex !== -1 ? req.file.path.substring(uploadsIndex).replace(/\\/g, '/') : req.file.path;

      }
      
      // Try S3 upload as backup (optional)
      try {
        const fileBuffer = await fs.readFile(req.file.path);
        const s3Url = await uploadFile2(fileBuffer, req.file.originalname, req.file.mimetype);
        if (s3Url) {

          // Keep local file - don't delete it
        }
      } catch (error) {

      }
    }

    const categoryData = {
      name,
      branchId, // Keep for backward compatibility
      branch: branchData,
      image,
      loginPassword: loginPassword || null,
      cancelOrderPassword: cancelOrderPassword || null,
      gstRate: gstRate || 0 // Add GST rate field
    };
    
    // If _id is provided (from dual backend sync), use it
    if (_id) {
      categoryData._id = _id;
    }

    const category = new Category(categoryData);

    await category.save();
    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error) {
    console.error('Error creating category:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(400).json({ message: 'Error creating category', error: error.message });
  }
};

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const { branchId } = req.query;
    
    // If branchId is provided, filter by branch (support both formats)
    const filter = branchId ? { $or: [{ branchId }, { 'branch.id': branchId }] } : {};
    
    const categories = await Category.find(filter);
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
};

// Get a single category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching category', error: error.message });
  }
};

// Update a category
exports.updateCategory = async (req, res) => {
  try {
    const { name, branchId, branchName, branchAddress, loginPassword, cancelOrderPassword, gstRate } = req.body;
    const updateData = { name };
    
    // Update passwords if provided
    if (loginPassword !== undefined) {
      updateData.loginPassword = loginPassword || null;
    }
    if (cancelOrderPassword !== undefined) {
      updateData.cancelOrderPassword = cancelOrderPassword || null;
    }
    
    // Update GST rate if provided
    if (gstRate !== undefined) {
      updateData.gstRate = gstRate;
    }
    
    // Update branch data if provided
    if (branchId) {
      updateData.branchId = branchId;
      updateData.branch = {
        id: branchId,
        name: branchName || 'Unknown Branch',
        address: branchAddress || 'Address not available'
      };
    }

    // If a new image is uploaded, update the image path
    if (req.file) {
      // Always use local storage path
      if (req.file.path) {
        const uploadsIndex = req.file.path.indexOf('uploads');
        updateData.image = uploadsIndex !== -1 ? req.file.path.substring(uploadsIndex).replace(/\\/g, '/') : req.file.path;

      }
      
      // Try S3 upload as backup (optional)
      try {
        const fileBuffer = await fs.readFile(req.file.path);
        const s3Url = await uploadFile2(fileBuffer, req.file.originalname, req.file.mimetype);
        if (s3Url) {

          // Keep local file - don't delete it
        }
      } catch (error) {

      }
      
      // Delete old image if update was successful
      if (updateData.image) {
        const category = await Category.findById(req.params.id);
        if (category && category.image && category.image !== updateData.image) {
          await deleteFile(category.image);
        }
      }
    }

    const category = await Category.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // If GST rate was changed, bulk-update all menu items in this category
    if (gstRate !== undefined) {
      const newGst = Number(gstRate) || 0
      try {
        const result = await Menu.updateMany(
          { categoryId: category._id },
          { $set: { gstRate: newGst } }
        )
        console.log(`[Category GST] Updated ${result.modifiedCount} menu items to ${newGst}% for category "${category.name}"`)
        // Clear menu cache so counter app gets fresh data
        invalidateMenuCache()
      } catch (err) {
        console.warn('[Category GST] Bulk update failed:', err.message)
      }
    }

    res.status(200).json({ message: 'Category updated successfully', category });
  } catch (error) {
    res.status(400).json({ message: 'Error updating category', error: error.message });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Delete the associated image file
    if (category.image) {
      try {
        await deleteFile(category.image);
      } catch (deleteError) {

        // Continue with category deletion even if S3 delete fails
      }
    }

    await Category.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  }
};