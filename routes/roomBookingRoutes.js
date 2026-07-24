const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const {
  createBooking,
  createWalkInBooking,
  uploadDocuments,
  getBookings,
  getBookingById,
  getRoomActiveBooking,
  getRoomBookedTimeSlots,
  updateBookingStatus,
  updatePayment,
  cancelBooking,
  requestCancellation,
  approveCancellation,
  getCancellationRequests,
  getPaymentSummary,
  addRestaurantBill,
  removeRestaurantBill,
  extendBooking,
  cancelExtension,
  createRoomBooking,
  getRoomBookings,
  getRoomBookingById,
  updateRoomBooking,
  deleteRoomBooking,
  getBookingStats,
} = require("../controller/roomBookingController");

// Main booking routes
router.route("/")
  .post(createBooking)
  .get(getBookings);

// Walk-in booking
router.route("/walk-in")
  .post(createWalkInBooking);

// Upload documents (Aadhaar, Visa)
router.post("/upload-documents", upload.fields([
  { name: 'aadhaarPic', maxCount: 1 },
  { name: 'visaPic', maxCount: 1 }
]), uploadDocuments);

// Room booking (alternative endpoint)
router.route("/room")
  .post(createRoomBooking)
  .get(getRoomBookings);

// Payment and stats
router.route("/payment-summary")
  .get(getPaymentSummary);

router.route("/stats")
  .get(getBookingStats);

// Cancellation management
router.route("/cancellation-requests")
  .get(getCancellationRequests);

// Room-specific routes
router.route("/room/:roomId/active")
  .get(getRoomActiveBooking);

router.route("/slots/:roomId")
  .get(getRoomBookedTimeSlots);

// Individual booking routes
router.route("/:id")
  .get(getBookingById)
  .put(updateRoomBooking)
  .delete(deleteRoomBooking);

// Room booking specific route
router.route("/room/:id")
  .get(getRoomBookingById)
  .put(updateRoomBooking)
  .delete(deleteRoomBooking);

// Booking status and payment
router.route("/:id/status")
  .put(updateBookingStatus);

router.route("/:id/payment")
  .put(updatePayment);

// Booking extensions
router.route("/:id/extend")
  .put(extendBooking);

router.route("/:id/cancel-extension")
  .put(cancelExtension);

// Restaurant bills
router.route("/:id/restaurant-bill")
  .post(addRestaurantBill);

router.route("/:id/restaurant-bill/:billId")
  .delete(removeRestaurantBill);

// Cancellation routes
router.route("/:id/cancel")
  .put(cancelBooking);

router.route("/:id/request-cancel")
  .put(requestCancellation);

router.route("/:id/approve-cancel")
  .put(approveCancellation);

module.exports = router;