const asyncHandler = require("express-async-handler");
const Blacklist = require("../models/Blacklist");

// @desc    Add person to blacklist
// @route   POST /api/v1/hotel/blacklist/add
// @access  Admin
const addToBlacklist = asyncHandler(async (req, res) => {
  const { name, phone, reason, notes, blacklistedBy } = req.body;

  if (!name || !phone || !reason) {
    res.status(400);
    throw new Error("Name, phone, and reason are required");
  }

  // Check if already blacklisted (active entry with same phone)
  const existing = await Blacklist.findOne({ phone: phone.trim(), isActive: true });
  if (existing) {
    res.status(400);
    throw new Error("This phone number is already blacklisted");
  }

  const entry = await Blacklist.create({
    name: name.trim(),
    phone: phone.trim(),
    reason: reason.trim(),
    notes: notes?.trim() || "",
    blacklistedBy: blacklistedBy?.trim() || "Admin",
  });

  res.status(201).json({
    success: true,
    message: "Person added to blacklist",
    entry,
  });
});

// @desc    Get all blacklisted persons
// @route   GET /api/v1/hotel/blacklist/all
// @access  Admin
const getAllBlacklisted = asyncHandler(async (req, res) => {
  const entries = await Blacklist.find({ isActive: true }).sort({ createdAt: -1 });

  res.json({
    success: true,
    count: entries.length,
    entries,
  });
});

// @desc    Check if a person is blacklisted (by phone or name)
// @route   GET /api/v1/hotel/blacklist/check?phone=xxx&name=xxx
// @access  Staff/Counter/Admin
const checkBlacklist = asyncHandler(async (req, res) => {
  const { phone, name } = req.query;

  if (!phone && !name) {
    res.status(400);
    throw new Error("Please provide phone or name to check");
  }

  let query = { isActive: true };
  let conditions = [];

  if (phone) {
    conditions.push({ phone: phone.trim() });
  }
  if (name) {
    // Case-insensitive partial match on name
    conditions.push({ name: { $regex: name.trim(), $options: "i" } });
  }

  query.$or = conditions;

  const matches = await Blacklist.find(query);

  const isBlacklisted = matches.length > 0;

  res.json({
    success: true,
    isBlacklisted,
    matches: isBlacklisted ? matches : [],
    message: isBlacklisted
      ? `⚠️ BLACKLISTED: ${matches.length} match(es) found`
      : "✓ Not blacklisted",
  });
});

// @desc    Remove person from blacklist (soft delete)
// @route   PUT /api/v1/hotel/blacklist/remove/:id
// @access  Admin
const removeFromBlacklist = asyncHandler(async (req, res) => {
  const entry = await Blacklist.findById(req.params.id);

  if (!entry) {
    res.status(404);
    throw new Error("Blacklist entry not found");
  }

  entry.isActive = false;
  await entry.save();

  res.json({
    success: true,
    message: "Person removed from blacklist",
  });
});

// @desc    Update blacklist entry
// @route   PUT /api/v1/hotel/blacklist/update/:id
// @access  Admin
const updateBlacklistEntry = asyncHandler(async (req, res) => {
  const entry = await Blacklist.findById(req.params.id);

  if (!entry) {
    res.status(404);
    throw new Error("Blacklist entry not found");
  }

  const { name, phone, reason, notes } = req.body;

  if (name) entry.name = name.trim();
  if (phone) entry.phone = phone.trim();
  if (reason) entry.reason = reason.trim();
  if (notes !== undefined) entry.notes = notes.trim();

  await entry.save();

  res.json({
    success: true,
    message: "Blacklist entry updated",
    entry,
  });
});

// @desc    Permanently delete blacklist entry
// @route   DELETE /api/v1/hotel/blacklist/:id
// @access  Admin
const deleteBlacklistEntry = asyncHandler(async (req, res) => {
  const entry = await Blacklist.findById(req.params.id);

  if (!entry) {
    res.status(404);
    throw new Error("Blacklist entry not found");
  }

  await entry.deleteOne();

  res.json({
    success: true,
    message: "Blacklist entry permanently deleted",
  });
});

module.exports = {
  addToBlacklist,
  getAllBlacklisted,
  checkBlacklist,
  removeFromBlacklist,
  updateBlacklistEntry,
  deleteBlacklistEntry,
};
