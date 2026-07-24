// const Recipe = require("../model/recipe");

// // Get all recipes
// exports.getAllRecipes = async (req, res) => {
//   try {
//     const recipes = await Recipe.find();
//     res.json(recipes);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // Get a single recipe by ID
// exports.getRecipeById = async (req, res) => {
//   try {
//     const recipe = await Recipe.findById(req.params.id);
//     if (!recipe) return res.status(404).json({ error: "Recipe not found" });
//     res.json(recipe);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // Create a new recipe
// exports.createRecipe = async (req, res) => {
//   try {
//     const recipe = new Recipe(req.body);
//     await recipe.save();
//     res.status(201).json(recipe);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// };

// // Update a recipe
// exports.updateRecipe = async (req, res) => {
//   try {
//     const recipe = await Recipe.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     if (!recipe) return res.status(404).json({ error: "Recipe not found" });
//     res.json(recipe);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// };

// // Delete a recipe
// exports.deleteRecipe = async (req, res) => {
//   try {
//     const recipe = await Recipe.findByIdAndDelete(req.params.id);
//     if (!recipe) return res.status(404).json({ error: "Recipe not found" });
//     res.json({ message: "Recipe deleted" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };



const Recipe = require("../model/recipe")
const RawMaterial = require("../model/rawMaterialModel")
const { LocationInventory } = require("../model/inventoryModel")
const mongoose = require("mongoose")

// Get all recipes
exports.getAllRecipes = async (req, res) => {
  try {
    const { search, category } = req.query

    // Build filter
    const filter = {}
    if (search) {
      filter.$or = [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }]
    }
    if (category && category !== "all") {
      filter.category = category
    }

    const recipes = await Recipe.find(filter).sort({ name: 1 })
    res.json({
      success: true,
      data: recipes,
    })
  } catch (err) {
    console.error("Error getting recipes:", err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// Get a single recipe by ID
exports.getRecipeById = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id).populate(
      "ingredients.rawMaterialId",
      "name unit price minLevel",
    )
    if (!recipe) {
      return res.status(404).json({ success: false, error: "Recipe not found" })
    }
    res.json({
      success: true,
      data: recipe,
    })
  } catch (err) {
    console.error("Error getting recipe:", err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// Create a new recipe
exports.createRecipe = async (req, res) => {
  try {
    // If menuItemId provided, ensure only one recipe per menu item
    if (req.body.menuItemId) {
      const existing = await Recipe.findOne({ menuItemId: req.body.menuItemId })
      if (existing) {
        return res.status(400).json({
          success: false,
          error: "A recipe already exists for this menu item. Use update instead.",
        })
      }
    }
    const recipe = new Recipe(req.body)
    await recipe.save()
    res.status(201).json({
      success: true,
      data: recipe,
      message: "Recipe created successfully",
    })
  } catch (err) {
    console.error("Error creating recipe:", err)
    res.status(400).json({ success: false, error: err.message })
  }
}

// Update a recipe
exports.updateRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!recipe) {
      return res.status(404).json({ success: false, error: "Recipe not found" })
    }
    res.json({
      success: true,
      data: recipe,
      message: "Recipe updated successfully",
    })
  } catch (err) {
    console.error("Error updating recipe:", err)
    res.status(400).json({ success: false, error: err.message })
  }
}

// Get recipe by menu item ID
exports.getRecipeByMenuItemId = async (req, res) => {
  try {
    const { menuItemId } = req.params
    const recipe = await Recipe.findOne({ menuItemId }).populate(
      "ingredients.rawMaterialId",
      "name unit price quantity minLevel status"
    )
    if (!recipe) {
      return res.status(404).json({ success: false, error: "No recipe found for this menu item" })
    }
    res.json({ success: true, data: recipe })
  } catch (err) {
    console.error("Error getting recipe by menuItemId:", err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// Delete a recipe
exports.deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findByIdAndDelete(req.params.id)
    if (!recipe) {
      return res.status(404).json({ success: false, error: "Recipe not found" })
    }
    res.json({
      success: true,
      message: "Recipe deleted successfully",
    })
  } catch (err) {
    console.error("Error deleting recipe:", err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// Get recipe with inventory status for a specific location
exports.getRecipeWithInventoryStatus = async (req, res) => {
  try {
    const { recipeId, locationId } = req.params

    // Get recipe details
    const recipe = await Recipe.findById(recipeId).populate("ingredients.rawMaterialId", "name unit price minLevel")
    if (!recipe) {
      return res.status(404).json({ success: false, error: "Recipe not found" })
    }

    // Get inventory status for each ingredient
    const inventoryStatus = await Promise.all(
      recipe.ingredients.map(async (ingredient) => {
        const inventory = await LocationInventory.findOne({
          locationId,
          rawMaterialId: ingredient.rawMaterialId._id,
        })

        return {
          rawMaterialId: ingredient.rawMaterialId._id,
          name: ingredient.rawMaterialId.name,
          requiredQuantity: ingredient.quantity,
          unit: ingredient.unit || ingredient.rawMaterialId.unit,
          inStock: inventory ? inventory.quantity : 0,
          minLevel: ingredient.rawMaterialId.minLevel || 0,
        }
      }),
    )

    res.json({
      success: true,
      data: {
        recipe,
        inventoryStatus,
      },
    })
  } catch (err) {
    console.error("Error getting recipe inventory status:", err)
    res.status(500).json({ success: false, error: err.message })
  }
}

// Get recipe categories
exports.getRecipeCategories = async (req, res) => {
  try {
    const categories = await Recipe.distinct("category")
    res.json({
      success: true,
      data: categories,
    })
  } catch (err) {
    console.error("Error getting recipe categories:", err)
    res.status(500).json({ success: false, error: err.message })
  }
}