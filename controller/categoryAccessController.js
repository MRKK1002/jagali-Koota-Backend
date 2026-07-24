const CategoryAccess = require('../model/categoryAccessModel');
const jwt = require('jsonwebtoken');

// Get all category access users
exports.getAllCategoryAccess = async (req, res) => {
  try {
    const users = await CategoryAccess.find()
      .select('-password')
      .sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching category access users:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get category access by ID
exports.getCategoryAccessById = async (req, res) => {
  try {
    const user = await CategoryAccess.findById(req.params.id)
      .select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Category access user not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create category access user
exports.createCategoryAccess = async (req, res) => {
  try {
    const { name, username, password, cancelPassword, categoryId, categoryName, branchId, branchName } = req.body;

    // Check if username already exists
    const existingUser = await CategoryAccess.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const newUser = await CategoryAccess.create({
      name,
      username: username.toLowerCase(),
      password,
      cancelPassword,
      categoryId,
      categoryName,
      branchId,
      branchName,
    });

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update category access user
exports.updateCategoryAccess = async (req, res) => {
  try {
    const { name, username, password, cancelPassword, categoryId, categoryName, branchId, branchName, isActive } = req.body;
    
    const user = await CategoryAccess.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Category access user not found' });
    }

    // Check if new username already exists (excluding current user)
    if (username && username.toLowerCase() !== user.username) {
      const existingUser = await CategoryAccess.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
    }

    // Update fields
    if (name) user.name = name;
    if (username) user.username = username.toLowerCase();
    if (password) user.password = password; // Will be hashed by pre-save hook
    if (cancelPassword) user.cancelPassword = cancelPassword;
    if (categoryId) user.categoryId = categoryId;
    if (categoryName) user.categoryName = categoryName;
    if (branchId !== undefined) user.branchId = branchId;
    if (branchName !== undefined) user.branchName = branchName;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json(userResponse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete category access user
exports.deleteCategoryAccess = async (req, res) => {
  try {
    const user = await CategoryAccess.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Category access user not found' });
    }
    res.status(200).json({ message: 'Category access user deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Login category access user
exports.loginCategoryAccess = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password' });
    }

    const user = await CategoryAccess.findOne({ username: username.toLowerCase(), isActive: true });

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        categoryId: user.categoryId,
        categoryName: user.categoryName,
        branchId: user.branchId,
        type: 'category-staff'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      message: 'Login successful',
      token,
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};