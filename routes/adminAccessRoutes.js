const express = require("express")
const router = express.Router()
const adminAccessController = require("../controller/adminAccessController")

// Login
router.post("/login", adminAccessController.login)

// CRUD
router.get("/", adminAccessController.getUsers)
router.get("/:id", adminAccessController.getUserById)
router.post("/", adminAccessController.createUser)
router.put("/:id", adminAccessController.updateUser)
router.delete("/:id", adminAccessController.deleteUser)

module.exports = router
