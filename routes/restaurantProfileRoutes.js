const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Branch = require("../model/Branch");
const { uploadFile2 } = require("../middleware/AWS");

// Configure Multer for file uploads (using disk storage for local development)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/branch');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  },
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * Adapter routes to make HotelViratAws compatible with WaveCrm's restaurant API
 * Maps between Branch model (simple) and Restaurant model (complex)
 */

// Convert Branch to Restaurant format
const branchToRestaurant = (branch) => {
  // Parse address if it's a string
  let addressData = {
    street: "",
    city: "",
    state: "",
    country: ""
  };
  
  if (typeof branch.address === 'string') {
    const parts = branch.address.split(',').map(p => p.trim());
    
    if (parts.length >= 3) {
      // Check if last part looks like a country
      const lastPart = parts[parts.length - 1];
      const isCountry = lastPart.length < 30 && !lastPart.match(/\d{6}/);
      
      if (isCountry) {
        // Format: "Street parts..., City, State, Country"
        addressData = {
          street: parts.slice(0, -3).join(', '),
          city: parts[parts.length - 3] || "",
          state: parts[parts.length - 2] || "",
          country: parts[parts.length - 1] || ""
        };
      } else {
        // Format: "Street parts..., City, State Pincode"
        addressData = {
          street: parts.slice(0, -2).join(', '),
          city: parts[parts.length - 2] || "",
          state: parts[parts.length - 1] || "",
          country: ""
        };
      }
    } else {
      addressData.street = branch.address;
    }
  } else if (branch.address) {
    addressData = branch.address;
  }
  
  return {
    _id: branch._id,
    branchName: branch.name,
    restaurantName: branch.name,
    gstNumber: branch.gstNumber || "",
    address: addressData,
    contact: branch.contact || {
      phone: "",
      email: "",
    },
    openingHours: branch.openingHours || {
      mondayToFriday: "11:00 AM - 11:00 PM",
      saturday: "11:00 AM - 12:00 AM",
      sunday: "12:00 PM - 10:00 PM",
    },
    image: branch.image,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  };
};

// Convert Restaurant to Branch format
const restaurantToBranch = (restaurant) => {
  const addressStr = restaurant.address
    ? `${restaurant.address.street}, ${restaurant.address.city}, ${restaurant.address.state}, ${restaurant.address.country}`
    : "";
  
  return {
    name: restaurant.branchName || restaurant.restaurantName,
    address: addressStr.trim() || restaurant.address,
  };
};

// GET /api/v1/hotel/getAllRestaurants - Get all restaurants (mapped from branches)
router.get("/getAllRestaurants", async (req, res) => {
  try {
    const branches = await Branch.find();
    const restaurants = branches.map(branchToRestaurant);
    res.json(restaurants);
  } catch (error) {
    console.error("Error fetching restaurants:", error);
    res.status(500).json({ message: "Error fetching restaurants", error: error.message });
  }
});

// GET /api/v1/hotel/getRestaurantById/:id - Get restaurant by ID
router.get("/getRestaurantById/:id", async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    res.json(branchToRestaurant(branch));
  } catch (error) {
    console.error("Error fetching restaurant:", error);
    res.status(500).json({ message: "Error fetching restaurant", error: error.message });
  }
});

// POST /api/v1/hotel/hotel - Create restaurant (mapped to branch)
router.post("/hotel", upload.single("image"), async (req, res) => {
  try {

    // Parse JSON strings from FormData
    let restaurantData = { ...req.body };
    if (typeof restaurantData.address === 'string') {
      restaurantData.address = JSON.parse(restaurantData.address);
    }
    if (typeof restaurantData.contact === 'string') {
      restaurantData.contact = JSON.parse(restaurantData.contact);
    }
    if (typeof restaurantData.openingHours === 'string') {
      restaurantData.openingHours = JSON.parse(restaurantData.openingHours);
    }
    
    const branchData = restaurantToBranch(restaurantData);
    
    // Add image if uploaded (upload to S3)
    if (req.file) {
      try {
        const imageUrl = await uploadFile2(req.file.buffer, req.file.originalname, req.file.mimetype);
        branchData.image = imageUrl;
      } catch (uploadError) {
        console.error("Error uploading image to S3:", uploadError);
        // Continue without image if upload fails
      }
    }

    const branch = new Branch(branchData);
    await branch.save();
    res.status(201).json(branchToRestaurant(branch));
  } catch (error) {
    console.error("Error creating restaurant:", error);
    res.status(500).json({ message: "Error creating restaurant", error: error.message });
  }
});

