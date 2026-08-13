const Menu = require('../model/menuModel');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { uploadFile2, deleteFile } = require('../middleware/AWS');
exports.createMenuItem = async (req, res) => {
  try {
    const { 
      name,
      itemName,
      description, 
      price,
      gstRate,
      quantities,
      prices,
      menuTypes,
      categoryId,
      subcategoryId,
      branchId,
      subscriptionEnabled,
      subscriptionPlans,
      subscriptionAmount,
      subscriptionDiscount,
      subscriptionDuration,
      subscription3Days,
      subscription1Week,
      subscription1Month,
      subscription30Days,
      subscription3DaysDiscount,
      subscription1WeekDiscount,
      subscription1MonthDiscount,
      subscription3DaysPrice,
      subscription1WeekPrice,
      subscription1MonthPrice,
      _id
    } = req.body;




    // Parse JSON strings if needed
    let parsedQuantities = quantities;
    if (typeof quantities === 'string') {
      try {
        parsedQuantities = JSON.parse(quantities);
      } catch (error) {
        console.error('Error parsing quantities:', error);
      }
    }

    let parsedPrices = prices;
    if (typeof prices === 'string') {
      try {
        parsedPrices = JSON.parse(prices);
      } catch (error) {
        console.error('Error parsing prices:', error);
      }
    }

    let parsedMenuTypes = menuTypes;
    if (typeof menuTypes === 'string') {
      try {
        parsedMenuTypes = JSON.parse(menuTypes);
      } catch (error) {
        console.error('Error parsing menuTypes:', error);
      }
    }

    let parsedSubscriptionPlans = subscriptionPlans;
    if (typeof subscriptionPlans === 'string') {
      try {
        parsedSubscriptionPlans = JSON.parse(subscriptionPlans);
      } catch (error) {
        console.error('Error parsing subscriptionPlans:', error);
        parsedSubscriptionPlans = [];
      }
    }

    // Handle image upload
    let image = null;
    if (req.file) {
      try {
        let fileBuffer;
        
        // Check if file has a path (diskStorage) or buffer (memoryStorage)
        if (req.file.path) {
          fileBuffer = await fs.promises.readFile(req.file.path);
        } else if (req.file.buffer) {
          fileBuffer = req.file.buffer;
        }
        
        if (fileBuffer) {
          // Always use local storage path for reliability
          if (req.file.path) {
            const uploadsIndex = req.file.path.indexOf('uploads');
            image = uploadsIndex !== -1 ? req.file.path.substring(uploadsIndex).replace(/\\/g, '/') : req.file.path;

          }
          
          // Try S3 upload as backup (optional)
          try {
            const s3Url = await uploadFile2(fileBuffer, req.file.originalname, req.file.mimetype);
            if (s3Url) {

              // Keep local file - don't delete it
            }
          } catch (error) {

          }
        }
      } catch (error) {
        console.error('Error handling image upload:', error);
        // Continue without image if upload fails
      }
    } else {

    }

    const menuItemData = {
      itemName: itemName || name,
      name: itemName || name,
      description,
      price: parseFloat(price) || 0,
      gstRate: parseFloat(gstRate) || 0,
      quantities: parsedQuantities,
      prices: parsedPrices,
      menuTypes: parsedMenuTypes || parsedQuantities,
      categoryId,
      subcategoryId: subcategoryId || null,
      branchId,
      image,
      subscriptionEnabled: subscriptionEnabled === 'true' || subscriptionEnabled === true,
      subscriptionPlans: parsedSubscriptionPlans || [],
      subscriptionAmount: parseFloat(subscriptionAmount) || 0,
      subscriptionDiscount: parseFloat(subscriptionDiscount) || 0,
      subscriptionDuration: subscriptionDuration || '3days',
      subscription3Days: parseFloat(subscription3Days) || 0,
      subscription1Week: parseFloat(subscription1Week) || 0,
      subscription1Month: parseFloat(subscription1Month) || parseFloat(subscription30Days) || 0,
      subscription30Days: parseFloat(subscription30Days) || parseFloat(subscription1Month) || 0,
      subscription3DaysDiscount: parseFloat(subscription3DaysDiscount) || 0,
      subscription1WeekDiscount: parseFloat(subscription1WeekDiscount) || 0,
      subscription1MonthDiscount: parseFloat(subscription1MonthDiscount) || 0,
      subscription3DaysPrice: parseFloat(subscription3DaysPrice) || 0,
      subscription1WeekPrice: parseFloat(subscription1WeekPrice) || 0,
      subscription1MonthPrice: parseFloat(subscription1MonthPrice) || 0
    };

    // If _id is provided (from dual backend sync), use it
    if (_id) {
      menuItemData._id = _id;
    }

    const menuItem = new Menu(menuItemData);

    await menuItem.save();
    res.status(201).json({ message: 'Menu item created successfully', menuItem });
  } catch (error) {
    console.error('Error creating menu item:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(400).json({ message: 'Error creating menu item', error: error.message });
  }
};
exports.getAllMenuItems = async (req, res) => {
  try {
    const { 
      categoryId, 
      subcategoryId, 
      branchId,
      search,
      page = 1,
      limit = 100,
      sortBy = 'name',
      sortOrder = 'asc',
      startDate,
      endDate,
      isActive
    } = req.query;

    // Build filter object
    const filter = {};
    if (categoryId) filter.categoryId = categoryId;
    if (subcategoryId) filter.subcategoryId = subcategoryId;
    if (branchId) filter.branchId = branchId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Search filter - search by name, itemName, description, or number in name
    // Support both full phrase match and individual word matches
    if (search && search.trim() !== '' && search !== '000') {
      const searchTerm = search.trim();
      
      // Try to match the full search term first (case-insensitive)
      const searchRegex = new RegExp(searchTerm, 'i');
      
      // Also split search into words for more flexible matching
      const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
      
      // Build search conditions
      const searchConditions = [
        { name: searchRegex },
        { itemName: searchRegex },
        { description: searchRegex }
      ];
      
      // If multiple words, also search for items containing all words (in any order)
      if (searchWords.length > 1) {
        const wordRegexes = searchWords.map(word => new RegExp(word, 'i'));
        searchConditions.push({
          $and: wordRegexes.map(regex => ({
            $or: [
              { name: regex },
              { itemName: regex }
            ]
          }))
        });
      }
      
      filter.$or = searchConditions;
      
      // console.log('🔍 Search filter:', JSON.stringify(filter.$or, null, 2));
    }
    
    // console.log('📋 Final filter:', JSON.stringify(filter, null, 2));
    
    // Date range filter - filter by createdAt or updatedAt
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add 1 day to include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        filter.createdAt.$lt = endDateTime;
      }
    }
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Build a base filter (without categoryId/subcategoryId) for category counts
    const baseFilter = { ...filter };
    delete baseFilter.categoryId;
    delete baseFilter.subcategoryId;

    // Build a filter without any branch/category/subcategory for branch counts
    const branchBaseFilter = { ...baseFilter };
    delete branchBaseFilter.branchId;

    // Execute query with pagination + category/subcategory/branch counts
    const [menuItems, totalCount, categoryCounts, subcategoryCounts, branchCounts] = await Promise.all([
      Menu.find(filter)
        .populate('categoryId', 'name')
        .populate('subcategoryId', 'name')
        .populate('branchId', 'name')
        .select('name itemName description price gstRate quantities prices menuTypes image categoryId subcategoryId branchId stock lowStockAlert isActive subscriptionEnabled subscriptionPlans subscriptionAmount subscriptionDiscount subscriptionDuration subscription3Days subscription1Week subscription1Month subscription30Days subscription3DaysDiscount subscription1WeekDiscount subscription1MonthDiscount subscription3DaysPrice subscription1WeekPrice subscription1MonthPrice createdAt updatedAt')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Menu.countDocuments(filter),
      // Count items per category (using base filter without category/subcategory)
      Menu.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } }
      ]),
      // Count items per subcategory (using filter with categoryId but without subcategoryId)
      Menu.aggregate([
        { $match: { ...baseFilter, ...(categoryId ? { categoryId: new mongoose.Types.ObjectId(categoryId) } : {}) } },
        { $group: { _id: '$subcategoryId', count: { $sum: 1 } } }
      ]),
      // Count items per branch (no branch/category/subcategory filter)
      Menu.aggregate([
        { $match: branchBaseFilter },
        { $group: { _id: '$branchId', count: { $sum: 1 } } }
      ])
    ]);

    if (menuItems.length > 0) {

    }
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;
    
    // Convert category/subcategory/branch counts to objects { id: count }
    const categoryCountsMap = {};
    categoryCounts.forEach(c => { if (c._id) categoryCountsMap[c._id.toString()] = c.count; });
    
    const subcategoryCountsMap = {};
    subcategoryCounts.forEach(c => { if (c._id) subcategoryCountsMap[c._id.toString()] = c.count; });

    const branchCountsMap = {};
    branchCounts.forEach(c => { if (c._id) branchCountsMap[c._id.toString()] = c.count; });

    res.status(200).json({
      success: true,
      data: menuItems,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage,
        hasPrevPage
      },
      categoryCounts: categoryCountsMap,
      subcategoryCounts: subcategoryCountsMap,
      branchCounts: branchCountsMap,
      filters: {
        categoryId,
        subcategoryId,
        branchId,
        search,
        startDate,
        endDate,
        isActive
      }
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching menu items', 
      error: error.message 
    });
  }
};
exports.getMenuItemById = async (req, res) => {
  try {
    const menuItem = await Menu.findById(req.params.id)
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name')
      .populate('branchId', 'name')
      .select('name description price gstRate image categoryId subcategoryId branchId stock lowStockAlert isActive subscriptionEnabled subscriptionPlans subscriptionAmount subscriptionDiscount subscriptionDuration subscription3Days subscription1Week subscription1Month subscription30Days subscription3DaysDiscount subscription1WeekDiscount subscription1MonthDiscount subscription3DaysPrice subscription1WeekPrice subscription1MonthPrice');
      
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.status(200).json(menuItem);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching menu item', error: error.message });
  }
};
exports.updateMenuItem = async (req, res) => {
  try {
    const { 
      name,
      itemName,
      description, 
      price,
      gstRate,
      quantities,
      prices,
      menuTypes,
      categoryId,
      subcategoryId,
      branchId,
      subscriptionEnabled,
      subscriptionPlans,
      subscriptionAmount,
      subscriptionDiscount,
      subscriptionDuration,
      subscription3Days,
      subscription1Week,
      subscription1Month,
      subscription30Days,
      subscription3DaysDiscount,
      subscription1WeekDiscount,
      subscription1MonthDiscount,
      subscription3DaysPrice,
      subscription1WeekPrice,
      subscription1MonthPrice
    } = req.body;

    // Parse JSON strings if needed
    let parsedQuantities = quantities;
    if (typeof quantities === 'string') {
      try {
        parsedQuantities = JSON.parse(quantities);
      } catch (error) {
        console.error('Error parsing quantities:', error);
      }
    }

    let parsedPrices = prices;
    if (typeof prices === 'string') {
      try {
        parsedPrices = JSON.parse(prices);
      } catch (error) {
        console.error('Error parsing prices:', error);
      }
    }

    let parsedMenuTypes = menuTypes;
    if (typeof menuTypes === 'string') {
      try {
        parsedMenuTypes = JSON.parse(menuTypes);
      } catch (error) {
        console.error('Error parsing menuTypes:', error);
      }
    }

    // Parse subscriptionPlans if it's a JSON string
    let parsedSubscriptionPlans = subscriptionPlans;
    if (typeof subscriptionPlans === 'string') {
      try {
        parsedSubscriptionPlans = JSON.parse(subscriptionPlans);
      } catch (error) {
        console.error('Error parsing subscriptionPlans:', error);
        parsedSubscriptionPlans = [];
      }
    }
    
    const updateData = { 
      name: itemName || name,
      itemName: itemName || name,
      description, 
      price: parseFloat(price) || 0,
      gstRate: parseFloat(gstRate) || 0,
      quantities: parsedQuantities,
      prices: parsedPrices,
      menuTypes: parsedMenuTypes || parsedQuantities,
      categoryId,
      subcategoryId: subcategoryId || null,
      branchId,
      subscriptionEnabled: subscriptionEnabled === 'true' || subscriptionEnabled === true,
      subscriptionPlans: parsedSubscriptionPlans || [],
      subscriptionAmount: parseFloat(subscriptionAmount) || 0,
      subscriptionDiscount: parseFloat(subscriptionDiscount) || 0,
      subscriptionDuration: subscriptionDuration || '3days',
      subscription3Days: parseFloat(subscription3Days) || 0,
      subscription1Week: parseFloat(subscription1Week) || 0,
      subscription1Month: parseFloat(subscription1Month) || parseFloat(subscription30Days) || 0,
      subscription30Days: parseFloat(subscription30Days) || parseFloat(subscription1Month) || 0,
      subscription3DaysDiscount: parseFloat(subscription3DaysDiscount) || 0,
      subscription1WeekDiscount: parseFloat(subscription1WeekDiscount) || 0,
      subscription1MonthDiscount: parseFloat(subscription1MonthDiscount) || 0,
      subscription3DaysPrice: parseFloat(subscription3DaysPrice) || 0,
      subscription1WeekPrice: parseFloat(subscription1WeekPrice) || 0,
      subscription1MonthPrice: parseFloat(subscription1MonthPrice) || 0
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    // If a new image is uploaded, update the image path and delete the old image
    if (req.file) {
      try {
        let fileBuffer;
        
        // Check if file has a path (diskStorage) or buffer (memoryStorage)
        if (req.file.path) {
          fileBuffer = await fs.promises.readFile(req.file.path);
        } else if (req.file.buffer) {
          fileBuffer = req.file.buffer;
        }
        
        if (fileBuffer) {
          // Always use local storage path for reliability
          if (req.file.path) {
            const uploadsIndex = req.file.path.indexOf('uploads');
            updateData.image = uploadsIndex !== -1 ? req.file.path.substring(uploadsIndex).replace(/\\/g, '/') : req.file.path;

          }
          
          // Try S3 upload as backup (optional)
          try {
            const s3Url = await uploadFile2(fileBuffer, req.file.originalname, req.file.mimetype);
            if (s3Url) {

              // Keep local file - don't delete it
            }
          } catch (error) {

          }
          
          // Find the menu item to get the old image path and delete it
          const existingMenuItem = await Menu.findById(req.params.id);
          if (existingMenuItem && existingMenuItem.image) {
            deleteFile(existingMenuItem.image);
          }
        }
      } catch (error) {
        console.error('Error handling image upload during update:', error);
        // Continue with update even if image upload fails
      }
    }

    const menuItem = await Menu.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    res.status(200).json({ message: 'Menu item updated successfully', menuItem });
  } catch (error) {
    console.error('Error updating menu item:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      errors: error.errors
    });
    res.status(400).json({ message: 'Error updating menu item', error: error.message });
  }
};
exports.deleteMenuItem = async (req, res) => {
  try {
    const menuItem = await Menu.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    // Delete the associated image file
    if (menuItem.image) {
      deleteFile(menuItem.image);
    }

    await Menu.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting menu item', error: error.message });
  }
};
exports.getMenuItemsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const menuItems = await Menu.find({ 
      categoryId
    }).sort({ name: 1 });
    
    res.status(200).json(menuItems);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching menu items', error: error.message });
  }
}; 