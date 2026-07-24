// const StoreLocation = require("../model/storeLocationModel");

// // Create a new store location
// exports.createStoreLocation = async (req, res) => {
//     try {
//         const { name, address, manager, contact, itemCount } = req.body;
//         const location = new StoreLocation({ name, address, manager, contact, itemCount });
//         await location.save();
//         res.status(201).json({
//             success: true,
//             message: "Store location created successfully",
//             data: location,
//         });
//     } catch (error) {
//         res.status(500).json({ success: false, message: "Failed to create store location", error: error.message });
//     }
// };

// // Get all store locations
// exports.getAllStoreLocations = async (req, res) => {
//     try {
//         const locations = await StoreLocation.find();
//         res.status(200).json({ success: true, data: locations });
//     } catch (error) {
//         res.status(500).json({ success: false, message: "Failed to fetch store locations", error: error.message });
//     }
// };

// // Get a single store location by ID
// exports.getStoreLocationById = async (req, res) => {
//     try {
//         const location = await StoreLocation.findById(req.params.id);
//         if (!location) {
//             return res.status(404).json({ success: false, message: "Store location not found" });
//         }
//         res.status(200).json({ success: true, data: location });
//     } catch (error) {
//         res.status(500).json({ success: false, message: "Failed to fetch store location", error: error.message });
//     }
// };

// // Update a store location
// exports.updateStoreLocation = async (req, res) => {
//     try {
//         const { name, address, manager, contact, itemCount } = req.body;
//         const location = await StoreLocation.findByIdAndUpdate(
//             req.params.id,
//             { name, address, manager, contact, itemCount },
//             { new: true }
//         );
//         if (!location) {
//             return res.status(404).json({ success: false, message: "Store location not found" });
//         }
//         res.status(200).json({
//             success: true,
//             message: "Store location updated successfully",
//             data: location,
//         });
//     } catch (error) {
//         res.status(500).json({ success: false, message: "Failed to update store location", error: error.message });
//     }
// };

// // Delete a store location
// exports.deleteStoreLocation = async (req, res) => {
//     try {
//         const location = await StoreLocation.findByIdAndDelete(req.params.id);
//         if (!location) {
//             return res.status(404).json({ success: false, message: "Store location not found" });
//         }
//         res.status(200).json({ success: true, message: "Store location deleted successfully" });
//     } catch (error) {
//         res.status(500).json({ success: false, message: "Failed to delete store location", error: error.message });
//     }
// };



const StoreLocation = require("../model/storeLocationModel")
const { LocationInventory } = require("../model/inventoryModel")

// Get all store locations with item counts
exports.getAllStoreLocations = async (req, res) => {
  try {
    const { includeItemCount } = req.query

    let locations = await StoreLocation.find().sort({ name: 1 })

    if (includeItemCount === "true") {
      // Get item counts for each location
      const locationsWithCount = await Promise.all(
        locations.map(async (location) => {
          const itemCount = await LocationInventory.countDocuments({
            locationId: location._id,
            quantity: { $gt: 0 },
          })

          return {
            ...location.toObject(),
            itemCount,
          }
        }),
      )

      locations = locationsWithCount
    }

    res.json({
      success: true,
      data: locations,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Get store location by ID
exports.getStoreLocationById = async (req, res) => {
  try {
    const location = await StoreLocation.findById(req.params.id)
    if (!location) {
      return res.status(404).json({ error: "Store location not found" })
    }

    // Get item count
    const itemCount = await LocationInventory.countDocuments({
      locationId: location._id,
      quantity: { $gt: 0 },
    })

    res.json({
      success: true,
      data: [
        {
          ...location.toObject(),
          itemCount,
        },
      ],
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Create new store location
exports.createStoreLocation = async (req, res) => {
  try {
    const { name, address, manager, contact } = req.body

    const location = new StoreLocation({
      name,
      address,
      manager,
      contact,
    })

    await location.save()

    res.status(201).json({
      success: true,
      message: "Store location created successfully",
      data: location,
    })
  } catch (err) {
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message)
      return res.status(400).json({ error: errors.join(", ") })
    }
    res.status(500).json({ error: err.message })
  }
}

// Update store location
exports.updateStoreLocation = async (req, res) => {
  try {
    const { name, address, manager, contact } = req.body

    const location = await StoreLocation.findByIdAndUpdate(
      req.params.id,
      { name, address, manager, contact },
      { new: true, runValidators: true },
    )

    if (!location) {
      return res.status(404).json({ error: "Store location not found" })
    }

    res.json({
      success: true,
      message: "Store location updated successfully",
      data: location,
    })
  } catch (err) {
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message)
      return res.status(400).json({ error: errors.join(", ") })
    }
    res.status(500).json({ error: err.message })
  }
}

// Delete store location
exports.deleteStoreLocation = async (req, res) => {
  try {
    // Check if location has inventory
    const hasInventory = await LocationInventory.exists({
      locationId: req.params.id,
      quantity: { $gt: 0 },
    })

    if (hasInventory) {
      return res.status(400).json({
        error: "Cannot delete location with existing inventory. Please transfer or remove all items first.",
      })
    }

    const location = await StoreLocation.findByIdAndDelete(req.params.id)
    if (!location) {
      return res.status(404).json({ error: "Store location not found" })
    }

    // Clean up any zero-quantity inventory records
    await LocationInventory.deleteMany({
      locationId: req.params.id,
      quantity: 0,
    })

    res.json({
      success: true,
      message: "Store location deleted successfully",
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = exports