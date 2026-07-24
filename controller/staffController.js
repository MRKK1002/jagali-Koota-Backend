// const Staff = require("../model/staffModel")

// // Get all staff
// exports.getAllStaff = async (req, res) => {
//   try {
//     const { search, role, shift, isActive } = req.query
//     const query = {}

//     // Build search query
//     if (search) {
//       query.$or = [
//         { name: { $regex: search, $options: "i" } },
//         { employeeId: { $regex: search, $options: "i" } },
//         { mobile: { $regex: search, $options: "i" } },
//       ]
//     }

//     if (role) query.role = role
//     if (shift) query.shift = shift
//     if (isActive !== undefined) query.isActive = isActive === "true"

//     const staff = await Staff.find(query).sort({ createdAt: -1 })

//     res.status(200).json({
//       success: true,
//       count: staff.length,
//       data: staff,
//     })
//   } catch (error) {
//     console.error("Error in getAllStaff:", error)
//     res.status(500).json({
//       success: false,
//       message: "Error fetching staff",
//       error: error.message,
//     })
//   }
// }

// // Get staff by ID
// exports.getStaffById = async (req, res) => {
//   try {
//     const staff = await Staff.findById(req.params.id)

//     if (!staff) {
//       return res.status(404).json({
//         success: false,
//         message: "Staff not found",
//       })
//     }

//     res.status(200).json({
//       success: true,
//       data: staff,
//     })
//   } catch (error) {
//     console.error("Error in getStaffById:", error)
//     res.status(500).json({
//       success: false,
//       message: "Error fetching staff",
//       error: error.message,
//     })
//   }
// }

// // Create new staff
// exports.createStaff = async (req, res) => {
//   try {
//     console.log("Received staff data:", req.body)

//     const { name, role, salary, shift, joiningDate, mobile } = req.body

//     // Validate required fields
//     if (!name || !role || !salary || !shift || !joiningDate || !mobile) {
//       return res.status(400).json({
//         success: false,
//         message: "All fields are required: name, role, salary, shift, joiningDate, mobile",
//         received: req.body,
//       })
//     }

//     // Validate mobile number format
//     if (!/^\d{10}$/.test(mobile)) {
//       return res.status(400).json({
//         success: false,
//         message: "Mobile number must be exactly 10 digits",
//       })
//     }

//     // Validate salary is a positive number
//     if (isNaN(salary) || Number(salary) <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Salary must be a positive number",
//       })
//     }

//     // Validate role
//     const validRoles = ["Chef", "Waiter", "Cashier", "Manager", "Cleaner"]
//     if (!validRoles.includes(role)) {
//       return res.status(400).json({
//         success: false,
//         message: `Role must be one of: ${validRoles.join(", ")}`,
//       })
//     }

//     // Validate shift
//     const validShifts = ["Morning", "Evening", "Night"]
//     if (!validShifts.includes(shift)) {
//       return res.status(400).json({
//         success: false,
//         message: `Shift must be one of: ${validShifts.join(", ")}`,
//       })
//     }

//     // Validate joining date
//     const joiningDateObj = new Date(joiningDate)
//     if (isNaN(joiningDateObj.getTime())) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid joining date format",
//       })
//     }

//     // Check if mobile already exists
//     const existingStaff = await Staff.findOne({ mobile })
//     if (existingStaff) {
//       return res.status(400).json({
//         success: false,
//         message: "Mobile number already exists",
//       })
//     }

//     const staff = new Staff({
//       name: name.trim(),
//       role,
//       salary: Number(salary),
//       shift,
//       joiningDate: joiningDateObj,
//       mobile: mobile.trim(),
//     })

//     const savedStaff = await staff.save()
//     console.log("Staff created successfully:", savedStaff)

//     res.status(201).json({
//       success: true,
//       message: "Staff created successfully",
//       data: savedStaff,
//     })
//   } catch (error) {
//     console.error("Error creating staff:", error)

