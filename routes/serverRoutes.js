const express = require("express")
const router = express.Router()
const Server = require("../model/serverModel")

// Get all servers (optionally filter by branch)
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query
    const filter = { isActive: true }
    if (branchId) filter.branch = branchId

    const servers = await Server.find(filter).sort({ name: 1 })
    res.status(200).json({ success: true, servers })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get all servers (including inactive) for admin
router.get("/all", async (req, res) => {
  try {
    const { branchId } = req.query
    const filter = {}
    if (branchId) filter.branch = branchId

    const servers = await Server.find(filter).populate("branch", "name").sort({ name: 1 })
    res.status(200).json({ success: true, servers })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Add a new server/waiter
router.post("/", async (req, res) => {
  try {
    const { name, branchId } = req.body

    if (!name || !branchId) {
      return res.status(400).json({ success: false, message: "Name and branch are required" })
    }

    // Check if name already exists for this branch
    const existing = await Server.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }, 
      branch: branchId 
    })
    if (existing) {
      return res.status(400).json({ success: false, message: "Server/Waiter with this name already exists in this branch" })
    }

    const server = new Server({ name: name.trim(), branch: branchId })
    await server.save()

    res.status(201).json({ success: true, message: "Server/Waiter added successfully", server })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Update a server/waiter
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { name, isActive } = req.body

    const server = await Server.findById(id)
    if (!server) {
      return res.status(404).json({ success: false, message: "Server/Waiter not found" })
    }

    if (name !== undefined) server.name = name.trim()
    if (isActive !== undefined) server.isActive = isActive

    await server.save()
    res.status(200).json({ success: true, message: "Server/Waiter updated successfully", server })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Delete a server/waiter
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const server = await Server.findByIdAndDelete(id)
    if (!server) {
      return res.status(404).json({ success: false, message: "Server/Waiter not found" })
    }
    res.status(200).json({ success: true, message: "Server/Waiter deleted successfully" })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

module.exports = router
