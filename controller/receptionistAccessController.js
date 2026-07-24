const ReceptionistAccess = require('../model/receptionistAccessModel');
const jwt = require('jsonwebtoken');

// Get all receptionist access users
exports.getAllReceptionistAccess = async (req, res) => {
  try {
    const users = await ReceptionistAccess.find()
      .select('-password')
      .sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching receptionist access users:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get receptionist access by ID
exports.getReceptionistAccessById = async (req, res) => {
  try {
    const user = await ReceptionistAccess.findById(req.params.id)
      .select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Receptionist not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create receptionist access user
exports.createReceptionistAccess = async (req, res) => {
  try {
    const { name, username, password, branchId, branchName } = req.body;

    // Check if username already exists
    const existingUser = await ReceptionistAccess.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const newUser = await ReceptionistAccess.create({
      name,
      username: username.toLowerCase(),
      password,
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

// Update receptionist access user
exports.updateReceptionistAccess = async (req, res) => {
  try {
    const { name, username, password, branchId, branchName, isActive } = req.body;
    
    const user = await ReceptionistAccess.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Receptionist not found' });
    }

    // Check if new username already exists (excluding current user)
    if (username && username.toLowerCase() !== user.username) {
      const existingUser = await ReceptionistAccess.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
    }

    // Update fields
    if (name) user.name = name;
    if (username) user.username = username.toLowerCase();
    if (password) user.password = password;
    if (branchId !== undefined) user.branchId = branchId;
    if (branchName !== undefined) user.branchName = branchName;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json(userResponse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete receptionist access user
exports.deleteReceptionistAccess = async (req, res) => {
  try {
    const user = await ReceptionistAccess.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Receptionist not found' });
    }
    res.status(200).json({ message: 'Receptionist deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Login receptionist
exports.loginReceptionistAccess = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password' });
    }

    const user = await ReceptionistAccess.findOne({ username: username.toLowerCase(), isActive: true });

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
        branchId: user.branchId,
        branchName: user.branchName,
        type: 'receptionist'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

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