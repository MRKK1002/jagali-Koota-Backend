// const mongoose = require("mongoose")

// const staffSchema = new mongoose.Schema(
//   {
//     employeeId: {
//       type: String,
//       required: [false, "Employee ID is required"],
//       unique: true,
//       trim: true,
//     },
//     name: {
//       type: String,
//       required: [true, "Name is required"],
//       trim: true,
//     },
//     role: {
//       type: String,
//       required: [true, "Role is required"],
//       enum: ["Chef", "Waiter", "Cashier", "Manager", "Cleaner"],
//     },
//     salary: {
//       type: Number,
//       required: [true, "Salary is required"],
//       min: [0, "Salary must be positive"],
//     },
//     shift: {
//       type: String,
//       required: [true, "Shift is required"],
//       enum: ["Morning", "Evening", "Night"],
//     },
//     joiningDate: {
//       type: Date,
//       required: [true, "Joining date is required"],
//     },
//     mobile: {
//       type: String,
//       required: [true, "Mobile number is required"],
//       unique: true,
//       match: [/^\d{10}$/, "Please enter a valid 10-digit mobile number"],
//     },
//     isActive: {
//       type: Boolean,
//       default: true,
//     },
//   },
//   {
//     timestamps: true,
//   },
// )

// // Generate employee ID before saving
// staffSchema.pre("save", async function (next) {
//   if (!this.employeeId) {
//     const count = await mongoose.model("Staff").countDocuments()
//     this.employeeId = `EMP${String(count + 1).padStart(3, "0")}`
//   }
//   next()
// })

// module.exports = mongoose.model("Staff", staffSchema)



const mongoose = require("mongoose")

const staffSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      enum: ["Chef", "Waiter", "Cashier", "Manager", "Cleaner"],
    },
    salary: {
      type: Number,
      required: [true, "Salary is required"],
      min: [0, "Salary must be positive"],
    },
    shift: {
      type: String,
      required: [true, "Shift is required"],
      enum: ["Morning", "Evening", "Night"],
    },
    joiningDate: {
      type: Date,
      required: [true, "Joining date is required"],
    },
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      match: [/^\d{10}$/, "Please enter a valid 10-digit mobile number"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

// Generate employee ID before saving
staffSchema.pre("save", async function (next) {
  try {
    if (!this.employeeId) {
      // Get the count of existing staff members
      const count = await this.constructor.countDocuments()
      // Generate employee ID with format EMP001, EMP002, etc.
      this.employeeId = `EMP${String(count + 1).padStart(3, "0")}`
    }
    next()
  } catch (error) {
    console.error("Error generating employee ID:", error)
    next(error)
  }
})

// Create index for employeeId
staffSchema.index({ employeeId: 1 }, { unique: true })

module.exports = mongoose.model("Staff", staffSchema)