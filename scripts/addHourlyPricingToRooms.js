// Script to add hourlyPricing field to all existing rooms
const mongoose = require('mongoose');
require('dotenv').config();

const Room = require('../model/Room');

const addHourlyPricingToRooms = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all rooms that don't have hourlyPricing field
    const rooms = await Room.find({});
    console.log(`Found ${rooms.length} rooms`);

    let updatedCount = 0;
    for (const room of rooms) {
      if (!room.hourlyPricing) {
        room.hourlyPricing = {
          enabled: false,
          threeHours: 0,
          sixHours: 0,
          nineHours: 0,
          twelveHours: 0
        };
        await room.save();
        updatedCount++;
        console.log(`Updated room ${room.roomNumber || room._id} - added hourlyPricing field`);
      } else {
        console.log(`Room ${room.roomNumber || room._id} already has hourlyPricing field`);
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} rooms`);
    console.log(`Total rooms: ${rooms.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

addHourlyPricingToRooms();
