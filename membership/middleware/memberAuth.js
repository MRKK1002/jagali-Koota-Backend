const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Member = require("../models/Member");

// Protect member routes
const protectMember = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "jagalikoota_secret_key"
      );

      // Get member from token
      req.member = await Member.findById(decoded.id).select("-password");

      if (!req.member) {
        res.status(401);
        throw new Error("Not authorized, member not found");
      }

      // Check if member is active
      if (!req.member.isActive) {
        res.status(403);
        throw new Error("Your membership is inactive");
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});

module.exports = { protectMember };
