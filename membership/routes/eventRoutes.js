const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  removeEventImage,
  bookEvent,
  getMyBookings,
  cancelBooking,
  addSeatsToBooking,
  getEventBookings,
  getAllBookings,
  updateBookingStatus,
} = require("../controllers/eventController");

// Import auth middleware
const { protectMember } = require("../middleware/memberAuth");
// Note: Admin protect needs to be added if available

// Multer setup for multiple image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Public routes
router.get("/all", getAllEvents);
router.get("/:id", getEventById);

// Member booking routes
router.post("/:id/book", protectMember, bookEvent);
router.get("/my-bookings", protectMember, getMyBookings);
router.put("/bookings/:id/cancel", protectMember, cancelBooking);
router.put("/bookings/:id/add-seats", protectMember, addSeatsToBooking);

// Admin routes (add admin auth when available)
router.post("/create", upload.array("images", 5), createEvent);
router.put("/:id", upload.array("images", 5), updateEvent);
router.delete("/:id", deleteEvent);
router.delete("/:id/image", removeEventImage);

// Admin booking management routes (add admin auth when available)
router.get("/:id/bookings", getEventBookings);
router.get("/bookings/all", getAllBookings);
router.put("/bookings/:id/status", updateBookingStatus);

module.exports = router;
