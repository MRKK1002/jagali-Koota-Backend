const asyncHandler = require("express-async-handler");
const path = require("path");
const fs = require("fs");
const Sport = require("../models/Sport");
const SportSubscription = require("../models/SportSubscription");
const Member = require("../models/Member");
const WalletTransaction = require("../models/WalletTransaction");

const UPLOAD_DIR = path.join(__dirname, "../../uploads/sports");

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Save uploaded file and return public path
const saveImage = (file) => {
  if (!file) return null;
  const ext = path.extname(file.originalname) || ".jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  fs.writeFileSync(filePath, file.buffer);
  return `/uploads/sports/${fileName}`;
};

// ─── ADMIN: Create Sport ─────────────────────────────────────────────────────
// POST /api/v1/hotel/sports
const createSport = asyncHandler(async (req, res) => {
  const { name, description, priceMonthly, priceYearly, schedule, maxMembers, branchId } = req.body;

  if (!name || priceMonthly === undefined) {
    res.status(400);
    throw new Error("Name and monthly price are required");
  }

  const image = saveImage(req.file);

  const sport = await Sport.create({
    name,
    description: description || "",
    image,
    priceMonthly,
    priceYearly: priceYearly || 0,
    schedule: schedule || "",
    maxMembers: maxMembers || 0,
    branchId: branchId || null,
  });

  res.status(201).json({ success: true, message: "Sport created", sport });
});

// ─── ADMIN: Update Sport ─────────────────────────────────────────────────────
// PUT /api/v1/hotel/sports/:id
const updateSport = asyncHandler(async (req, res) => {
  const sport = await Sport.findById(req.params.id);
  if (!sport) {
    res.status(404);
    throw new Error("Sport not found");
  }

  const fields = ["name", "description", "priceMonthly", "priceYearly", "schedule", "maxMembers", "branchId", "isActive"];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) sport[f] = req.body[f];
  });

  // Handle image upload
  if (req.file) {
    sport.image = saveImage(req.file);
  }

  await sport.save();
  res.json({ success: true, message: "Sport updated", sport });
});

// ─── ADMIN: Delete Sport ─────────────────────────────────────────────────────
// DELETE /api/v1/hotel/sports/:id
const deleteSport = asyncHandler(async (req, res) => {
  const sport = await Sport.findById(req.params.id);
  if (!sport) {
    res.status(404);
    throw new Error("Sport not found");
  }

  await Sport.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: "Sport deleted" });
});

