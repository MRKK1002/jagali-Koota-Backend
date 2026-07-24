const Room = require("../model/Room");
const Housekeeping = require("../model/Housekeeping");
const asyncHandler = require("express-async-handler");

// Get all housekeeping tasks
const getHousekeepingTasks = asyncHandler(async (req, res) => {
  try {
    const { branchId, status, date } = req.query;
    
    const filter = {};
    if (branchId) filter.branchId = branchId;
    if (status) filter.status = status;
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    const tasks = await Housekeeping.find(filter)
      .populate('roomId', 'roomNumber floor roomType branchId')
      .populate('branchId', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error("Error fetching housekeeping tasks:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch housekeeping tasks"
    });
  }
});

// Get housekeeping schedule (all rooms with their status)
const getHousekeepingSchedule = asyncHandler(async (req, res) => {
  try {
    const { branchId } = req.query;
    
    const filter = {};
    if (branchId) filter.branchId = branchId;

    const rooms = await Room.find(filter)
      .populate('branchId', 'name')
      .sort({ roomNumber: 1 });

    // Group rooms by housekeeping status
    const schedule = {
      clean: [],
      dirty: [],
      inProgress: [],
      inspected: [],
      outOfOrder: []
    };

    rooms.forEach(room => {
      const status = room.housekeepingStatus || 'clean';
      const roomData = {
        _id: room._id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        roomType: room.roomType,
        branchName: room.branchId?.name,
        housekeepingStatus: status,
        lastCleanedAt: room.lastCleanedAt,
        lastCleanedBy: room.lastCleanedBy,
        cleaningNotes: room.cleaningNotes
      };

      switch (status) {
        case 'clean':
          schedule.clean.push(roomData);
          break;
        case 'dirty':
          schedule.dirty.push(roomData);
          break;
        case 'in-progress':
          schedule.inProgress.push(roomData);
          break;
        case 'inspected':
          schedule.inspected.push(roomData);
          break;
        case 'out-of-order':
          schedule.outOfOrder.push(roomData);
          break;
        default:
          schedule.clean.push(roomData);
      }
    });

    res.json({
      success: true,
      schedule,
      summary: {
        total: rooms.length,
        clean: schedule.clean.length,
        dirty: schedule.dirty.length,
        inProgress: schedule.inProgress.length,
        inspected: schedule.inspected.length,
        outOfOrder: schedule.outOfOrder.length
      }
    });
  } catch (error) {
    console.error("Error fetching housekeeping schedule:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch housekeeping schedule"
    });
  }
});

// Update room housekeeping status
const updateRoomHousekeepingStatus = asyncHandler(async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status, cleanedBy, notes } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    const updateData = {
      housekeepingStatus: status
    };

    if (status === 'clean' || status === 'inspected') {
      updateData.lastCleanedAt = new Date();
      if (cleanedBy) updateData.lastCleanedBy = cleanedBy;
    }

    if (notes !== undefined) {
      updateData.cleaningNotes = notes;
    }

    const updatedRoom = await Room.findByIdAndUpdate(
      roomId,
      updateData,
      { new: true }
    ).populate('branchId', 'name');

    // Create housekeeping log
    const housekeepingLog = new Housekeeping({
      roomId: room._id,
      branchId: room.branchId,
      status: status === 'clean' ? 'completed' : status === 'in-progress' ? 'in-progress' : 'pending',
      taskType: 'regular-cleaning',
      assignedTo: cleanedBy || 'Unknown',
      scheduledDate: new Date(),
      notes: notes || '',
      completedAt: status === 'clean' || status === 'inspected' ? new Date() : null
    });

    await housekeepingLog.save();

    res.json({
      success: true,
      message: "Housekeeping status updated successfully",
      room: updatedRoom
    });
  } catch (error) {
    console.error("Error updating housekeeping status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update housekeeping status"
    });
  }
});

// Bulk update housekeeping status
const bulkUpdateHousekeepingStatus = asyncHandler(async (req, res) => {
  try {
    const { roomIds, status, cleanedBy, notes } = req.body;

    if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Room IDs array is required"
      });
    }

    const updateData = {
      housekeepingStatus: status
    };

    if (status === 'clean' || status === 'inspected') {
      updateData.lastCleanedAt = new Date();
      if (cleanedBy) updateData.lastCleanedBy = cleanedBy;
    }

    if (notes !== undefined) {
      updateData.cleaningNotes = notes;
    }

    const result = await Room.updateMany(
      { _id: { $in: roomIds } },
      updateData
    );

    // Create housekeeping logs for all rooms
    const rooms = await Room.find({ _id: { $in: roomIds } });
    const housekeepingLogs = rooms.map(room => ({
      roomId: room._id,
      branchId: room.branchId,
      status: status === 'clean' ? 'completed' : status === 'in-progress' ? 'in-progress' : 'pending',
      taskType: 'regular-cleaning',
      assignedTo: cleanedBy || 'Unknown',
      scheduledDate: new Date(),
      notes: notes || '',
      completedAt: status === 'clean' || status === 'inspected' ? new Date() : null
    }));

    await Housekeeping.insertMany(housekeepingLogs);

    res.json({
      success: true,
      message: `${result.modifiedCount} rooms updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error bulk updating housekeeping status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to bulk update housekeeping status"
    });
  }
});

module.exports = {
  getHousekeepingTasks,
  getHousekeepingSchedule,
  updateRoomHousekeepingStatus,
  bulkUpdateHousekeepingStatus
};