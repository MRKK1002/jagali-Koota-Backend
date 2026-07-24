const express = require("express")
const router = express.Router()
const { getRestaurantBranches } = require("../controller/restaurantBranchController")

// Get only restaurant category branches
router.route("/").get(getRestaurantBranches)

module.exports = router