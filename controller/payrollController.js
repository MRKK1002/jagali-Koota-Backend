const Payroll = require("../model/payrollModel")
const Staff = require("../model/staffModel")
const Attendance = require("../model/attendanceModel")
const mongoose = require("mongoose")

// Helper function to check if a string is a valid ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id)
}

// Helper function to get month number from month name
const getMonthNumber = (monthName) => {
  const months = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4,
    'May': 5, 'June': 6, 'July': 7, 'August': 8,
    'September': 9, 'October': 10, 'November': 11, 'December': 12
  }
  return months[monthName] || parseInt(monthName)
}

// Helper function to calculate net salary
const calculateNetSalary = (baseSalary, presentDays, overtime = 0, bonus = 0, deductions = 0, totalWorkingDays = 26) => {
  try {
    // Calculate daily rate
    const dailyRate = baseSalary / totalWorkingDays

    // Calculate salary based on present days
    const earnedSalary = dailyRate * presentDays

    // Calculate overtime pay (hourly rate * 1.5 * overtime hours)
    const hourlyRate = baseSalary / (totalWorkingDays * 8)
    const overtimePay = hourlyRate * 1.5 * overtime

    // Calculate net salary
    const netSalary = Math.round(earnedSalary + overtimePay + bonus - deductions)


    return netSalary
  } catch (error) {
    console.error("Error calculating net salary:", error)
    return 0
  }
}

// Get all payroll records with improved filtering
exports.getAllPayroll = async (req, res) => {
  try {
    
    const { month, year, employeeId, isPaid } = req.query
    const query = {}

    // Improved month filtering - handle both month names and numbers
    if (month) {
      // If month is a name like "May", store it as is
      // If month is a number like "5", convert it to name
      if (isNaN(month)) {
        query.month = month
      } else {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December']
        query.month = monthNames[parseInt(month) - 1]
      }
    }
    
    if (year) query.year = parseInt(year)
    if (employeeId) query.employeeId = employeeId
    if (isPaid !== undefined) query.isPaid = isPaid === "true"


    const payroll = await Payroll.find(query).sort({ createdAt: -1 })

    // Populate employee details with better error handling
    const payrollWithStaff = await Promise.all(
      payroll.map(async (record) => {
        try {
          let staff = null

          // First try to find by employeeId (string)
          staff = await Staff.findOne({ employeeId: record.employeeId })

          // If not found and the record.employeeId looks like an ObjectId, try _id
          if (!staff && isValidObjectId(record.employeeId)) {
            staff = await Staff.findById(record.employeeId)
          }

          return {
            ...record.toObject(),
            employeeName: staff ? staff.name : "Unknown",
            employeeRole: staff ? staff.role : "Unknown",
          }
        } catch (error) {
          console.error("Error populating staff for payroll record:", record._id, error.message)
          return {
            ...record.toObject(),
            employeeName: "Unknown",
            employeeRole: "Unknown",
          }
        }
      }),
    )

    res.status(200).json({
      success: true,
      count: payroll.length,
      data: payrollWithStaff,
    })
  } catch (error) {
    console.error("Error fetching payroll records:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching payroll records",
      error: error.message,
    })
  }
}

// Get payroll by ID
exports.getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found",
      })
    }

    res.status(200).json({
      success: true,
      data: payroll,
    })
  } catch (error) {
    console.error("Error fetching payroll record:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching payroll record",
      error: error.message,
    })
  }
}

// Create payroll record
exports.createPayroll = async (req, res) => {
  try {
    const { employeeId, month, year, presentDays, overtime, deductions, bonus } = req.body


    // Validate required fields
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      })
    }

    if (!month) {
      return res.status(400).json({
        success: false,
        message: "Month is required",
      })
    }

    if (!presentDays || isNaN(presentDays)) {
      return res.status(400).json({
        success: false,
        message: "Valid present days is required",
      })
    }

    // Find staff with better logic
    let staff = null

    // First try to find by _id if it's a valid ObjectId
    if (isValidObjectId(employeeId)) {
      staff = await Staff.findById(employeeId)
    }

    // If not found, try to find by employeeId field
    if (!staff) {
      staff = await Staff.findOne({ employeeId: employeeId })
    }

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      })
    }


    // Use the staff's employeeId for consistency
    const staffEmployeeId = staff.employeeId

    // Check if payroll already exists for this month
    const existingPayroll = await Payroll.findOne({
      employeeId: staffEmployeeId,
      month,
      year: parseInt(year),
    })

    if (existingPayroll) {
      return res.status(400).json({
        success: false,
        message: "Payroll already processed for this month",
      })
    }

    // Ensure all numeric values are properly converted
    const presentDaysNum = parseFloat(presentDays)
    const overtimeNum = parseFloat(overtime) || 0
    const deductionsNum = parseFloat(deductions) || 0
    const bonusNum = parseFloat(bonus) || 0
    const baseSalaryNum = parseFloat(staff.salary)

    // Validate salary
    if (!baseSalaryNum || baseSalaryNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Staff member must have a valid salary",
      })
    }

    // Calculate net salary manually
    const netSalary = calculateNetSalary(baseSalaryNum, presentDaysNum, overtimeNum, bonusNum, deductionsNum)


    // Create payroll record with manually calculated netSalary
    const payroll = new Payroll({
      employeeId: staffEmployeeId,
      month,
      year: parseInt(year),
      baseSalary: baseSalaryNum,
      presentDays: presentDaysNum,
      overtime: overtimeNum,
      deductions: deductionsNum,
      bonus: bonusNum,
      netSalary: netSalary, // Manually set the netSalary
    })

    const savedPayroll = await payroll.save()

    // Return the saved payroll with staff details
    const payrollWithStaff = {
      ...savedPayroll.toObject(),
      employeeName: staff.name,
      employeeRole: staff.role,
    }

    res.status(201).json({
      success: true,
      message: "Payroll processed successfully",
      data: payrollWithStaff,
    })
  } catch (error) {
    console.error("Error processing payroll:", error)

    // Handle validation errors
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
      return res.status(400).json({
        success: false,
        message: "Payroll already exists for this employee in this month",
      })
    }

    res.status(400).json({
      success: false,
      message: "Error processing payroll",
      error: error.message,
    })
  }
}

