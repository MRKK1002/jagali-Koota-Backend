const Terms = require("../model/termsModel")

// Get all terms and policies
exports.getTerms = async (req, res) => {
  try {
    const { category } = req.query

    // Build query
    const query = { isActive: true }
    if (category) {
      query.category = category
    }

    // Get terms and policies
    const terms = await Terms.find(query).sort({ order: 1, createdAt: -1 })

    res.status(200).json(terms)
  } catch (error) {
    res.status(500).json({ message: "Error fetching terms and policies", error: error.message })
  }
}

// Get a single term by ID
exports.getTermById = async (req, res) => {
  try {
    const { id } = req.params

    const term = await Terms.findById(id)
    if (!term) {
      return res.status(404).json({ message: "Term not found" })
    }

    res.status(200).json(term)
  } catch (error) {
    res.status(500).json({ message: "Error fetching term", error: error.message })
  }
}

// Admin: Create a new term
exports.createTerm = async (req, res) => {
  try {
    const { title, description, category, order } = req.body

    if (!title || !description || !category) {
      return res.status(400).json({ message: "Title, description, and category are required" })
    }

    const term = new Terms({
      title,
      description,
      category,
      order: order || 0,
    })

    await term.save()

    res.status(201).json({ message: "Term created successfully", term })
  } catch (error) {
    res.status(400).json({ message: "Error creating term", error: error.message })
  }
}

// Admin: Update a term
exports.updateTerm = async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, category, order, isActive } = req.body

    const term = await Terms.findByIdAndUpdate(
      id,
      { title, description, category, order, isActive },
      { new: true, runValidators: true },
    )

    if (!term) {
      return res.status(404).json({ message: "Term not found" })
    }

    res.status(200).json({ message: "Term updated successfully", term })
  } catch (error) {
    res.status(400).json({ message: "Error updating term", error: error.message })
  }
}

// Admin: Delete a term
exports.deleteTerm = async (req, res) => {
  try {
    const { id } = req.params

    const term = await Terms.findByIdAndDelete(id)
    if (!term) {
      return res.status(404).json({ message: "Term not found" })
    }

    res.status(200).json({ message: "Term deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Error deleting term", error: error.message })
  }
}