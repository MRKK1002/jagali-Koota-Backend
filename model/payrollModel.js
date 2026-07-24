const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      ref: "Staff",
    },
    month: {
      type: String,
      required: [true, "Month is required"],
    },
    year: {
      type: Number,
      required: [true, "Year is required"],
    },
    baseSalary: {
      type: Number,
      required: [true, "Base salary is required"],
    },
    presentDays: {
      type: Number,
      required: [true, "Present days is required"],
      min: [0, "Present days cannot be negative"],
      max: [31, "Present days cannot exceed 31"],
    },
    totalWorkingDays: {
      type: Number,
      default: 26,
    },
    overtime: {
      type: Number,
      default: 0,
      min: [0, "Overtime cannot be negative"],
    },
    overtimeRate: {
      type: Number,
      default: 1.5, // 1.5x of hourly rate
    },
    deductions: {
      type: Number,
      default: 0,
      min: [0, "Deductions cannot be negative"],
    },
    bonus: {
      type: Number,
      default: 0,
      min: [0, "Bonus cannot be negative"],
    },
    netSalary: {
      type: Number,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate net salary before saving
payrollSchema.pre("save", function (next) {
  try {

    // Ensure all required fields are present
    if (!this.baseSalary || this.baseSalary <= 0) {
      return next(
        new Error("Base salary is required and must be greater than 0")
      );
    }

    if (this.presentDays === undefined || this.presentDays < 0) {
      return next(new Error("Present days is required and cannot be negative"));
    }

    // Calculate daily rate
    const dailyRate = this.baseSalary / this.totalWorkingDays;

    // Calculate salary based on present days
    const earnedSalary = dailyRate * this.presentDays;

    // Calculate overtime pay (hourly rate * 1.5 * overtime hours)
    const hourlyRate = this.baseSalary / (this.totalWorkingDays * 8);
    const overtimePay = hourlyRate * this.overtimeRate * (this.overtime || 0);

    // Calculate net salary
    this.netSalary = Math.round(
      earnedSalary + overtimePay + (this.bonus || 0) - (this.deductions || 0)
    );


    next();
  } catch (error) {
    console.error("Error in pre-save hook:", error);
    next(error);
  }
});

// Compound index to ensure one payroll record per employee per month
payrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("Payroll", payrollSchema);