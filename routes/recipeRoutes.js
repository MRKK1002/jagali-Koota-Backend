const express = require("express");
const router = express.Router();
const recipeController = require("../controller/recipeController");

router.get("/", recipeController.getAllRecipes);
router.get("/categories", recipeController.getRecipeCategories);
router.get("/by-menu/:menuItemId", recipeController.getRecipeByMenuItemId); // fetch recipe linked to a menu item
router.get("/:id", recipeController.getRecipeById);
router.post("/", recipeController.createRecipe);
router.put("/:id", recipeController.updateRecipe);
router.delete("/:id", recipeController.deleteRecipe);

module.exports = router;
