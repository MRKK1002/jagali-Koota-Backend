const express = require("express")
const router = express.Router()
const addressController = require("../controller/addressController")

// Address routes
router.get("/:userId", addressController.getUserAddresses)
router.post("/", addressController.addAddress)
router.put("/:id", addressController.updateAddress)
router.delete("/:id", addressController.deleteAddress)
router.put("/:id/default", addressController.setDefaultAddress)

module.exports = router