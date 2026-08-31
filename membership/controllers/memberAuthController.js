const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const Member = require("../models/Member");

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "jagalikoota_secret_key", {
    expiresIn: "30d",
  });
};

// @desc    Member login (supports email OR phone)
// @route   POST /api/v1/hotel/member-auth/login
// @access  Public
const loginMember = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email/phone and password");
  }

  // Support login via email OR phone number
  const isPhone = /^\d{10,}$/.test(email.replace(/[\s\-\+]/g, ""));
  let member;
  if (isPhone) {
    member = await Member.findOne({ phone: email }).select("+password");
  } else {
    member = await Member.findOne({ email }).select("+password");
  }

  if (!member) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  // Must have completed registration
  if (member.registrationStatus === "pending") {
    res.status(403);
    throw new Error("Registration not completed. Please complete your registration in the Member App first.");
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
    throw new Error("Invalid credentials");
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
      membershipId: member.membershipId,
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
    effectiveDiscount: member.getEffectiveDiscount(),
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

  const { name, phone, dateOfBirth, address, profileImage, discountPercentage } = req.body;

  // Update fields
  if (name) member.name = name;
  if (phone) member.phone = phone;
  if (dateOfBirth) member.dateOfBirth = dateOfBirth;
  if (address) member.address = address;
  if (profileImage) member.profileImage = profileImage;
  if (discountPercentage !== undefined) member.discountPercentage = Number(discountPercentage);

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
  const { email, phone } = req.body;

  if (!email && !phone) {
    res.status(400);
    throw new Error("Please provide email or phone");
  }

  // Look up member by email or phone
  const query = email ? { email } : { phone };
  const member = await Member.findOne(query);

  if (!member) {
    res.status(404);
    throw new Error("No account found with these details");
  }

  if (!member.email) {
    res.status(400);
    throw new Error("No email registered for this account. Please contact admin.");
  }

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  member.resetOtp = otp;
  member.resetOtpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await member.save();

  // Send OTP via email
  try {
    const { sendOtpEmail } = require("../../services/emailService");
    await sendOtpEmail(member.email, member.name, otp);
  } catch (emailErr) {
    console.error("[forgotPassword] Email send failed:", emailErr.message);
    res.status(500);
    throw new Error("Failed to send OTP email. Please try again.");
  }

  // Mask the email for the response (e.g. am***@gmail.com)
  const [local, domain] = member.email.split("@");
  const maskedEmail = `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;

  res.json({
    success: true,
    message: `OTP sent to ${maskedEmail}`,
    email: member.email,
  });
});

// @desc    Reset password using OTP
// @route   POST /api/v1/hotel/member-auth/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { email, phone, otp, newPassword } = req.body;

  if ((!email && !phone) || !otp || !newPassword) {
    res.status(400);
    throw new Error("Please provide email/phone, OTP, and new password");
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const query = email ? { email } : { phone };
  const member = await Member.findOne(query);

  if (!member) {
    res.status(404);
    throw new Error("Account not found");
  }

  // Verify OTP
  if (!member.resetOtp || member.resetOtp !== otp) {
    res.status(400);
    throw new Error("Invalid OTP");
  }

  if (!member.resetOtpExpiry || new Date() > member.resetOtpExpiry) {
    res.status(400);
    throw new Error("OTP has expired. Please request a new one.");
  }

  // Set new password (pre-save hook will hash it)
  member.password = newPassword;
  member.resetOtp = null;
  member.resetOtpExpiry = null;
  await member.save();

  res.json({
    success: true,
    message: "Password reset successfully. You can now log in.",
  });
});

// @desc    Check phone — returns member status for unified app flow
// @route   POST /api/v1/hotel/member-auth/check-phone
// @access  Public
const checkPhone = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    res.status(400);
    throw new Error("Please provide phone number");
  }

  const member = await Member.findOne({ phone });

  if (!member) {
    res.status(404);
    throw new Error("Account not found. Please contact admin.");
  }

  // Return status so app can decide next step
  // "completed" → show password field (login)
  // "pending" → show complete profile screen
  res.json({
    success: true,
    registrationStatus: member.registrationStatus,
    member: {
      id: member._id,
      name: member.name,
      membershipId: member.membershipId,
      membershipType: member.membershipType,
      phone: member.phone,
    },
  });
});

// @desc    Complete registration — member sets password + uploads documents
// @route   POST /api/v1/hotel/member-auth/complete-registration
// @access  Public
const completeRegistration = asyncHandler(async (req, res) => {
  const { phone, password, email, dateOfBirth, address } = req.body;

  if (!phone || !password) {
    res.status(400);
    throw new Error("Please provide phone and password");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const member = await Member.findOne({ phone });

  if (!member) {
    res.status(404);
    throw new Error("No membership found for this phone number");
  }

  if (member.registrationStatus === "completed") {
    res.status(400);
    throw new Error("Registration already completed. Please login.");
  }

  // Check email uniqueness if provided
  if (email) {
    const emailTaken = await Member.findOne({ email, _id: { $ne: member._id } });
    if (emailTaken) {
      res.status(400);
      throw new Error("This email is already in use by another member");
    }
    member.email = email;
  }

  // Set password and mark registration complete
  member.password = password;
  member.registrationStatus = "completed";
  member.isActive = true;

  // Optional fields
  if (dateOfBirth) member.dateOfBirth = dateOfBirth;
  if (address) member.address = address;

  await member.save();

  // Generate QR code now that registration is complete
  const QRCode = require("qrcode");
  const qrData = JSON.stringify({
    memberId: member._id,
    memberNumber: member.memberNumber,
    membershipId: member.membershipId,
    name: member.name,
    membershipType: member.membershipType,
  });

  const qrCodeBase64 = await QRCode.toDataURL(qrData, {
    width: 300,
    margin: 2,
  });

  member.qrCode = qrCodeBase64;
  await member.save();

  // Generate token so member is logged in immediately
  const token = generateToken(member._id);

  res.json({
    success: true,
    message: "Registration completed successfully! Welcome aboard.",
    token,
    member: {
      id: member._id,
      memberNumber: member.memberNumber,
      membershipId: member.membershipId,
      name: member.name,
      email: member.email,
      phone: member.phone,
      membershipType: member.membershipType,
      walletBalance: member.walletBalance,
      validUntil: member.validUntil,
      qrCode: member.qrCode,
    },
  });
});

module.exports = {
  loginMember,
  getMemberProfile,
  updateMemberProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  checkPhone,
  completeRegistration,
};
