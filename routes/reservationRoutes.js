const express = require("express")
const router = express.Router()
const {
  createReservation,
  getReservations,
  getReservationById,
  updateReservation,
  deleteReservation,
  cancelReservation,
} = require("../controller/reservationController")

// Routes
router.route("/").post(createReservation).get(getReservations)

router.route("/:id").get(getReservationById).put(updateReservation).delete(deleteReservation)

router.route("/:id/cancel").put(cancelReservation)

module.exports = router