const asyncHandler = require("express-async-handler");
const Member = require("../models/Member");
const QRCode = require("qrcode");
const { uploadFile2 } = require("../../middleware/AWS");

// @desc    Create new member (Admin only)
// @route   POST /api/v1/hotel/member/create
// @access  Private/Admin
const createMember = asyncHandler(async (req, res) => {
  const { name, email, password, phone, dateOfBirth, address, joiningDate, validUntil, initialWalletBalance } = req.body;

  if (!name || !email || !password || !phone) {
    res.status(400);
    throw new Error("Please provide all required fields: name, email, password, phone");
  }

  // Check if email already exists
  const existingMember = await Member.findOne({ email });
  if (existingMember) {
    res.status(400);
    throw new Error("Member with this email already exists");
  }

  // Create member
  const member = await Member.create({
    name,
    email,
    password,
    phone,
    dateOfBirth,
    address,
    joiningDate: joiningDate || Date.now(),
    validUntil: validUntil || new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    walletBalance: initialWalletBalance || 0,
  });

  // Generate QR code
  const qrData = JSON.stringify({
    memberId: member._id,
    memberNumber: member.memberNumber,
    name: member.name,
    membershipType: member.membershipType,
  });

  const qrCodeBase64 = await QRCode.toDataURL(qrData, {
    width: 300,
    margin: 2,
  });

  member.qrCode = qrCodeBase64;
  await member.save();

  res.status(201).json({
    success: true,
    message: "Member created successfully",
    member,
  });
});

// @desc    Get all members (Admin only)
// @route   GET /api/v1/hotel/member/all
// @access  Private/Admin
const getAllMembers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, membershipType, isActive } = req.query;

  const query = {};

  // Search by name, email, or member number
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { memberNumber: { $regex: search, $options: "i" } },
    ];
  }

  // Filter by membership type
  if (membershipType) {
    query.membershipType = membershipType;
  }

  // Filter by active status
  if (isActive !== undefined) {
    query.isActive = isActive === "true";
  }

  const members = await Member.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const count = await Member.countDocuments(query);

  res.json({
    success: true,
    members,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    total: count,
  });
});

// @desc    Get single member by ID (Admin only)
// @route   GET /api/v1/hotel/member/:id
// @access  Private/Admin
const getMemberById = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  res.json({
    success: true,
    member,
  });
});

// @desc    Update member (Admin only)
// @route   PUT /api/v1/hotel/member/:id
// @access  Private/Admin
const updateMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  const {
    name,
    email,
    phone,
    dateOfBirth,
    isActive,
    validUntil,
    joiningDate,
    address,
  } = req.body;

  // Update fields
  if (name) member.name = name;
  if (email) member.email = email;
  if (phone) member.phone = phone;
  if (dateOfBirth) member.dateOfBirth = dateOfBirth;
  if (isActive !== undefined) member.isActive = isActive;
  if (validUntil) member.validUntil = validUntil;
  if (joiningDate) member.joiningDate = joiningDate;
  if (address) member.address = address;

  const updatedMember = await member.save();

  res.json({
    success: true,
    message: "Member updated successfully",
    member: updatedMember,
  });
});

// @desc    Delete/Deactivate member (Admin only)
// @route   DELETE /api/v1/hotel/member/:id
// @access  Private/Admin
const deleteMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  // Soft delete - just deactivate
  member.isActive = false;
  await member.save();

  res.json({
    success: true,
    message: "Member deactivated successfully",
  });
});

// @desc    Upload member document (Aadhar/Passport)
// @route   POST /api/v1/hotel/member/upload-document
// @access  Private/Admin
const uploadDocument = asyncHandler(async (req, res) => {
  const { memberId, documentType } = req.body;

  if (!memberId || !documentType || !req.file) {
    res.status(400);
    throw new Error("Please provide memberId, documentType, and file");
  }

  if (!["aadhar", "passport", "pan"].includes(documentType)) {
    res.status(400);
    throw new Error("Document type must be 'aadhar', 'passport', or 'pan'");
  }

  const member = await Member.findById(memberId);

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  // Upload to S3
  const fileUrl = await uploadFile2(req.file, "documents");

  // Update member document
  member.documents[documentType] = fileUrl;
  await member.save();

  res.json({
    success: true,
    message: `${documentType.toUpperCase()} uploaded successfully`,
    documentUrl: fileUrl,
  });
});

// @desc    Scan member QR code (Staff/Counter)
// @route   POST /api/v1/hotel/member/scan-qr
// @access  Private
const scanMemberQR = asyncHandler(async (req, res) => {
  const { qrData } = req.body;

  if (!qrData) {
    res.status(400);
    throw new Error("Please provide QR code data");
  }

  let memberData;
  try {
    memberData = JSON.parse(qrData);
  } catch (error) {
    res.status(400);
    throw new Error("Invalid QR code data");
  }

  const member = await Member.findById(memberData.memberId);

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  // Check if membership is valid
  const isValid = member.isValidMembership();

  res.json({
    success: true,
    isValid,
    member: {
      id: member._id,
      memberNumber: member.memberNumber,
      name: member.name,
      phone: member.phone,
      membershipType: member.membershipType,
      walletBalance: member.walletBalance,
      validUntil: member.validUntil,
      isActive: member.isActive,
    },
    message: isValid ? "Valid membership" : "Membership expired or inactive",
  });
});

module.exports = {
  createMember,
  getAllMembers,
  getMemberById,
  updateMember,
  deleteMember,
  uploadDocument,
  scanMemberQR,
};
