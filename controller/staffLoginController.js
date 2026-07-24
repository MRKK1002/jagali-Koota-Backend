const Staff = require("../model/staffLoginModel")

// Generate a 6-digit OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Get all staff users
exports.getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.find({}).sort({ createdAt: -1 })
    res.status(200).json(staff)
  } catch (error) {
    res.status(500).json({ message: "Error fetching staff users", error: error.message })
  }
}

// Get staff by ID
exports.getStaffById = async (req, res) => {
  try {
    const { id } = req.params
    const staff = await Staff.findById(id)

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" })
    }

    res.status(200).json(staff)
  } catch (error) {
    res.status(500).json({ message: "Error fetching staff user", error: error.message })
  }
}

// Direct registration without OTP
exports.registerStaffDirect = async (req, res) => {
  try {
    const { name, mobile } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" })
    }
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" })
    }

    // Check if mobile number already exists
    const existingStaff = await Staff.findOne({ mobile })
    if (existingStaff) {
      return res.status(400).json({ message: "Mobile number already registered" })
    }

    const staff = new Staff({
      name: name.trim(),
      mobile,
    })

    await staff.save()

    res.status(201).json({
      message: "Staff registered successfully",
      staff: {
        _id: staff._id,
        name: staff.name,
        mobile: staff.mobile,
        createdAt: staff.createdAt,
      },
    })
  } catch (error) {
    res.status(500).json({ message: "Error registering staff", error: error.message })
  }
}

// Update staff
exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params
    const { name, mobile } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" })
    }
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" })
    }

    // Check if mobile number already exists for other staff
    const existingStaff = await Staff.findOne({ mobile, _id: { $ne: id } })
    if (existingStaff) {
      return res.status(400).json({ message: "Mobile number already registered" })
    }

    const staff = await Staff.findByIdAndUpdate(id, { name: name.trim(), mobile }, { new: true, runValidators: true })

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" })
    }

    res.status(200).json({
      message: "Staff updated successfully",
      staff: {
        _id: staff._id,
        name: staff.name,
        mobile: staff.mobile,
        createdAt: staff.createdAt,
      },
    })
  } catch (error) {
    res.status(500).json({ message: "Error updating staff", error: error.message })
  }
}

// Delete staff
exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params

    const staff = await Staff.findByIdAndDelete(id)

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" })
    }

    res.status(200).json({ message: "Staff deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Error deleting staff", error: error.message })
  }
}

// Send OTP for staff registration
exports.sendOtpForStaffRegistration = async (req, res) => {
  try {
    const { name, mobile } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" })
    }
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" })
    }

    let staff = await Staff.findOne({ mobile })
    if (staff) {
      return res.status(400).json({ message: "Mobile number already registered" })
    }

    const otp = generateOtp()
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    staff = new Staff({
      name: name.trim(),
      mobile,
      otp,
      otpExpires,
    })

    await staff.save()

    // Simulate SMS by returning OTP (replace with SMS service in production)
    res.status(200).json({ message: "OTP sent to your mobile number", otp })
  } catch (error) {
    res.status(500).json({ message: "Error sending OTP", error: error.message })
  }
}

// Send OTP for staff login
exports.sendOtpForStaffLogin = async (req, res) => {
  try {
    const { mobile } = req.body

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" })
    }

    const staff = await Staff.findOne({ mobile })
    if (!staff) {
      return res.status(404).json({ message: "Staff not found. Please register first." })
    }

    const otp = generateOtp()
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    staff.otp = otp
    staff.otpExpires = otpExpires
    await staff.save()

    // Simulate SMS by returning OTP (replace with SMS service in production)
    res.status(200).json({ message: "OTP sent to your mobile number", otp })
  } catch (error) {
    res.status(500).json({ message: "Error sending OTP", error: error.message })
  }
}

// Verify OTP for staff registration or login
exports.verifyOtpForStaff = async (req, res) => {
  try {
    const { mobile, otp, isRegistration } = req.body

    const staff = await Staff.findOne({ mobile })
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" })
    }

    if (staff.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" })
    }

    if (staff.otpExpires < Date.now()) {
      return res.status(400).json({ message: "OTP has expired" })
    }

    // Clear OTP fields after successful verification
    staff.otp = null
    staff.otpExpires = null
    await staff.save()

    const response = {
      message: isRegistration ? "Staff registration successful" : "Staff login successful",
      staff: {
        _id: staff._id,
        name: staff.name,
        mobile: staff.mobile,
      },
    }

    res.status(200).json(response)
  } catch (error) {
    res.status(500).json({ message: "Error verifying OTP", error: error.message })
  }
}

// Resend OTP for staff registration
exports.resendOtpForStaffRegistration = async (req, res) => {
  try {
    const { mobile } = req.body

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" })
    }

    const staff = await Staff.findOne({ mobile })
    if (!staff) {
      return res.status(404).json({ message: "Staff not found. Please register first." })
    }

    const otp = generateOtp()
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    staff.otp = otp
    staff.otpExpires = otpExpires
    await staff.save()

    // Simulate SMS by returning OTP (replace with SMS service in production)
    res.status(200).json({ message: "OTP resent to your mobile number", otp })
  } catch (error) {
    res.status(500).json({ message: "Error resending OTP", error: error.message })
  }
}

// Resend OTP for staff login
exports.resendOtpForStaffLogin = async (req, res) => {
  try {
    const { mobile } = req.body

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" })
    }

    const staff = await Staff.findOne({ mobile })
    if (!staff) {
      return res.status(404).json({ message: "Staff not found. Please register first." })
    }

    const otp = generateOtp()
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    staff.otp = otp
    staff.otpExpires = otpExpires
    await staff.save()

    // Simulate SMS by returning OTP (replace with SMS service in production)
    res.status(200).json({ message: "OTP resent to your mobile number", otp })
  } catch (error) {
    res.status(500).json({ message: "Error resending OTP", error: error.message })
  }
}