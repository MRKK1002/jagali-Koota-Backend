const express = require("express");
const router = express.Router();
const {
  getHousekeepingTasks,
  getHousekeepingSchedule,
  updateRoomHousekeepingStatus,
  bulkUpdateHousekeepingStatus
} = require("../controller/housekeepingController");

// Get all housekeeping tasks
router.get("/tasks", getHousekeepingTasks);

// Get housekeeping schedule (all rooms grouped by status)
router.get("/schedule", getHousekeepingSchedule);

// Update single room housekeeping status
router.put("/room/:roomId/status", updateRoomHousekeepingStatus);

// Bulk update housekeeping status
router.put("/bulk-update", bulkUpdateHousekeepingStatus);

module.exports = router;