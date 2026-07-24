const PurchaseUser = require("../model/PurchaseUser")
const ProductSubmission = require("../model/ProductSubmission")

// Generate and send OTP using mathematical function
exports.sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body

    if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit phone number",
      })
    }

    // Find or create user
    let user = await PurchaseUser.findOne({ phoneNumber })
    if (!user) {
      user = new PurchaseUser({ phoneNumber })
      await user.save()
    }

    // Generate OTP using mathematical function
    const generateOtp = () => {
      // Use current timestamp and phone number for randomness
      const timestamp = Date.now()
      const phoneSum = phoneNumber.split("").reduce((sum, digit) => sum + Number.parseInt(digit), 0)

      // Mathematical formula to generate 6-digit OTP
      const seed = (timestamp + phoneSum) * 7919 // 7919 is a prime number
      const otp = Math.abs(seed % 900000) + 100000 // Ensures 6-digit number

      return otp.toString()
    }

    const generatedOtp = generateOtp()

    // Store OTP in user record (in production, use Redis or temporary storage)
    await PurchaseUser.findOneAndUpdate(
      { phoneNumber },
      {
        generatedOtp: generatedOtp,
        otpGeneratedAt: new Date(),
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiry
      },
    )

    res.status(200).json({
      success: true,
      message: `OTP sent to ${phoneNumber}`,
      // Remove this in production
      otp: generatedOtp,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error sending OTP",
      error: error.message,
    })
  }
}

// Verify OTP and login
exports.verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      })
    }

    // Find user and check OTP
    const user = await PurchaseUser.findOne({ phoneNumber })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Check if OTP exists and is not expired
    if (!user.generatedOtp || !user.otpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please request a new OTP",
      })
    }

    if (new Date() > user.otpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP",
      })
    }

    if (otp !== user.generatedOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      })
    }

    // Update user login info and clear OTP
    const updatedUser = await PurchaseUser.findOneAndUpdate(
      { phoneNumber },
      {
        lastLoginAt: new Date(),
        otpVerifiedAt: new Date(),
        isActive: true,
        generatedOtp: null, // Clear OTP after successful verification
        otpGeneratedAt: null,
        otpExpiresAt: null,
      },
      { new: true },
    )

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: updatedUser._id,
        phoneNumber: updatedUser.phoneNumber,
        name: updatedUser.name,
        lastLoginAt: updatedUser.lastLoginAt,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error: error.message,
    })
  }
}

// Register a new user
exports.registerUser = async (req, res) => {
  try {
    const { phoneNumber, name } = req.body

    if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit phone number",
      })
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      })
    }

    // Check if user already exists
    const existingUser = await PurchaseUser.findOne({ phoneNumber })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this phone number already exists",
      })
    }

    // Create new user
    const user = new PurchaseUser({
      phoneNumber,
      name: name.trim(),
    })

    await user.save()

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: error.message,
    })
  }
}

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const { phoneNumber } = req.params

    const user = await PurchaseUser.findOne({ phoneNumber })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user profile",
      error: error.message,
    })
  }
}

// Get all users (admin function)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query

    const filter = {}
    if (isActive !== undefined) {
      filter.isActive = isActive === "true"
    }

    const users = await PurchaseUser.find(filter)
      .select("-__v")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await PurchaseUser.countDocuments(filter)

    res.status(200).json({
      success: true,
      users,
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    })
  }
}

// Update user status
exports.updateUserStatus = async (req, res) => {
  try {
    const { phoneNumber } = req.params
    const { isActive } = req.body

    const user = await PurchaseUser.findOneAndUpdate({ phoneNumber }, { isActive }, { new: true })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.status(200).json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      user,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating user status",
      error: error.message,
    })
  }
}

// Update user information
exports.updateUser = async (req, res) => {
  try {
    const { phoneNumber } = req.params
    const { name, newPhoneNumber } = req.body

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      })
    }

    if (newPhoneNumber && !/^\d{10}$/.test(newPhoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit phone number",
      })
    }

    // If phone number is being changed, check if new number already exists
    if (newPhoneNumber && newPhoneNumber !== phoneNumber) {
      const existingUser = await PurchaseUser.findOne({ phoneNumber: newPhoneNumber })
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User with this phone number already exists",
        })
      }
    }

    const updateData = {
      name: name.trim(),
      ...(newPhoneNumber && { phoneNumber: newPhoneNumber })
    }

    const user = await PurchaseUser.findOneAndUpdate(
      { phoneNumber }, 
      updateData, 
      { new: true }
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    })
  }
}

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { phoneNumber } = req.params

    // Check if user has any submissions
    const submissionsCount = await ProductSubmission.countDocuments({ userPhone: phoneNumber })
    if (submissionsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete user with existing submissions",
      })
    }

    const user = await PurchaseUser.findOneAndDelete({ phoneNumber })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    })
  }
}