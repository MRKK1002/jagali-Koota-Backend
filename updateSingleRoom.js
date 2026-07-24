// Quick script to update a single room with hourlyPricing
const mongoose = require('mongoose');
require('dotenv').config();

const updateRoom = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const Room = mongoose.model('Room', new mongoose.Schema({}, { strict: false }));

    // Update the room with ID 6965f899de79ea8b1dd4b713
    const roomId = '6965f899de79ea8b1dd4b713';
    
    const result = await Room.findByIdAndUpdate(
      roomId,
      {
        $set: {
          hourlyPricing: {
            enabled: true,
            threeHours: 300,
            sixHours: 600,
            nineHours: 900,
            twelveHours: 1200
          }
        }
      },
      { new: true }
    );

    console.log('✅ Room updated!');
    console.log('Room ID:', result._id);
    console.log('hourlyPricing:', result.hourlyPricing);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

updateRoom();