// PUT /api/v1/hotel/hotel/:id - Update restaurant
router.put("/hotel/:id", upload.single("image"), async (req, res) => {
  try {

    // Parse JSON strings from FormData
    let restaurantData = { ...req.body };
    if (typeof restaurantData.address === 'string') {
      restaurantData.address = JSON.parse(restaurantData.address);
    }
    if (typeof restaurantData.contact === 'string') {
      restaurantData.contact = JSON.parse(restaurantData.contact);
    }
    if (typeof restaurantData.openingHours === 'string') {
      restaurantData.openingHours = JSON.parse(restaurantData.openingHours);
    }
    
    const branchData = restaurantToBranch(restaurantData);
    
    // Add image if uploaded (upload to S3)
    if (req.file) {
      try {
        const imageUrl = await uploadFile2(req.file.buffer, req.file.originalname, req.file.mimetype);
        branchData.image = imageUrl;
      } catch (uploadError) {
        console.error("Error uploading image to S3:", uploadError);
        // Continue without image if upload fails
      }
    }
    
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      branchData,
      { new: true, runValidators: true }
    );
    if (!branch) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    res.json(branchToRestaurant(branch));
  } catch (error) {
    console.error("Error updating restaurant:", error);
    res.status(500).json({ message: "Error updating restaurant", error: error.message });
  }
});

// DELETE /api/v1/hotel/hotel/:id - Delete restaurant
router.delete("/hotel/:id", async (req, res) => {
  try {
    const branch = await Branch.findByIdAndDelete(req.params.id);
    if (!branch) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    res.json({ message: "Restaurant deleted successfully" });
  } catch (error) {
    console.error("Error deleting restaurant:", error);
    res.status(500).json({ message: "Error deleting restaurant", error: error.message });
  }
});

// Alias routes for WaveCRM compatibility
// POST /api/v1/hotel/createRestaurant - Create restaurant (alias)
router.post("/createRestaurant", upload.single("image"), async (req, res) => {
  try {

    // Parse JSON strings from FormData
    let restaurantData = { ...req.body };
    if (typeof restaurantData.address === 'string') {
      try {
        restaurantData.address = JSON.parse(restaurantData.address);
      } catch (e) {
        // Keep as string if not JSON
      }
    }
    if (typeof restaurantData.contact === 'string') {
      try {
        restaurantData.contact = JSON.parse(restaurantData.contact);
      } catch (e) {
        // Keep as string if not JSON
      }
    }
    if (typeof restaurantData.openingHours === 'string') {
      try {
        restaurantData.openingHours = JSON.parse(restaurantData.openingHours);
      } catch (e) {
        // Keep as string if not JSON
      }
    }
    
    const branchData = restaurantToBranch(restaurantData);
    
    // Add other fields
    branchData.gstNumber = restaurantData.gstNumber;
    branchData.contact = restaurantData.contact;
    branchData.openingHours = restaurantData.openingHours;
    
    // Add _id if provided (for dual backend sync)
    if (restaurantData._id) {
      branchData._id = restaurantData._id;
    }
    
    // Add image if uploaded
    if (req.file) {
      try {
        const imageUrl = await uploadFile2(req.file, "branch");
        branchData.image = imageUrl;
      } catch (uploadError) {

        if (req.file.path) {
          branchData.image = req.file.path;
        }
      }
    }
    
    const branch = new Branch(branchData);
    await branch.save();
    res.status(201).json(branchToRestaurant(branch));
  } catch (error) {
    console.error("Error creating restaurant:", error);
    res.status(500).json({ message: "Error creating restaurant", error: error.message });
  }
});

// PUT /api/v1/hotel/updateRestaurant/:id - Update restaurant (alias)
router.put("/updateRestaurant/:id", upload.single("image"), async (req, res) => {
  try {

    // Parse JSON strings from FormData
    let restaurantData = { ...req.body };
    if (typeof restaurantData.address === 'string') {
      try {
        restaurantData.address = JSON.parse(restaurantData.address);
      } catch (e) {
        // Keep as string if not JSON
      }
    }
    if (typeof restaurantData.contact === 'string') {
      try {
        restaurantData.contact = JSON.parse(restaurantData.contact);
      } catch (e) {
        // Keep as string if not JSON
      }
    }
    if (typeof restaurantData.openingHours === 'string') {
      try {
        restaurantData.openingHours = JSON.parse(restaurantData.openingHours);
      } catch (e) {
        // Keep as string if not JSON
      }
    }
    
    const branchData = restaurantToBranch(restaurantData);
    
    // Add other fields
    branchData.gstNumber = restaurantData.gstNumber;
    branchData.contact = restaurantData.contact;
    branchData.openingHours = restaurantData.openingHours;
    
    // Add image if uploaded
    if (req.file) {
      try {
        const imageUrl = await uploadFile2(req.file, "branch");
        branchData.image = imageUrl;
      } catch (uploadError) {

        if (req.file.path) {
          branchData.image = req.file.path;
        }
      }
    }
    
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      branchData,
      { new: true, runValidators: true }
    );
    
    if (!branch) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    
    res.json(branchToRestaurant(branch));
  } catch (error) {
    console.error("Error updating restaurant:", error);
    res.status(500).json({ message: "Error updating restaurant", error: error.message });
  }
});

module.exports = router;