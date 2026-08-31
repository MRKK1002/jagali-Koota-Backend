const express = require("express");
const router = express.Router();
const AffiliatedMember = require("../models/AffiliatedMember");

// GET all affiliated members (with pagination, search, filters)
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20, search, clubName } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { clubName: { $regex: search, $options: "i" } },
      ];
    }
    if (clubName) query.clubName = { $regex: clubName, $options: "i" };

    const [members, total] = await Promise.all([
      AffiliatedMember.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      AffiliatedMember.countDocuments(query),
    ]);

    res.json({
      success: true,
      members,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single affiliated member
router.get("/:id", async (req, res) => {
  try {
    const member = await AffiliatedMember.findById(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, member });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create affiliated member
router.post("/", async (req, res) => {
  try {
    const { name, phone, email, address, clubName, clubLocation, membershipId, purpose, visitDate, notes } = req.body;

    if (!name || !phone || !clubName) {
      return res.status(400).json({ success: false, message: "Name, phone, and club name are required" });
    }

    const member = await AffiliatedMember.create({
      name, phone, email, address, clubName, clubLocation, membershipId, purpose,
      visitDate: visitDate || new Date(), notes,
    });

    res.status(201).json({ success: true, message: "Affiliated member added", member });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update affiliated member
router.put("/:id", async (req, res) => {
  try {
    const member = await AffiliatedMember.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!member) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Updated", member });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE affiliated member
router.delete("/:id", async (req, res) => {
  try {
    const member = await AffiliatedMember.findByIdAndDelete(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