//     // Handle mongoose validation errors
//     if (error.name === "ValidationError") {
//       const validationErrors = Object.values(error.errors).map((err) => err.message)
//       return res.status(400).json({
//         success: false,
//         message: "Validation error",
//         errors: validationErrors,
//       })
//     }

//     // Handle duplicate key error
//     if (error.code === 11000) {
//       const field = Object.keys(error.keyPattern)[0]
//       return res.status(400).json({
//         success: false,
//         message: `${field} already exists`,
//       })
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error creating staff",
//       error: error.message,
//     })
//   }
// }

// // Update staff
// exports.updateStaff = async (req, res) => {
//   try {
//     const { name, role, salary, shift, joiningDate, mobile } = req.body

//     // Validate required fields
//     if (!name || !role || !salary || !shift || !joiningDate || !mobile) {
//       return res.status(400).json({
//         success: false,
//         message: "All fields are required",
//       })
//     }

//     // Validate mobile number format
//     if (!/^\d{10}$/.test(mobile)) {
//       return res.status(400).json({
//         success: false,
//         message: "Mobile number must be exactly 10 digits",
//       })
//     }

//     // Check if mobile already exists for other staff
//     const existingStaff = await Staff.findOne({
//       mobile,
//       _id: { $ne: req.params.id },
//     })

//     if (existingStaff) {
//       return res.status(400).json({
//         success: false,
//         message: "Mobile number already exists",
//       })
//     }

//     const staff = await Staff.findByIdAndUpdate(
//       req.params.id,
//       {
//         name: name.trim(),
//         role,
//         salary: Number(salary),
//         shift,
//         joiningDate: new Date(joiningDate),
//         mobile: mobile.trim(),
//       },
//       { new: true, runValidators: true },
//     )

//     if (!staff) {
//       return res.status(404).json({
//         success: false,
//         message: "Staff not found",
//       })
//     }

//     res.status(200).json({
//       success: true,
//       message: "Staff updated successfully",
//       data: staff,
//     })
//   } catch (error) {
//     console.error("Error updating staff:", error)

//     if (error.name === "ValidationError") {
//       const validationErrors = Object.values(error.errors).map((err) => err.message)
//       return res.status(400).json({
//         success: false,
//         message: "Validation error",
//         errors: validationErrors,
//       })
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error updating staff",
//       error: error.message,
//     })
//   }
// }

// // Delete staff
// exports.deleteStaff = async (req, res) => {
//   try {
//     const staff = await Staff.findByIdAndDelete(req.params.id)

//     if (!staff) {
//       return res.status(404).json({
//         success: false,
//         message: "Staff not found",
//       })
//     }

//     res.status(200).json({
//       success: true,
//       message: "Staff deleted successfully",
//     })
//   } catch (error) {
//     console.error("Error deleting staff:", error)
//     res.status(500).json({
//       success: false,
//       message: "Error deleting staff",
//       error: error.message,
//     })
//   }
// }

// // Toggle staff active status
// exports.toggleStaffStatus = async (req, res) => {
//   try {
//     const staff = await Staff.findById(req.params.id)

//     if (!staff) {
//       return res.status(404).json({
//         success: false,
//         message: "Staff not found",
//       })
//     }

//     staff.isActive = !staff.isActive
//     await staff.save()

//     res.status(200).json({
//       success: true,
//       message: `Staff ${staff.isActive ? "activated" : "deactivated"} successfully`,
//       data: staff,
//     })
//   } catch (error) {
//     console.error("Error updating staff status:", error)
//     res.status(500).json({
//       success: false,
//       message: "Error updating staff status",
//       error: error.message,
//     })
//   }
// }





const Staff = require("../model/staffModel")

// Get all staff
exports.getAllStaff = async (req, res) => {
  try {
    const { search, role, shift, isActive } = req.query
    const query = {}

    // Build search query
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ]
    }

    if (role) query.role = role
    if (shift) query.shift = shift
    if (isActive !== undefined) query.isActive = isActive === "true"

    const staff = await Staff.find(query).sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      count: staff.length,
      data: staff,
    })
  } catch (error) {
    console.error("Error in getAllStaff:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching staff",
      error: error.message,
    })
  }
}