// Update payroll record
exports.updatePayroll = async (req, res) => {
  try {
    const { employeeId, month, year, presentDays, overtime, deductions, bonus } = req.body

    // Find staff with better logic
    let staff = null

    if (isValidObjectId(employeeId)) {
      staff = await Staff.findById(employeeId)
    }

    if (!staff) {
      staff = await Staff.findOne({ employeeId: employeeId })
    }

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      })
    }

    // Calculate new net salary
    const baseSalaryNum = parseFloat(staff.salary)
    const presentDaysNum = parseFloat(presentDays)
    const overtimeNum = parseFloat(overtime) || 0
    const deductionsNum = parseFloat(deductions) || 0
    const bonusNum = parseFloat(bonus) || 0

    const netSalary = calculateNetSalary(baseSalaryNum, presentDaysNum, overtimeNum, bonusNum, deductionsNum)

    const payroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      {
        employeeId: staff.employeeId,
        month,
        year: parseInt(year),
        baseSalary: baseSalaryNum,
        presentDays: presentDaysNum,
        overtime: overtimeNum,
        deductions: deductionsNum,
        bonus: bonusNum,
        netSalary: netSalary,
      },
      { new: true, runValidators: true },
    )

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Payroll updated successfully",
      data: payroll,
    })
  } catch (error) {
    console.error("Error updating payroll:", error)
    res.status(400).json({
      success: false,
      message: "Error updating payroll",
      error: error.message,
    })
  }
}

// Delete payroll record
exports.deletePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndDelete(req.params.id)

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Payroll record deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting payroll record:", error)
    res.status(500).json({
      success: false,
      message: "Error deleting payroll record",
      error: error.message,
    })
  }
}

// Mark payroll as paid
exports.markAsPaid = async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      {
        isPaid: true,
        paidDate: new Date(),
      },
      { new: true },
    )

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Payroll marked as paid successfully",
      data: payroll,
    })
  } catch (error) {
    console.error("Error updating payroll status:", error)
    res.status(500).json({
      success: false,
      message: "Error updating payroll status",
      error: error.message,
    })
  }
}

// Auto-generate payroll from attendance
exports.generatePayrollFromAttendance = async (req, res) => {
  try {
    const { employeeId, month, year } = req.body

    // Find staff with better logic
    let staff = null

    if (isValidObjectId(employeeId)) {
      staff = await Staff.findById(employeeId)
    }

    if (!staff) {
      staff = await Staff.findOne({ employeeId: employeeId })
    }

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      })
    }

    // Check if payroll already exists
    const existingPayroll = await Payroll.findOne({
      employeeId: staff.employeeId,
      month,
      year: parseInt(year),
    })

    if (existingPayroll) {
      return res.status(400).json({
        success: false,
        message: "Payroll already processed for this month",
      })
    }

    // Get attendance data for the month
    const monthNum = getMonthNumber(month)
    const startDate = new Date(year, monthNum - 1, 1)
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999)

    const attendance = await Attendance.find({
      employeeId: staff.employeeId,
      date: { $gte: startDate, $lte: endDate },
    })

    // Calculate present days and overtime
    const presentDays = attendance.filter((a) => a.status === "Present" || a.status === "Half Day").length
    const totalOvertime = attendance.reduce((sum, a) => sum + (a.overtime || 0), 0)

    // Calculate net salary
    const baseSalaryNum = parseFloat(staff.salary)
    const netSalary = calculateNetSalary(baseSalaryNum, presentDays, totalOvertime, 0, 0)

    // Create payroll record
    const payroll = new Payroll({
      employeeId: staff.employeeId,
      month,
      year: parseInt(year),
      baseSalary: baseSalaryNum,
      presentDays,
      overtime: totalOvertime,
      deductions: 0,
      bonus: 0,
      netSalary: netSalary,
    })

    const savedPayroll = await payroll.save()

    res.status(201).json({
      success: true,
      message: "Payroll generated from attendance successfully",
      data: savedPayroll,
    })
  } catch (error) {
    console.error("Error generating payroll from attendance:", error)
    res.status(400).json({
      success: false,
      message: "Error generating payroll from attendance",
      error: error.message,
    })
  }
}