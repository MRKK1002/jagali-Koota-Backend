const asyncHandler = require("express-async-handler");
const RoomBooking = require("../model/RoomBooking");

// Get room booked time slots for mobile app (excludes checkout dates)
const getMobileRoomBookedTimeSlots = asyncHandler(async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date parameter is required"
      });
    }

    // Parse the date and create start/end of day
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find all bookings for this room where the target date is between check-in and check-out
    // Exclude checkout date (room is available on checkout day for new bookings)
    const bookings = await RoomBooking.find({
      roomId,
      status: { $nin: ['cancelled', 'checked-out'] },
      checkInDate: { $lte: endOfDay },
      checkOutDate: { $gt: endOfDay } // Room is occupied only if checkout is AFTER this day
    });

    const timeSlots = bookings.map(booking => ({
      checkIn: booking.checkInDate,
      checkOut: booking.checkOutDate,
      checkInTime: booking.checkInTime,
      checkOutTime: booking.checkOutTime,
      guestName: booking.guestName
    }));

    res.status(200).json({
      success: true,
      roomId,
      date,
      timeSlots
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = {
  getMobileRoomBookedTimeSlots
};