// ─── PUBLIC: Get All Sports (with pagination + filters) ──────────────────────
// GET /api/v1/hotel/sports
const getAllSports = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, branchId, active } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  const query = {};
  if (active === "true") query.isActive = true;
  else if (active === "false") query.isActive = false;
  // else: no isActive filter (show all)
  if (branchId) query.branchId = branchId;
  if (search) query.name = { $regex: search, $options: "i" };

  const [sports, total] = await Promise.all([
    Sport.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Sport.countDocuments(query),
  ]);

  res.json({
    success: true,
    sports,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

// ─── PUBLIC: Get Sport by ID ─────────────────────────────────────────────────
// GET /api/v1/hotel/sports/:id
const getSportById = asyncHandler(async (req, res) => {
  const sport = await Sport.findById(req.params.id).lean();
  if (!sport) {
    res.status(404);
    throw new Error("Sport not found");
  }
  res.json({ success: true, sport });
});

// ─── MEMBER: Subscribe to a Sport ────────────────────────────────────────────
// POST /api/v1/hotel/sports/:id/subscribe
const subscribeSport = asyncHandler(async (req, res) => {
  const { duration = "monthly", paymentMethod = "wallet", autoRenew = false } = req.body;
  const memberId = req.member._id;
  const sportId = req.params.id;

  const sport = await Sport.findById(sportId);
  if (!sport || !sport.isActive) {
    res.status(404);
    throw new Error("Sport not found or inactive");
  }

  // Check capacity
  if (sport.maxMembers > 0 && sport.currentMembers >= sport.maxMembers) {
    res.status(400);
    throw new Error("This sport is full. No more subscriptions available.");
  }

  // Check if already has active subscription
  const existing = await SportSubscription.findOne({
    memberId,
    sportId,
    status: "active",
  });
  if (existing) {
    res.status(400);
    throw new Error("You already have an active subscription for this sport");
  }

  // Calculate amount and dates
  const amount = duration === "yearly" ? sport.priceYearly : sport.priceMonthly;
  const startDate = new Date();
  const endDate = new Date();
  if (duration === "yearly") {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  // Deduct from wallet if wallet payment
  if (paymentMethod === "wallet") {
    const member = await Member.findById(memberId);
    if (!member || (member.walletBalance || 0) < amount) {
      res.status(400);
      throw new Error(
        `Insufficient wallet balance. Required: ₹${amount}, Available: ₹${(member?.walletBalance || 0).toFixed(2)}`
      );
    }

    await WalletTransaction.createTransaction({
      memberId,
      type: "debit",
      amount,
      description: `Sports subscription: ${sport.name} (${duration})`,
      createdBy: "system",
      metadata: { source: "sport_subscription", sportId: String(sportId), duration },
    });
  }

  // Create subscription
  const subscription = await SportSubscription.create({
    memberId,
    sportId,
    startDate,
    endDate,
    duration,
    amount,
    paymentMethod,
    status: "active",
    autoRenew,
  });

  // Increment current members
  sport.currentMembers += 1;
  await sport.save();

  res.status(201).json({
    success: true,
    message: `Subscribed to ${sport.name} successfully!`,
    subscription,
  });

  // 🔔 Notify member (push + email)
  try {
    const { sendToMember } = require("../../services/firebaseNotification");
    sendToMember(
      memberId,
      "Subscription Confirmed!",
      `You're subscribed to ${sport.name} (${duration}). ₹${amount} deducted from wallet.`,
      { type: "sport_subscription", sportId: String(sportId), amount: String(amount) }
    ).catch(() => {});
  } catch (_) {}

  // 📧 Email confirmation
  try {
    const member = await Member.findById(memberId).select("name email");
    if (member && member.email) {
      const { sendConfirmationEmail } = require("../../services/emailService");
      sendConfirmationEmail(member.email, {
        name: member.name,
        title: "Subscription Confirmed!",
        subtitle: `You've subscribed to ${sport.name}`,
        rows: [
          { label: "Sport / Activity", value: sport.name },
          { label: "Plan", value: duration === "yearly" ? "Yearly" : "Monthly" },
          { label: "Valid From", value: new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
          { label: "Valid Until", value: new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
        ],
        amount,
        note: "Enjoy your subscription! You can view and manage it in the Member App.",
      }).catch((e) => console.warn("[Sub Email] Failed:", e.message));
    }
  } catch (_) {}
});

// ─── MEMBER: Get My Subscriptions ────────────────────────────────────────────
// GET /api/v1/hotel/sports/my-subscriptions
const getMySubscriptions = asyncHandler(async (req, res) => {
  const memberId = req.member._id;
  const { status, page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  const query = { memberId };
  if (status) query.status = status;

  const [subscriptions, total] = await Promise.all([
    SportSubscription.find(query)
      .populate("sportId", "name image schedule priceMonthly priceYearly")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    SportSubscription.countDocuments(query),
  ]);

  res.json({
    success: true,
    subscriptions,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
});

// ─── MEMBER: Cancel Subscription ─────────────────────────────────────────────
// PUT /api/v1/hotel/sports/subscriptions/:id/cancel
const cancelSubscription = asyncHandler(async (req, res) => {
  const sub = await SportSubscription.findById(req.params.id).populate("sportId");
  if (!sub) {
    res.status(404);
    throw new Error("Subscription not found");
  }
  if (String(sub.memberId) !== String(req.member._id)) {
    res.status(403);
    throw new Error("Not authorized");
  }
  if (sub.status !== "active") {
    res.status(400);
    throw new Error("Subscription is not active");
  }

  sub.status = "cancelled";
  sub.cancelledAt = new Date();
  await sub.save();

  // Decrement current members
  if (sub.sportId) {
    await Sport.findByIdAndUpdate(sub.sportId._id, { $inc: { currentMembers: -1 } });
  }

  res.json({ success: true, message: "Subscription cancelled" });
});

// ─── MEMBER: Upgrade Subscription (monthly → yearly) ─────────────────────────
// PUT /api/v1/hotel/sports/subscriptions/:id/upgrade
const upgradeSubscription = asyncHandler(async (req, res) => {
  const sub = await SportSubscription.findById(req.params.id).populate("sportId");
  if (!sub) {
    res.status(404);
    throw new Error("Subscription not found");
  }
  if (String(sub.memberId) !== String(req.member._id)) {
    res.status(403);
    throw new Error("Not authorized");
  }
  if (sub.status !== "active") {
    res.status(400);
    throw new Error("Subscription is not active");
  }
  if (sub.duration === "yearly") {
    res.status(400);
    throw new Error("Already on yearly plan");
  }

  const sport = sub.sportId;
  if (!sport || !sport.priceYearly) {
    res.status(400);
    throw new Error("Yearly plan not available for this sport");
  }

  // Calculate upgrade cost (yearly price minus what they already paid for monthly)
  const upgradeCost = sport.priceYearly - sub.amount;
  const chargeAmount = Math.max(0, upgradeCost);

  // Deduct from wallet
  if (chargeAmount > 0) {
    const member = await Member.findById(req.member._id);
    if (!member || (member.walletBalance || 0) < chargeAmount) {
      res.status(400);
      throw new Error(
        `Insufficient wallet balance. Upgrade cost: ₹${chargeAmount}, Available: ₹${(member?.walletBalance || 0).toFixed(2)}`
      );
    }

    await WalletTransaction.createTransaction({
      memberId: req.member._id,
      type: "debit",
      amount: chargeAmount,
      description: `Upgrade to yearly: ${sport.name}`,
      createdBy: "system",
      metadata: { source: "sport_upgrade", sportId: String(sport._id) },
    });
  }

  // Update subscription to yearly
  sub.duration = "yearly";
  sub.amount = sport.priceYearly;
  sub.endDate = new Date();
  sub.endDate.setFullYear(sub.endDate.getFullYear() + 1);
  await sub.save();

  res.json({
    success: true,
    message: `Upgraded to yearly! ${chargeAmount > 0 ? `₹${chargeAmount} deducted.` : ''}`,
    subscription: sub,
    charged: chargeAmount,
  });

  // 🔔 Notify member
  try {
    const { sendToMember } = require("../../services/firebaseNotification");
    sendToMember(
      req.member._id,
      "Upgraded to Yearly!",
      `${sport.name} upgraded to yearly plan. ${chargeAmount > 0 ? `₹${chargeAmount} deducted from wallet.` : 'No extra charge.'}`,
      { type: "sport_subscription", sportId: String(sport._id), amount: String(chargeAmount) }
    ).catch(() => {});
  } catch (_) {}

  // 📧 Email confirmation for upgrade
  try {
    const member = await Member.findById(req.member._id).select("name email");
    if (member && member.email) {
      const { sendConfirmationEmail } = require("../../services/emailService");
      sendConfirmationEmail(member.email, {
        name: member.name,
        title: "Upgraded to Yearly Plan!",
        subtitle: `${sport.name} is now on a yearly plan`,
        rows: [
          { label: "Sport / Activity", value: sport.name },
          { label: "Plan", value: "Yearly" },
          { label: "Valid Until", value: new Date(sub.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
        ],
        amount: chargeAmount,
        note: chargeAmount > 0 ? "The upgrade difference was deducted from your wallet." : "No extra charge for this upgrade.",
      }).catch((e) => console.warn("[Upgrade Email] Failed:", e.message));
    }
  } catch (_) {}
});

// ─── ADMIN: Get all subscriptions (with filters + pagination) ────────────────
// GET /api/v1/hotel/sports/admin/subscriptions
const getAdminSubscriptions = asyncHandler(async (req, res) => {
  const { sportId, status, memberId, page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  const query = {};
  if (sportId) query.sportId = sportId;
  if (status) query.status = status;
  if (memberId) query.memberId = memberId;

  const [subscriptions, total] = await Promise.all([
    SportSubscription.find(query)
      .populate("memberId", "name phone email memberNumber")
      .populate("sportId", "name image priceMonthly")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    SportSubscription.countDocuments(query),
  ]);

  res.json({
    success: true,
    subscriptions,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
});

module.exports = {
  createSport,
  updateSport,
  deleteSport,
  getAllSports,
  getSportById,
  subscribeSport,
  getMySubscriptions,
  cancelSubscription,
  upgradeSubscription,
  getAdminSubscriptions,
};
