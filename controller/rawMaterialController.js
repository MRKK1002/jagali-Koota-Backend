const RawMaterial = require("../model/rawMaterialModel")

// Get all raw materials with optional filtering and search
exports.getAllRawMaterials = async (req, res) => {
  try {
    const { search, category, status, sortBy = "name", sortOrder = "asc", page = 1, limit = 50 } = req.query

    // Build filter object
    const filter = {}

    if (search) {
      filter.$or = [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }]
    }

    if (category && category !== "all") {
      filter.category = category
    }

    if (status && status !== "all") {
      filter.status = status
    }

    // Build sort object
    const sort = {}
    sort[sortBy] = sortOrder === "desc" ? -1 : 1

    // Calculate pagination
    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    // Execute query
    const materials = await RawMaterial.find(filter).sort(sort).skip(skip).limit(Number.parseInt(limit))

    // Get total count for pagination
    const total = await RawMaterial.countDocuments(filter)

    res.json({
      materials,
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / Number.parseInt(limit)),
        total,
        limit: Number.parseInt(limit),
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Get a single raw material by ID
exports.getRawMaterialById = async (req, res) => {
  try {
    const material = await RawMaterial.findById(req.params.id)
    if (!material) {
      return res.status(404).json({ error: "Raw material not found" })
    }
    res.json(material)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Create a new raw material
exports.createRawMaterial = async (req, res) => {
  try {
    const { name, category, unit, price, quantity, minLevel, supplier, description } = req.body

    // Check if material with same name already exists
    const existingMaterial = await RawMaterial.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    })

    if (existingMaterial) {
      return res.status(400).json({ error: "Material with this name already exists" })
    }

    const material = new RawMaterial({
      name,
      category,
      unit,
      price: Number.parseFloat(price),
      quantity: Number.parseFloat(quantity) || 0,
      minLevel: Number.parseFloat(minLevel) || 5,
      supplier,
      description,
    })

    await material.save()
    res.status(201).json(material)
  } catch (err) {
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message)
      return res.status(400).json({ error: errors.join(", ") })
    }
    res.status(400).json({ error: err.message })
  }
}

// Update a raw material
exports.updateRawMaterial = async (req, res) => {
  try {
    const { name, category, unit, price, quantity, minLevel, supplier, description } = req.body

    // Check if another material with same name exists (excluding current one)
    if (name) {
      const existingMaterial = await RawMaterial.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: req.params.id },
      })

      if (existingMaterial) {
        return res.status(400).json({ error: "Material with this name already exists" })
      }
    }

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (category !== undefined) updateData.category = category
    if (unit !== undefined) updateData.unit = unit
    if (price !== undefined) updateData.price = Number.parseFloat(price)
    if (quantity !== undefined) updateData.quantity = Number.parseFloat(quantity)
    if (minLevel !== undefined) updateData.minLevel = Number.parseFloat(minLevel)
    if (supplier !== undefined) updateData.supplier = supplier
    if (description !== undefined) updateData.description = description

    const material = await RawMaterial.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })

    if (!material) {
      return res.status(404).json({ error: "Raw material not found" })
    }

    res.json(material)
  } catch (err) {
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message)
      return res.status(400).json({ error: errors.join(", ") })
    }
    res.status(400).json({ error: err.message })
  }
}

// Delete a raw material
exports.deleteRawMaterial = async (req, res) => {
  try {
    const material = await RawMaterial.findByIdAndDelete(req.params.id)
    if (!material) {
      return res.status(404).json({ error: "Raw material not found" })
    }
    res.json({ message: "Raw material deleted successfully" })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Get low stock items
exports.getLowStockItems = async (req, res) => {
  try {
    const lowStockMaterials = await RawMaterial.find({
      $expr: { $lte: ["$quantity", "$minLevel"] },
    }).sort({ quantity: 1 })

    res.json(lowStockMaterials)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Update stock quantity (for stock adjustments)
exports.updateStock = async (req, res) => {
  try {
    const { quantity, operation = "set" } = req.body

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ error: "Valid quantity is required" })
    }

    const material = await RawMaterial.findById(req.params.id)
    if (!material) {
      return res.status(404).json({ error: "Raw material not found" })
    }

    let newQuantity
    switch (operation) {
      case "add":
        newQuantity = material.quantity + Number.parseFloat(quantity)
        break
      case "subtract":
        newQuantity = Math.max(0, material.quantity - Number.parseFloat(quantity))
        break
      case "set":
      default:
        newQuantity = Number.parseFloat(quantity)
        break
    }

    material.quantity = newQuantity
    await material.save()

    res.json(material)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// Get materials by category
exports.getMaterialsByCategory = async (req, res) => {
  try {
    const { category } = req.params
    const materials = await RawMaterial.find({ category }).sort({ name: 1 })
    res.json(materials)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}