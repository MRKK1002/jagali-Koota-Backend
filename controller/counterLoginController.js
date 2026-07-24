const Counter = require("../model/counterLoginModel")

// Generate a 6-digit OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Send OTP for counter registration
exports.sendOtpForCounterRegistration = async (req, res) => {
  try {
    const { name, mobile } = req.body

    if (!name.trim()) {
      return res.status(400).json({ message: "Name is required" })
    }
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" })
    }

    let counter = await Counter.findOne({ mobile })
    if (counter) {
      return res.status(400).json({ message: "Mobile number already registered" })
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    counter = new Counter({
      name,
      mobile,
      otp,
      otpExpires,
    })

    await counter.save()

    // Simulate SMS by returning OTP (replace with SMS service in production)
    res.status(200).json({ message: "OTP sent to your mobile number", otp })
  } catch (error) {
    res.status(500).json({ message: "Error sending OTP", error: error.message })
  }
}

// Send OTP for counter login
exports.sendOtpForCounterLogin = async (req, res) => {
  try {
    const { mobile } = req.body

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" })
    }

    const counter = await Counter.findOne({ mobile })
    if (!counter) {
      return res.status(404).json({ message: "Counter staff not found. Please register first." })
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); 

    counter.otp = otp
    counter.otpExpires = otpExpires
    await counter.save()

    // Simulate SMS by returning OTP (replace with SMS service in production)
    res.status(200).json({ message: "OTP sent to your mobile number", otp })
  } catch (error) {
    res.status(500).json({ message: "Error sending OTP", error: error.message })
  }
}

// Verify OTP for counter registration or login
exports.verifyOtpForCounter = async (req, res) => {
  try {
    const { mobile, otp, isRegistration } = req.body

    const counter = await Counter.findOne({ mobile })
    if (!counter) {
      return res.status(404).json({ message: "Counter staff not found" })
    }

    if (counter.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" })
    }

    if (counter.otpExpires < Date.now()) {
      return res.status(400).json({ message: "OTP has expired" })
    }

    // Clear OTP fields after successful verification
    counter.otp = null
    counter.otpExpires = null
    await counter.save()

    const response = {
      message: isRegistration ? "Counter registration successful" : "Counter login successful",
      counter: {
        _id: counter._id,
        name: counter.name,
        mobile: counter.mobile,
      },
    }

    res.status(200).json(response)
  } catch (error) {
    res.status(500).json({ message: "Error verifying OTP", error: error.message })
  }
}

// Resend OTP for counter registration
exports.resendOtpForCounterRegistration = async (req, res) => {
  try {
    const { mobile } = req.body

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" })
    }

    const counter = await Counter.findOne({ mobile })
    if (!counter) {
      return res.status(404).json({ message: "Counter staff not found. Please register first." })
    }

    const otp = generateOtp()
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    counter.otp = otp
    counter.otpExpires = otpExpires
    await counter.save()

    // Simulate SMS by returning OTP (replace with SMS service in production)
    res.status(200).json({ message: "OTP resent to your mobile number", otp })
  } catch (error) {
    res.status(500).json({ message: "Error resending OTP", error: error.message })
  }
}

// Resend OTP for counter login
exports.resendOtpForCounterLogin = async (req, res) => {
  try {
    const { mobile } = req.body

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" })
    }

    const counter = await Counter.findOne({ mobile })
    if (!counter) {
      return res.status(404).json({ message: "Counter staff not found. Please register first." })
    }

    const otp = generateOtp()
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    counter.otp = otp
    counter.otpExpires = otpExpires
    await counter.save()

    // Simulate SMS by returning OTP (replace with SMS service in production)
    res.status(200).json({ message: "OTP resent to your mobile number", otp })
  } catch (error) {
    res.status(500).json({ message: "Error resending OTP", error: error.message })
  }
}

// CRUD Operations for Admin Management

// Get all counters
exports.getAllCounters = async (req, res) => {
  try {
    const counters = await Counter.find({}).select("-otp -otpExpires").sort({ createdAt: -1 })
    res.status(200).json(counters)
  } catch (error) {
    res.status(500).json({ message: "Error fetching counters", error: error.message })
  }
}

// Register counter (for admin)
exports.registerCounter = async (req, res) => {
  try {
    const { name, mobile } = req.body

    if (!name.trim()) {
      return res.status(400).json({ message: "Name is required" })
    }
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" })
    }

    const existingCounter = await Counter.findOne({ mobile })
    if (existingCounter) {
      return res.status(400).json({ message: "Mobile number already registered" })
    }

    const counter = new Counter({
      name: name.trim(),
      mobile,
    })

    await counter.save()

    const response = {
      _id: counter._id,
      name: counter.name,
      mobile: counter.mobile,
      createdAt: counter.createdAt,
      updatedAt: counter.updatedAt,
    }

    res.status(201).json(response)
  } catch (error) {
    res.status(500).json({ message: "Error creating counter", error: error.message })
  }
}

// Update counter
exports.updateCounter = async (req, res) => {
  try {
    const { id } = req.params
    const { name, mobile } = req.body

    if (!name.trim()) {
      return res.status(400).json({ message: "Name is required" })
    }
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" })
    }

    // Check if mobile number is already used by another counter
    const existingCounter = await Counter.findOne({ mobile, _id: { $ne: id } })
    if (existingCounter) {
      return res.status(400).json({ message: "Mobile number already registered" })
    }

    const counter = await Counter.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        mobile,
        // Clear OTP fields when updating
        otp: null,
        otpExpires: null,
      },
      { new: true, runValidators: true },
    ).select("-otp -otpExpires")

    if (!counter) {
      return res.status(404).json({ message: "Counter not found" })
    }

    res.status(200).json(counter)
  } catch (error) {
    res.status(500).json({ message: "Error updating counter", error: error.message })
  }
}

// Delete counter
exports.deleteCounter = async (req, res) => {
  try {
    const { id } = req.params

    const counter = await Counter.findByIdAndDelete(id)
    if (!counter) {
      return res.status(404).json({ message: "Counter not found" })
    }

    res.status(200).json({ message: "Counter deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Error deleting counter", error: error.message })
  }
}