// Get staff by ID
exports.getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id)

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      })
    }

    res.status(200).json({
      success: true,
      data: staff,
    })
  } catch (error) {
    console.error("Error in getStaffById:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching staff",
      error: error.message,
    })
  }
}

// Create new staff
exports.createStaff = async (req, res) => {
  try {

    const { name, role, salary, shift, joiningDate, mobile } = req.body

    // Validate required fields
    if (!name || !role || !salary || !shift || !joiningDate || !mobile) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: name, role, salary, shift, joiningDate, mobile",
        received: req.body,
      })
    }

    // Validate mobile number format
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Mobile number must be exactly 10 digits",
      })
    }

    // Validate salary is a positive number
    if (isNaN(salary) || Number(salary) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Salary must be a positive number",
      })
    }

    // Validate role
    const validRoles = ["Chef", "Waiter", "Cashier", "Manager", "Cleaner"]
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${validRoles.join(", ")}`,
      })
    }

    // Validate shift
    const validShifts = ["Morning", "Evening", "Night"]
    if (!validShifts.includes(shift)) {
      return res.status(400).json({
        success: false,
        message: `Shift must be one of: ${validShifts.join(", ")}`,
      })
    }

    // Validate joining date
    const joiningDateObj = new Date(joiningDate)
    if (isNaN(joiningDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid joining date format",
      })
    }

    // Check if mobile already exists
    const existingStaff = await Staff.findOne({ mobile })
    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already exists",
      })
    }

    // Create staff object without employeeId (it will be auto-generated)
    const staff = new Staff({
      name: name.trim(),
      role,
      salary: Number(salary),
      shift,
      joiningDate: joiningDateObj,
      mobile: mobile.trim(),
    })


    // Save the staff (employeeId will be auto-generated in pre-save hook)
    const savedStaff = await staff.save()

    res.status(201).json({
      success: true,
      message: "Staff created successfully",
      data: savedStaff,
    })
  } catch (error) {
    console.error("Error creating staff:", error)

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => err.message)
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationErrors,
      })
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field"
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
      })
    }

    res.status(500).json({
      success: false,
      message: "Error creating staff",
      error: error.message,
    })
  }
}

// Update staff
exports.updateStaff = async (req, res) => {
  try {
    const { name, role, salary, shift, joiningDate, mobile } = req.body

    // Validate required fields
    if (!name || !role || !salary || !shift || !joiningDate || !mobile) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      })
    }

    // Validate mobile number format
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Mobile number must be exactly 10 digits",
      })
    }

    // Check if mobile already exists for other staff
    const existingStaff = await Staff.findOne({
      mobile,
      _id: { $ne: req.params.id },
    })

    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already exists",
      })
    }

    const staff = await Staff.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        role,
        salary: Number(salary),
        shift,
        joiningDate: new Date(joiningDate),
        mobile: mobile.trim(),
      },
      { new: true, runValidators: true },
    )

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Staff updated successfully",
      data: staff,
    })
  } catch (error) {
    console.error("Error updating staff:", error)

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => err.message)
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationErrors,
      })
    }

    res.status(500).json({
      success: false,
      message: "Error updating staff",
      error: error.message,
    })
  }
}

// Delete staff
exports.deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findByIdAndDelete(req.params.id)

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Staff deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting staff:", error)
    res.status(500).json({
      success: false,
      message: "Error deleting staff",
      error: error.message,
    })
  }
}

// Toggle staff active status
exports.toggleStaffStatus = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id)

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      })
    }

    staff.isActive = !staff.isActive
    await staff.save()

    res.status(200).json({
      success: true,
      message: `Staff ${staff.isActive ? "activated" : "deactivated"} successfully`,
      data: staff,
    })
  } catch (error) {
    console.error("Error updating staff status:", error)
    res.status(500).json({
      success: false,
      message: "Error updating staff status",
      error: error.message,
    })
  }
}