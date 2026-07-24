const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const Member = require("../models/Member");

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "jagalikoota_secret_key", {
    expiresIn: "30d",
  });
};

// @desc    Member login
// @route   POST /api/v1/hotel/member-auth/login
// @access  Public
const loginMember = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  // Find member with password field
  const member = await Member.findOne({ email }).select("+password");

  if (!member) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  // Check if membership is active
  if (!member.isActive) {
    res.status(403);
    throw new Error("Your membership is inactive. Please contact admin.");
  }

  // Check if membership is valid
  if (!member.isValidMembership()) {
    res.status(403);
    throw new Error("Your membership has expired. Please contact admin.");
  }

  // Compare password
  const isMatch = await member.comparePassword(password);

  if (!isMatch) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  // Update last login
  member.lastLogin = new Date();
  await member.save();

  // Generate token
  const token = generateToken(member._id);

  res.json({
    success: true,
    message: "Login successful",
    token,
    member: {
      id: member._id,
      memberNumber: member.memberNumber,
      name: member.name,
      email: member.email,
      phone: member.phone,
      profileImage: member.profileImage,
      membershipType: member.membershipType,
      walletBalance: member.walletBalance,
      validUntil: member.validUntil,
      qrCode: member.qrCode,
    },
  });
});

// @desc    Get member profile
// @route   GET /api/v1/hotel/member-auth/profile
// @access  Private
const getMemberProfile = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.member.id);

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  res.json({
    success: true,
    member,
  });
});

// @desc    Update member profile
// @route   PUT /api/v1/hotel/member-auth/update-profile
// @access  Private
const updateMemberProfile = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.member.id);

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  const { name, phone, dateOfBirth, address, profileImage } = req.body;

  // Update fields
  if (name) member.name = name;
  if (phone) member.phone = phone;
  if (dateOfBirth) member.dateOfBirth = dateOfBirth;
  if (address) member.address = address;
  if (profileImage) member.profileImage = profileImage;

  const updatedMember = await member.save();

  res.json({
    success: true,
    message: "Profile updated successfully",
    member: updatedMember,
  });
});

// @desc    Change password
// @route   POST /api/v1/hotel/member-auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    res.status(400);
    throw new Error("Please provide old and new password");
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error("New password must be at least 6 characters");
  }

  const member = await Member.findById(req.member.id).select("+password");

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  // Verify old password
  const isMatch = await member.comparePassword(oldPassword);

  if (!isMatch) {
    res.status(401);
    throw new Error("Old password is incorrect");
  }

  // Update password
  member.password = newPassword;
  await member.save();

  res.json({
    success: true,
    message: "Password changed successfully",
  });
});

// @desc    Request password reset (send OTP/email)
// @route   POST /api/v1/hotel/member-auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Please provide email");
  }

  const member = await Member.findOne({ email });

  if (!member) {
    // Don't reveal if email exists
    res.json({
      success: true,
      message: "If email exists, password reset instructions have been sent",
    });
    return;
  }

  // TODO: Implement OTP/email sending logic here
  // For now, just return success message

  res.json({
    success: true,
    message: "Password reset instructions have been sent to your email",
  });
});

module.exports = {
  loginMember,
  getMemberProfile,
  updateMemberProfile,
  changePassword,
  forgotPassword,
};
