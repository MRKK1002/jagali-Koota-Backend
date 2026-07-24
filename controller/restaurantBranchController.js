const Branch = require("../model/Branch")
const Category = require("../model/Category")
const asyncHandler = require("express-async-handler")

// Get only branches that have restaurant categories
const getRestaurantBranches = asyncHandler(async (req, res) => {
  try {
    
    // First, let's see ALL categories to debug
    const allCategories = await Category.find({})
    
    // Find all categories where name contains "restaurant" (case-insensitive)
    const restaurantCategories = await Category.find({
      name: { $regex: /restaurant/i }
    })
    
    
    if (restaurantCategories.length === 0) {
      return res.json([])
    }
    
    // Extract unique branch IDs from restaurant categories
    // Handle both branchId (string) and branch.id (nested object)
    const branchIdsWithRestaurantCategories = [...new Set(
      restaurantCategories
        .map(cat => {
          // Try branchId first, then branch.id
          if (cat.branchId) return cat.branchId.toString()
          if (cat.branch && cat.branch.id) return cat.branch.id.toString()
          return null
        })
        .filter(id => id) // Remove null/undefined
    )]
    
    
    if (branchIdsWithRestaurantCategories.length === 0) {
      return res.json([])
    }
    
    // Get all branches that have restaurant categories
    const restaurantBranches = await Branch.find({
      _id: { $in: branchIdsWithRestaurantCategories }
    })
    
    
    res.json(restaurantBranches)
  } catch (error) {
    console.error("❌ Error in getRestaurantBranches:", error)
    res.status(500).json({ message: error.message })
  }
})

module.exports = {
  getRestaurantBranches
}