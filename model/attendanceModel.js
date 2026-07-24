

const mongoose = require("mongoose")

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      ref: "Staff",
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    inTime: {
      type: String,
      default: null,
    },
    outTime: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: ["Present", "Absent", "Half Day", "Leave"],
      default: "Present",
    },
    totalHours: {
      type: Number,
      default: 0,
    },
    overtime: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

// Calculate total hours before saving
attendanceSchema.pre("save", function (next) {
  if (this.inTime && this.outTime && this.status !== "Absent") {
    try {
      const [inHours, inMinutes] = this.inTime.split(":").map(Number)
      const [outHours, outMinutes] = this.outTime.split(":").map(Number)

      const totalMinutes = outHours * 60 + outMinutes - (inHours * 60 + inMinutes)
      this.totalHours = Math.round((totalMinutes / 60) * 100) / 100

      // Calculate overtime (assuming 8 hours is standard)
      if (this.totalHours > 8) {
        this.overtime = this.totalHours - 8
      }
    } catch (error) {
      console.error("Error calculating hours:", error)
    }
  }
  next()
})

// Compound index to ensure one attendance record per employee per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true })

module.exports = mongoose.model("Attendance", attendanceSchema)