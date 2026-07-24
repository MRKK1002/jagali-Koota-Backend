const Coupon = require("../model/couponModel");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { uploadFile2, deleteFile } = require("../middleware/AWS");

// Create a new coupon
exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscountAmount,
      startDate,
      endDate,
      usageLimit,
      applicableBranches,
      applicableCategories,
      applicableMenuItems,
      oneTimePerUser,
    } = req.body;

    const image = req.file ? await uploadFile2(req.file,"coupon") : null;

    if (!code || !description || !discountValue || !endDate) {
      return res.status(400).json({
        message: "Missing required fields",
        required: "code, description, discountValue, endDate",
      });
    }

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ message: "Coupon code already exists" });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      description,
      discountType: discountType || "percentage",
      discountValue,
      minOrderValue: minOrderValue || 0,
      maxDiscountAmount,
      startDate: startDate || new Date(),
      endDate,
      usageLimit,
      applicableBranches,
      applicableCategories,
      applicableMenuItems,
      oneTimePerUser: oneTimePerUser || false,
      image,
    });

    await coupon.save();
    res.status(201).json({ message: "Coupon created successfully", coupon });
  } catch (error) {
    res.status(500).json({ message: "Error creating coupon", error: error.message });
  }
};

// Get all coupons
exports.getAllCoupons = async (req, res) => {
  try {
    const { isActive, branchId } = req.query;

    const query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (branchId) {
      query.$or = [
        { applicableBranches: { $in: [branchId] } },
        { applicableBranches: { $size: 0 } },
      ];
    }

    const coupons = await Coupon.find(query)
      .populate("applicableBranches", "name")
      .sort({ createdAt: -1 });

    res.status(200).json(coupons);
  } catch (error) {
    res.status(500).json({ message: "Error fetching coupons", error: error.message });
  }
};

// Get a single coupon by ID
exports.getCouponById = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id)
      .populate("applicableBranches", "name")
      .populate("applicableCategories", "name")
      .populate("applicableMenuItems", "name price");

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    res.status(200).json(coupon);
  } catch (error) {
    res.status(500).json({ message: "Error fetching coupon", error: error.message });
  }
};

// Update a coupon
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscountAmount,
      startDate,
      endDate,
      usageLimit,
      applicableBranches,
      applicableCategories,
      applicableMenuItems,
      oneTimePerUser,
    } = req.body;

    const updateData = {
      code,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscountAmount,
      startDate,
      endDate,
      usageLimit,
      applicableBranches,
      applicableCategories,
      applicableMenuItems,
      oneTimePerUser,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    // If code is being updated, ensure it's uppercase and check for duplicates
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase();
      const existingCoupon = await Coupon.findOne({
        code: updateData.code,
        _id: { $ne: id },
      });
      if (existingCoupon) {
        return res.status(400).json({ message: "Coupon code already exists" });
      }
    }

    // If a new image is uploaded, update the image path and delete the old image
    if (req.file) {
      updateData.image = req.file ? await uploadFile2(req.file, "coupon") : null;
      const coupon = await Coupon.findById(id);
      if (coupon && coupon.image) {
       await deleteFile(coupon.image);
      }
    }

    const coupon = await Coupon.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    res.status(200).json({ message: "Coupon updated successfully", coupon });
  } catch (error) {
    res.status(500).json({ message: "Error updating coupon", error: error.message });
  }
};

// Delete a coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    // Delete the associated image file
    if (coupon.image) {
     await deleteFile(coupon.image);
    }

    await Coupon.findByIdAndDelete(id);
    res.status(200).json({ message: "Coupon deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting coupon", error: error.message });
  }
};

// Validate a coupon
exports.validateCoupon = async (req, res) => {
  try {
    const { code, orderValue, userId, branchId } = req.body;

    if (!code || !orderValue) {
      return res.status(400).json({
        message: "Missing required fields",
        required: "code, orderValue",
      });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    const validationResult = coupon.isValid(orderValue, userId, branchId);

    if (!validationResult.valid) {
      return res.status(400).json({
        message: validationResult.message,
        valid: false,
      });
    }

    res.status(200).json({
      message: validationResult.message,
      valid: true,
      discountAmount: validationResult.discountAmount,
      discountType: validationResult.discountType,
      discountValue: validationResult.discountValue,
      coupon,
    });
  } catch (error) {
    res.status(500).json({ message: "Error validating coupon", error: error.message });
  }
};

// Apply a coupon (mark as used)
exports.applyCoupon = async (req, res) => {
  try {
    const { code, userId, orderId } = req.body;

    if (!code || !userId) {
      return res.status(400).json({
        message: "Missing required fields",
        required: "code, userId",
      });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    coupon.usageCount += 1;

    if (coupon.oneTimePerUser) {
      const alreadyUsed = coupon.usedBy.some(
        (usage) => usage.userId.toString() === userId.toString()
      );

      if (!alreadyUsed) {
        coupon.usedBy.push({
          userId,
          usedAt: new Date(),
          orderId,
        });
      }
    }

    await coupon.save();

    res.status(200).json({
      message: "Coupon applied successfully",
      coupon,
    });
  } catch (error) {
    res.status(500).json({ message: "Error applying coupon", error: error.message });
  }
};