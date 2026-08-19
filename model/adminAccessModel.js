const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const permissionSchema = new mongoose.Schema({
  view: { type: Boolean, default: false },
  edit: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
}, { _id: false })
const adminAccessSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
  },
  isSuperAdmin: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  permissions: {
    branches:          { type: permissionSchema, default: () => ({}) },
    categories:        { type: permissionSchema, default: () => ({}) },
    menu:              { type: permissionSchema, default: () => ({}) },
    tableQrGenerator:  { type: permissionSchema, default: () => ({}) },
    tables:            { type: permissionSchema, default: () => ({}) },
    tableReservations: { type: permissionSchema, default: () => ({}) },
    categorizedOrders: { type: permissionSchema, default: () => ({}) },
    salesReports:      { type: permissionSchema, default: () => ({}) },
    qrUploads:         { type: permissionSchema, default: () => ({}) },
    contactMessages:   { type: permissionSchema, default: () => ({}) },
    members:           { type: permissionSchema, default: () => ({}) },
    events:            { type: permissionSchema, default: () => ({}) },
    gallery:           { type: permissionSchema, default: () => ({}) },
    staffUsers:        { type: permissionSchema, default: () => ({}) },
    counterUsers:      { type: permissionSchema, default: () => ({}) },
    servers:           { type: permissionSchema, default: () => ({}) },
    purchaseUsers:     { type: permissionSchema, default: () => ({}) },
    categoryAccess:    { type: permissionSchema, default: () => ({}) },
    moduleAccess:      { type: permissionSchema, default: () => ({}) },
  },
}, {
  timestamps: true,
})
// Hash password before saving
adminAccessSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})
// Compare password method
adminAccessSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}
module.exports = mongoose.model("AdminAccess", adminAccessSchema)
