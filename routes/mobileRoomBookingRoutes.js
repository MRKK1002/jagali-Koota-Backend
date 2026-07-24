const express = require("express");
const router = express.Router();
const {
  getMobileRoomBookedTimeSlots
} = require("../controller/mobileRoomBookingController");

// Mobile app specific route - excludes checkout dates from booked slots
router.route("/slots/:roomId")
  .get(getMobileRoomBookedTimeSlots);

module.exports = router;