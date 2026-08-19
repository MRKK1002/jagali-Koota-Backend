const AdminAccess = require("../model/adminAccessModel")
const asyncHandler = require("express-async-handler")
const jwt = require("jsonwebtoken")

const JWT_SECRET = process.env.JWT_SECRET || "jagali-koota-admin-secret-key"

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, isSuperAdmin: user.isSuperAdmin },
    JWT_SECRET,
    { expiresIn: "7d" }
  )
}

// ─── POST /admin-access/login ────────────────────────────────────────────────
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400)
    throw new Error("Email and password are required")
  }

  const user = await AdminAccess.findOne({ email: email.toLowerCase().trim() })
  if (!user) {
    res.status(401)
    throw new Error("Invalid email or password")
  }

  if (!user.isActive) {
    res.status(403)
    throw new Error("Account is deactivated. Contact Super Admin.")
  }

  const isMatch = await user.comparePassword(password)
  if (!isMatch) {
    res.status(401)
    throw new Error("Invalid email or password")
  }

  const token = generateToken(user)

  res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      permissions: user.isSuperAdmin ? null : user.permissions, // null = full access
    },
  })
})

// ─── POST /admin-access ──────────────────────────────────────────────────────
// Create a new admin access user (only Super Admin should call this)
exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, isSuperAdmin, permissions } = req.body

  if (!name || !email || !password) {
    res.status(400)
    throw new Error("Name, email, and password are required")
  }

  // Check if email already exists
  const existing = await AdminAccess.findOne({ email: email.toLowerCase().trim() })
  if (existing) {
    res.status(400)
    throw new Error("A user with this email already exists")
  }

  const user = await AdminAccess.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    isSuperAdmin: isSuperAdmin || false,
    permissions: permissions || {},
  })

  res.status(201).json({
    success: true,
    message: "User created successfully",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      isActive: user.isActive,
      permissions: user.permissions,
      createdAt: user.createdAt,
    },
  })
})

// ─── GET /admin-access ───────────────────────────────────────────────────────
// List all admin access users
exports.getUsers = asyncHandler(async (req, res) => {
  const users = await AdminAccess.find()
    .select("-password")
    .sort({ createdAt: -1 })
    .lean()

  res.status(200).json({
    success: true,
    count: users.length,
    users,
  })
})

// ─── GET /admin-access/:id ───────────────────────────────────────────────────
exports.getUserById = asyncHandler(async (req, res) => {
  const user = await AdminAccess.findById(req.params.id).select("-password").lean()
  if (!user) {
    res.status(404)
    throw new Error("User not found")
  }

  res.status(200).json({ success: true, user })
})

// ─── PUT /admin-access/:id ───────────────────────────────────────────────────
// Update user (name, email, permissions, isActive). Password update is separate.
exports.updateUser = asyncHandler(async (req, res) => {
  const { name, email, permissions, isActive, isSuperAdmin, password } = req.body

  const user = await AdminAccess.findById(req.params.id)
  if (!user) {
    res.status(404)
    throw new Error("User not found")
  }

  // Update fields
  if (name !== undefined) user.name = name.trim()
  if (email !== undefined) {
    const emailLower = email.toLowerCase().trim()
    // Check uniqueness if email changed
    if (emailLower !== user.email) {
      const existing = await AdminAccess.findOne({ email: emailLower })
      if (existing) {
        res.status(400)
        throw new Error("A user with this email already exists")
      }
      user.email = emailLower
    }
  }
  if (permissions !== undefined) user.permissions = permissions
  if (isActive !== undefined) user.isActive = isActive
  if (isSuperAdmin !== undefined) user.isSuperAdmin = isSuperAdmin
  if (password && password.trim()) user.password = password.trim() // pre-save hook will hash

  await user.save()

  res.status(200).json({
    success: true,
    message: "User updated successfully",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      isActive: user.isActive,
      permissions: user.permissions,
      updatedAt: user.updatedAt,
    },
  })
})

// ─── DELETE /admin-access/:id ────────────────────────────────────────────────
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await AdminAccess.findById(req.params.id)
  if (!user) {
    res.status(404)
    throw new Error("User not found")
  }

  // Prevent deleting the last super admin
  if (user.isSuperAdmin) {
    const superAdminCount = await AdminAccess.countDocuments({ isSuperAdmin: true })
    if (superAdminCount <= 1) {
      res.status(400)
      throw new Error("Cannot delete the last Super Admin")
    }
  }

  await AdminAccess.findByIdAndDelete(req.params.id)

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  })
})
