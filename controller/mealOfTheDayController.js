const MealOfTheDay = require('../model/mealOfTheDayModel');
const mongoose = require('mongoose');
const { uploadFile2 } = require('../middleware/AWS');

// @desc    Create a new meal of the day
// @route   POST /api/v1/hotel/meal-of-the-day
// @access  Private/Admin
const createMealOfTheDay = async (req, res) => {
  try {




    let {
      date,
      productId,
      branchId,
      title,
      description,
      specialPrice,
      availableQuantity,
      featured
    } = req.body;

    // Convert numeric fields
    specialPrice = parseFloat(specialPrice);
    availableQuantity = parseInt(availableQuantity);
    featured = featured === 'true' || featured === true;

    // Get product details to auto-populate meal data
    const Product = require('../model/menuModel');
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(400).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Auto-populate from product only for missing fields
    const autoOriginalPrice = product.price;
    let mealImage = product.image; // Default to product image
    
    // Handle custom image upload if provided
    if (req.file) {


      try {

        if (!req.file.buffer) {

          throw new Error('File buffer is missing - multer memoryStorage issue');
        }
        
        const imageUrl = await uploadFile2(req.file, "meal-of-the-day");

        mealImage = imageUrl;
      } catch (err) {


        // Don't fail the entire request if image upload fails

      }
    } else {

    }

    // Check if MongoDB is connected after processing the data
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. State:', mongoose.connection.readyState);
      // Log the data for debugging purposes

      return res.status(200).json({
        success: false,
        message: 'Database not connected. Request logged for debugging. Please start MongoDB service.',
        debug: `Connection state: ${mongoose.connection.readyState}`,
        loggedData: { date, title, originalPrice: autoOriginalPrice, specialPrice, imageUrl: mealImage }
      });
    }

    // Validate required fields - updated to match frontend form
    if (!productId || !branchId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: productId, branchId'
      });
    }

    // Use current date if not provided
    const mealDate = date ? new Date(date) : new Date();
    
    // Use product details for the meal
    const mealTitle = title || product.name;
    const mealDescription = description || product.description || '';
    const mealSpecialPrice = specialPrice || product.price;
    
    // Calculate discount based on product price and special price
    let calculatedDiscount = Math.round(((autoOriginalPrice - mealSpecialPrice) / autoOriginalPrice) * 100);
    if (calculatedDiscount < 0) {
      calculatedDiscount = 0; // No discount if special price is higher than original
    }

    const mealOfTheDay = new MealOfTheDay({
      date: mealDate,
      productId,
      branchId,
      title: mealTitle,
      description: mealDescription,
      originalPrice: autoOriginalPrice,
      specialPrice: mealSpecialPrice,
      discount: calculatedDiscount,
      image: mealImage,
      availableQuantity: availableQuantity || 100, // Default quantity
      isActive: true, // Default to active
      tags: [],
      preparationTime: null,
      nutritionalInfo: {},
      allergens: [],
      featured: featured || false,
      adminNotes: ''
    });

    try {
    await mealOfTheDay.save();

    // Populate the response
    await mealOfTheDay.populate('productId', 'name price image');
    await mealOfTheDay.populate('branchId', 'name address');
    } catch (saveError) {
      console.error('Database save error:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Database connection issue. Please check MongoDB connection.',
        error: saveError.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Meal of the day created successfully',
      data: mealOfTheDay
    });

  } catch (error) {
    console.error('Error creating meal of the day:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get all meals of the day
// @route   GET /api/v1/hotel/meal-of-the-day
// @access  Public
const getAllMealsOfTheDay = async (req, res) => {
  try {
    const { branchId, date, isActive } = req.query;

    let query = {};
    
    if (branchId) {
      query.branchId = branchId;
    }
    
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const meals = await MealOfTheDay.find(query)
      .populate('productId', 'name price image description')
      .populate('branchId', 'name address')
      .sort({ date: -1, featured: -1 });

    res.status(200).json({
      success: true,
      count: meals.length,
      data: meals
    });

  } catch (error) {
    console.error('Error fetching meals of the day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get meal of the day by ID
// @route   GET /api/v1/hotel/meal-of-the-day/:id
// @access  Public
const getMealOfTheDayById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid meal of the day ID'
      });
    }

    const meal = await MealOfTheDay.findById(id)
      .populate('productId', 'name price image description')
      .populate('branchId', 'name address');

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: 'Meal of the day not found'
      });
    }

    res.status(200).json({
      success: true,
      data: meal
    });

  } catch (error) {
    console.error('Error fetching meal of the day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Update meal of the day
// @route   PUT /api/v1/hotel/meal-of-the-day/:id
// @access  Private/Admin
const updateMealOfTheDay = async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = req.body;

    // Parse JSON strings from FormData
    try {
      if (typeof updateData.tags === 'string') updateData.tags = JSON.parse(updateData.tags);
      if (typeof updateData.allergens === 'string') updateData.allergens = JSON.parse(updateData.allergens);
      if (typeof updateData.nutritionalInfo === 'string') updateData.nutritionalInfo = JSON.parse(updateData.nutritionalInfo);
      
      // Convert numeric fields
      if (updateData.originalPrice) updateData.originalPrice = parseFloat(updateData.originalPrice);
      if (updateData.specialPrice) updateData.specialPrice = parseFloat(updateData.specialPrice);
      if (updateData.discount) updateData.discount = parseFloat(updateData.discount);
      if (updateData.availableQuantity) updateData.availableQuantity = parseInt(updateData.availableQuantity);
      if (updateData.preparationTime) updateData.preparationTime = parseInt(updateData.preparationTime);
      if (updateData.featured !== undefined) updateData.featured = updateData.featured === 'true' || updateData.featured === true;
    } catch (error) {
      console.error('Error parsing FormData fields:', error);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid meal of the day ID'
      });
    }

    // Handle image upload if provided
    if (req.file) {
      try {
        const imageUrl = await uploadFile2(req.file, 'meal-of-the-day');
        updateData.image = imageUrl;

      } catch (error) {
        console.error('Error uploading image:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload image'
        });
      }
    }

    // Recalculate discount if prices are updated
    if (updateData.originalPrice && updateData.specialPrice) {
      updateData.discount = Math.round(((updateData.originalPrice - updateData.specialPrice) / updateData.originalPrice) * 100);
    }

    const meal = await MealOfTheDay.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('productId', 'name price image description')
      .populate('branchId', 'name address');

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: 'Meal of the day not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Meal of the day updated successfully',
      data: meal
    });

  } catch (error) {
    console.error('Error updating meal of the day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Delete meal of the day
// @route   DELETE /api/v1/hotel/meal-of-the-day/:id
// @access  Private/Admin
const deleteMealOfTheDay = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid meal of the day ID'
      });
    }

    const meal = await MealOfTheDay.findByIdAndDelete(id);

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: 'Meal of the day not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Meal of the day deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting meal of the day:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get meals of the day by branch
// @route   GET /api/v1/hotel/meal-of-the-day/branch/:branchId
// @access  Public
const getMealsByBranch = async (req, res) => {
  try {
    const { branchId } = req.params;




    if (!branchId) {

      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(branchId)) {

      return res.status(400).json({
        success: false,
        message: 'Invalid branch ID format'
      });
    }

    const meals = await MealOfTheDay.find({ branchId: branchId })
      .populate('productId', 'name price image description')
      .populate('branchId', 'name address')
      .sort({ createdAt: -1 });


    res.status(200).json({
      success: true,
      count: meals.length,
      data: meals
    });

  } catch (error) {
    console.error('❌ Error fetching meals by branch:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get today's meal of the day
// @route   GET /api/v1/hotel/meal-of-the-day/today/:branchId
// @access  Public
const getTodaysMeal = async (req, res) => {
  try {
    const { branchId } = req.params;
    
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todaysMeal = await MealOfTheDay.findOne({
      branchId: branchId,
      date: { $gte: startOfDay, $lte: endOfDay },
      isActive: true
    })
      .populate('productId', 'name price image description')
      .populate('branchId', 'name address');

    if (!todaysMeal) {
      return res.status(404).json({
        success: false,
        message: 'No meal of the day found for today'
      });
    }

    res.status(200).json({
      success: true,
      data: todaysMeal
    });

  } catch (error) {
    console.error('Error fetching today\'s meal:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createMealOfTheDay,
  getAllMealsOfTheDay,
  getMealsByBranch,
  getMealOfTheDayById,
  updateMealOfTheDay,
  deleteMealOfTheDay,
  getTodaysMeal
};
