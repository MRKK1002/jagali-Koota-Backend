const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ["Financial", "Attendance", "HR", "System"],
  },
  period: { type: String, required: true },
  generatedBy: { type: String, required: true },
  status: {
    type: String,
    required: true,
    enum: ["Complete", "Pending", "Failed"],
    default: "Pending",
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Report", reportSchema);