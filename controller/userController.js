const User = require('../model/userModel');
const fs = require('fs');
const path = require('path');
const { uploadFile2, deleteFile } = require('../middleware/AWS');

// Generate a 6-digit OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP for registration
exports.sendOtpForRegistration = async (req, res) => {
  try {
    const { name, mobile } = req.body;

    if (!name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
    }

    let user = await User.findOne({ mobile });
    if (user) {
      return res.status(400).json({ message: 'Mobile number already registered' });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user = new User({
      name,
      mobile,
      otp,
      otpExpires,
    });

    await user.save();

    // Simulate SMS by returning OTP (replace with SMS service in production)
    res.status(200).json({ message: 'OTP sent to your mobile number', otp });
  } catch (error) {
    res.status(500).json({ message: 'Error sending OTP', error: error.message });
  }
};

// Send OTP for login
exports.sendOtpForLogin = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({ message: 'User not found. Please register first.' });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Simulate SMS by returning OTP (replace with SMS service in production)
    res.status(200).json({ message: 'OTP sent to your mobile number', otp });
  } catch (error) {
    res.status(500).json({ message: 'Error sending OTP', error: error.message });
  }
};

// Verify OTP and complete registration/login
exports.verifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // Clear OTP fields after successful verification
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.status(200).json({ 
      message: 'OTP verified successfully', 
      user: {
        _id: user._id,
        name: user.name,
        mobile: user.mobile,
        // Don't include image here as it's not added during registration
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};
// Create a new user (not used directly, as registration is handled via OTP)
exports.createUser = async (req, res) => {
  try {
    const { name, mobile } = req.body;
    const image = req.file ? await uploadFile2(req.file,"user") : null;

    const user = new User({
      name,
      mobile,
      image,
    });

    await user.save();
    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    res.status(400).json({ message: 'Error creating user', error: error.message });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

// Get a single user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

// Update a user

// Update a user
exports.updateUser = async (req, res) => {
  try {
    const { name, mobile, email } = req.body;
    const updateData = { name };

    // Validate and update mobile if provided
    if (mobile) {
      if (!/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
      }
      
      // Check if mobile already exists for another user
      const existingUser = await User.findOne({ 
        mobile,
        _id: { $ne: req.params.id } // Exclude current user from the check
      });
      
      if (existingUser) {
        return res.status(400).json({ message: 'Mobile number already in use by another account' });
      }
      
      updateData.mobile = mobile;
    }

    // Add email if provided and valid
    if (email) {
      if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ message: 'Please enter a valid email address' });
      }
      
      // Check if email already exists for another user
      const existingUser = await User.findOne({ 
        email: email.toLowerCase().trim(),
        _id: { $ne: req.params.id } // Exclude current user from the check
      });
      
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use by another account' });
      }
      
      updateData.email = email.toLowerCase().trim();
    } else {
      // If email is being removed (set to null or empty)
      updateData.email = null;
    }

    // If a new image is uploaded, update the image path and delete the old image
    if (req.file) {
      updateData.image =await uploadFile2(req.file, "user");

      // Find the user to get the old image path
      const user = await User.findById(req.params.id);
      if (user.image) {
       await deleteFile(user.image);
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    res.status(400).json({ message: 'Error updating user', error: error.message });
  }
};
// Delete a user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete the associated image file
    if (user.image) {
      fs.unlink(path.join(__dirname, '..', user.image), (err) => {
        if (err) console.error('Error deleting image:', err);
      });
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};



// Resend OTP for registration
exports.resendOtpForRegistration = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({ message: 'User not found. Please register first.' });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Simulate SMS by returning OTP (replace with SMS service in production)
    res.status(200).json({ message: 'OTP resent to your mobile number', otp });
  } catch (error) {
    res.status(500).json({ message: 'Error resending OTP', error: error.message });
  }
};

// Resend OTP for login
exports.resendOtpForLogin = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({ message: 'User not found. Please register first.' });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Simulate SMS by returning OTP (replace with SMS service in production)
    res.status(200).json({ message: 'OTP resent to your mobile number', otp });
  } catch (error) {
    res.status(500).json({ message: 'Error resending OTP', error: error.message });
  }
};