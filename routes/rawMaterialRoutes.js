const express = require("express")
const router = express.Router()
const rawMaterialController = require("../controller/rawMaterialController")

// Get all raw materials with optional filtering
router.get("/", rawMaterialController.getAllRawMaterials)

// Get raw material by ID
router.get("/:id", rawMaterialController.getRawMaterialById)

// Create new raw material
router.post("/", rawMaterialController.createRawMaterial)

// Update raw material
router.put("/:id", rawMaterialController.updateRawMaterial)

// Delete raw material
router.delete("/:id", rawMaterialController.deleteRawMaterial)

// Get low stock items
router.get("/alerts/low-stock", rawMaterialController.getLowStockItems)

// Update stock quantity (for stock adjustments)
router.patch("/:id/stock", rawMaterialController.updateStock)

// Get materials by category
router.get("/category/:category", rawMaterialController.getMaterialsByCategory)

module.exports = router