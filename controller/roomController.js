const Room = require("../model/Room");
const asyncHandler = require("express-async-handler");
const { uploadFile2, deleteFile } = require("../middleware/AWS");
const path = require("path");
const fs = require("fs");

// Upload images helper - handles disk storage (files already saved by multer)
const uploadImages = async (files) => {
  const imageUrls = [];
  
  for (const file of files) {
    try {

      // File is already saved to disk by multer, use the local path
      const localUrl = file.path.replace(/\\/g, '/'); // Normalize path for URLs

      imageUrls.push(localUrl);
      
      // Optionally also upload to S3 for backup
      try {
        const fileBuffer = fs.readFileSync(file.path);
        const s3Url = await uploadFile2(fileBuffer, file.originalname, file.mimetype);
        if (s3Url) {

        }
      } catch (s3Error) {

      }
    } catch (error) {
      console.error("Error processing image:", error);
    }
  }
  
  return imageUrls;
};

// Create Room
const createRoom = asyncHandler(async (req, res) => {
  try {



    const { 
      branchId, floor, roomType, price, description, amenities, capacity, roomNumber,
      hourlyPricing, housekeepingStatus, cleaningNotes 
    } = req.body;

    if (!branchId || !floor || !price) {
      return res.status(400).json({ message: "Branch, floor and price are required" });
    }

    let images = [];
    if (req.files && req.files.length > 0) {

      try {
        images = await uploadImages(req.files.slice(0, 5)); // Max 5 images

      } catch (uploadError) {
        console.error("Image upload failed, continuing without images:", uploadError);
        // Continue without images rather than failing the whole request
      }
    }

    let parsedAmenities = {};
    let parsedCapacity = { adults: 2, children: 0 };
    let parsedHourlyPricing = { enabled: false, threeHours: 0, sixHours: 0, nineHours: 0, twelveHours: 0 };
    
    try {
      parsedAmenities = typeof amenities === 'string' ? JSON.parse(amenities) : (amenities || {});
    } catch (e) {
      console.error("Error parsing amenities:", e);
    }
    
    try {
      parsedCapacity = typeof capacity === 'string' ? JSON.parse(capacity) : (capacity || { adults: 2, children: 0 });
    } catch (e) {
      console.error("Error parsing capacity:", e);
    }
    
    try {
      parsedHourlyPricing = typeof hourlyPricing === 'string' ? JSON.parse(hourlyPricing) : (hourlyPricing || parsedHourlyPricing);
    } catch (e) {
      console.error("Error parsing hourlyPricing:", e);
    }

    const room = new Room({
      branchId,
      floor: floor || 'First Floor',
      roomType: roomType || 'Single',
      price: Number(price),
      description: description || '',
      images,
      amenities: parsedAmenities,
      capacity: parsedCapacity,
      roomNumber: roomNumber || '',
      hourlyPricing: parsedHourlyPricing,
      housekeepingStatus: housekeepingStatus || 'clean',
      cleaningNotes: cleaningNotes || '',
    });

    const createdRoom = await room.save();

    res.status(201).json(createdRoom);
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ message: error.message || "Failed to create room" });
  }
});

// Get all rooms
const getRooms = asyncHandler(async (req, res) => {
  try {
    const { branchId } = req.query;
    const filter = branchId ? { branchId } : {};
    const rooms = await Room.find(filter).populate('branchId', 'name');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get room by ID
const getRoomById = asyncHandler(async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate('branchId', 'name');
    if (room) {
      res.json(room);
    } else {
      res.status(404).json({ message: "Room not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update room
const updateRoom = asyncHandler(async (req, res) => {
  try {
    const fs = require('fs');
    const logData = {
      timestamp: new Date().toISOString(),
      roomId: req.params.id,
      hourlyPricing: req.body.hourlyPricing,
      allBody: req.body
    };
    fs.appendFileSync('room-update-log.txt', JSON.stringify(logData, null, 2) + '\n---\n');



    const { 
      floor, roomType, price, description, amenities, capacity, roomNumber, isAvailable, existingImages,
      hourlyPricing, housekeepingStatus, cleaningNotes, lastCleanedBy 
    } = req.body;
    
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Handle existing images
    let images = [];
    if (existingImages) {
      try {
        images = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
      } catch (e) {
        console.error("Error parsing existingImages:", e);
        images = room.images || [];
      }
    }

    // Upload new images
    if (req.files && req.files.length > 0) {
      try {
        const newImages = await uploadImages(req.files.slice(0, 5 - images.length));
        images = [...images, ...newImages].slice(0, 5);
      } catch (uploadError) {
        console.error("Image upload failed during update:", uploadError);
        // Keep existing images if upload fails
      }
    }

    const updateData = {
      floor: floor || room.floor,
      roomType: roomType || room.roomType,
      price: price ? Number(price) : room.price,
      description: description !== undefined ? description : room.description,
      images: images.length > 0 ? images : room.images,
      roomNumber: roomNumber !== undefined ? roomNumber : room.roomNumber,
      isAvailable: isAvailable !== undefined ? isAvailable === 'true' || isAvailable === true : room.isAvailable,
    };

    if (amenities) {
      try {
        updateData.amenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
      } catch (e) {
        console.error("Error parsing amenities:", e);
      }
    }
    if (capacity) {
      try {
        updateData.capacity = typeof capacity === 'string' ? JSON.parse(capacity) : capacity;
      } catch (e) {
        console.error("Error parsing capacity:", e);
      }
    }
    
    // Handle hourly pricing update
    if (hourlyPricing) {
      try {
        const parsed = typeof hourlyPricing === 'string' ? JSON.parse(hourlyPricing) : hourlyPricing;

        updateData.hourlyPricing = parsed;
      } catch (e) {
        console.error("❌ Error parsing hourlyPricing:", e);
      }
    } else {

    }
    
    // Handle housekeeping status update
    if (housekeepingStatus !== undefined) {
      updateData.housekeepingStatus = housekeepingStatus;
      
      // If status is being set to 'clean' or 'inspected', update lastCleanedAt
      if (housekeepingStatus === 'clean' || housekeepingStatus === 'inspected') {
        updateData.lastCleanedAt = new Date();
        if (lastCleanedBy) {
          updateData.lastCleanedBy = lastCleanedBy;
        }
      }
    }
    
    if (cleaningNotes !== undefined) {
      updateData.cleaningNotes = cleaningNotes;
    }


    const updatedRoom = await Room.findByIdAndUpdate(req.params.id, updateData, { new: true });


    res.json(updatedRoom);
  } catch (error) {
    console.error("Error updating room:", error);
    res.status(500).json({ message: error.message || "Failed to update room" });
  }
});

// Delete room
const deleteRoom = asyncHandler(async (req, res) => {
  try {

    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Try to delete images, but don't fail if image deletion fails
    if (room.images && room.images.length > 0) {
      for (const imageUrl of room.images) {
        try {
          await deleteFile(imageUrl);
        } catch (imgError) {
          console.error("Failed to delete image:", imageUrl, imgError);
          // Continue with room deletion even if image deletion fails
        }
      }
    }

    await Room.deleteOne({ _id: req.params.id });

    res.json({ message: "Room deleted successfully" });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({ message: error.message || "Failed to delete room" });
  }
});

module.exports = {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
};