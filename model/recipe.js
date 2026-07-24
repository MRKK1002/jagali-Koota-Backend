// const mongoose = require('mongoose');

// const recipeSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//   },
//   description: {
//     type: String,
//     required: true,
//   },
//   cooking_time: {
//     type: Number,
//     required: true,
//   },
//   servings: {
//     type: Number,
//     required: true,
//   },
//   cost_per_serving: {
//     type: Number,
//     required: true,
//   },
//   ingredients: [
//     {
//       raw_material_id: {
//         type: Number,
//         required: true,
//       },
//       quantity: { 
//         type: Number,
//         required: true,
//       },
//       unit: {
//         type: String,
//         required: true,
//       },
//     },
//   ],
//   instructions: {
//     type: String,
//     required: true,
//   },
// });

// const Recipe = mongoose.model('Recipe', recipeSchema);

// module.exports = Recipe;



const mongoose = require("mongoose")

const recipeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Link to the menu item this recipe belongs to
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Menu",
      default: null,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    cooking_time: {
      type: Number,
      required: true,
    },
    servings: {
      type: Number,
      required: true,
    },
    cost_per_serving: {
      type: Number,
      required: true,
    },
    ingredients: [
      {
        rawMaterialId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RawMaterial",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        unit: {
          type: String,
          required: true,
        },
      },
    ],
    instructions: {
      type: String,
      required: true,
    },
    image: {
      type: String,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("Recipe", recipeSchema)