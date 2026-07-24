// const express = require("express");
// const router = express.Router();
// const storeLocationController = require("../controller/storeLocationController");

// router.post("/", storeLocationController.createStoreLocation);

// router.get("/", storeLocationController.getAllStoreLocations);

// router.get("/:id", storeLocationController.getStoreLocationById);

// router.put("/:id", storeLocationController.updateStoreLocation);


// router.delete("/:id", storeLocationController.deleteStoreLocation);

// module.exports = router;



const express = require("express")
const router = express.Router()
const storeLocationController = require("../controller/storeLocationController")

// Get all store locations
router.get("/", storeLocationController.getAllStoreLocations)

// Get store location by ID
router.get("/:id", storeLocationController.getStoreLocationById)

// Create new store location
router.post("/", storeLocationController.createStoreLocation)

// Update store location
router.put("/:id", storeLocationController.updateStoreLocation)

// Delete store location
router.delete("/:id", storeLocationController.deleteStoreLocation)

module.exports = router