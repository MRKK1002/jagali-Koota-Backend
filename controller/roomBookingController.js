const RoomBooking = require("../model/RoomBooking");
const Room = require("../model/Room");
const asyncHandler = require("express-async-handler");

// Create Room Booking
const createRoomBooking = asyncHandler(async (req, res) => {
  try {


    const {
      roomId,
      branchId,
      userId,
      userName,
      userPhone,
      userEmail,
      guestName,
      guestEmail,
      guestPhone,
      guestGstNumber,
      aadhaarNumber,
      panNumber,
      aadhaarPic,
      visaPic,
      isExceeding24Hours,
      customAmount,
      checkInDate,
      checkOutDate,
      checkInTime,
      checkOutTime,
      adults,
      children,
      specialRequests,
      baseAmount,
      discountPercent,
      discountAmount,
      gstOption,
      gstType,
      gstAmount,
      cgst,
      sgst,
      igst,
      totalAmount,
      totalPrice,
      status
    } = req.body;

    // Validate required fields - check if either user or guest data is provided
    const hasGuestData = guestName || guestPhone;
    const hasUserData = userName || userPhone;
    
    if (!roomId || (!hasGuestData && !hasUserData) || !checkInDate || !checkOutDate || !totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Room ID, guest/user name and phone, check-in/out dates, and total amount are required"
      });
    }

    // Validate dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      return res.status(400).json({
        success: false,
        message: "Check-in date cannot be in the past"
      });
    }

    if (checkOut < checkIn) {
      return res.status(400).json({
        success: false,
        message: "Check-out date cannot be before check-in date"
      });
    }

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // Check for conflicting bookings
    // Only check active bookings (pending, confirmed, checked-in)
    // Exclude: cancelled, checked-out, completed
    // 
    // Date logic: Room is occupied from check-in TO (but NOT including) check-out
    // Example: Booking 7th → 8th means room occupied on 7th only, 8th is free
    // 
    // Conflict exists if:
    // - Existing booking's occupied dates overlap with new booking's occupied dates
    // - Since checkout date is NOT occupied, we use < instead of <=
    const conflictingBooking = await RoomBooking.findOne({
      roomId: roomId,
      status: { $in: ['pending', 'confirmed', 'checked-in'] },
      // Check if date ranges overlap (excluding checkout dates)
      checkInDate: { $lt: checkOut },      // Existing check-in is before new check-out
      checkOutDate: { $gt: checkIn }       // Existing check-out is after new check-in
    });

    if (conflictingBooking) {

      return res.status(400).json({
        success: false,
        message: "Room is already booked for the selected dates",
        conflict: {
          checkInDate: conflictingBooking.checkInDate,
          checkOutDate: conflictingBooking.checkOutDate,
          status: conflictingBooking.status
        }
      });
    }

    // Handle user and guest data synchronization
    // If guest data is not provided, use user data as fallback
    const finalGuestName = guestName ? guestName.trim() : (userName ? userName.trim() : '');
    const finalGuestEmail = guestEmail ? guestEmail.trim().toLowerCase() : (userEmail ? userEmail.trim().toLowerCase() : '');
    const finalGuestPhone = guestPhone ? guestPhone.trim() : (userPhone ? userPhone.trim() : '');
    
    // If user data is not provided, use guest data as fallback
    const finalUserName = userName || finalGuestName;
    const finalUserEmail = userEmail || finalGuestEmail;
    const finalUserPhone = userPhone || finalGuestPhone;

    // Create booking
    const booking = new RoomBooking({
      roomId,
      branchId: branchId || room.branchId,
      userId: userId || null,
      userName: finalUserName,
      userPhone: finalUserPhone,
      userEmail: finalUserEmail,
      guestName: finalGuestName,
      guestEmail: finalGuestEmail,
      guestPhone: finalGuestPhone,
      guestGstNumber: guestGstNumber || '',
      aadhaarNumber: aadhaarNumber || '',
      panNumber: panNumber || '',
      aadhaarPic: aadhaarPic || null,
      visaPic: visaPic || null,
      isExceeding24Hours: isExceeding24Hours || false,
      customAmount: customAmount || 0,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      checkInTime: checkInTime || '12:00',
      checkOutTime: checkOutTime || '11:00',
      adults: adults || 1,
      children: children || 0,
      baseAmount: baseAmount || totalAmount,
      discountPercent: discountPercent || 0,
      discountAmount: discountAmount || 0,
      gstOption: gstOption || 'withGST',
      gstType: gstType || 'none',
      gstAmount: gstAmount || 0,
      cgst: cgst || 0,
      sgst: sgst || 0,
      igst: igst || 0,
      totalAmount: totalAmount,
      totalPrice: totalPrice || totalAmount,
      specialRequests: specialRequests || '',
      status: status || 'confirmed',
      bookingSource: 'online', // Mark as online booking
      bookingDate: new Date()
    });

    const savedBooking = await booking.save();
    
    // Populate room details
    await savedBooking.populate('roomId');

    res.status(201).json({
      success: true,
      message: "Room booking created successfully",
      booking: savedBooking
    });

  } catch (error) {
    console.error("Error creating room booking:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create room booking"
    });
  }
});

// Create walk-in booking (for receptionist - no userId required)
const createWalkInBooking = asyncHandler(async (req, res) => {
  try {


    const {
      roomId,
      branchId,
      userName,
      userPhone,
      userEmail,
      guestName,
      guestEmail,
      guestPhone,
      guestGstNumber,
      aadhaarNumber,
      panNumber,
      aadhaarPic,
      visaPic,
      isExceeding24Hours,
      customAmount,
      checkInDate,
      checkOutDate,
      checkInTime,
      checkOutTime,
      nights,
      baseAmount,
      discountPercent,
      discountAmount,
      gstType,
      cgst,
      sgst,
      igst,
      totalAmount,
      totalPrice,
      amountPaid,
      cashAmount,
      onlineAmount,
      payments,
      status,
      paymentStatus
    } = req.body;

    // Validate required fields - check if either user or guest data is provided
    const hasGuestData = guestName || guestPhone;
    const hasUserData = userName || userPhone;
    
    if (!roomId || (!hasGuestData && !hasUserData) || !checkInDate || !checkOutDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: roomId, guest/user name and phone, checkInDate, checkOutDate"
      });
    }

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // Check for conflicting bookings
    // Only check active bookings (pending, confirmed, checked-in)
    // Exclude: cancelled, checked-out, completed
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    
    const existingBooking = await RoomBooking.findOne({
      roomId,
      status: { $in: ['pending', 'confirmed', 'checked-in'] },
      // Check if date ranges overlap (excluding checkout dates)
      checkInDate: { $lt: checkOut },      // Existing check-in is before new check-out
      checkOutDate: { $gt: checkIn }       // Existing check-out is after new check-in
    });

    if (existingBooking) {

      return res.status(400).json({
        success: false,
        message: "Room is already booked for these dates",
        conflict: {
          checkInDate: existingBooking.checkInDate,
          checkOutDate: existingBooking.checkOutDate,
          status: existingBooking.status
        }
      });
    }

    // Handle user and guest data synchronization
    // If guest data is not provided, use user data as fallback
    const finalGuestName = guestName || userName || '';
    const finalGuestEmail = guestEmail ? guestEmail.trim().toLowerCase() : (userEmail ? userEmail.trim().toLowerCase() : '');
    const finalGuestPhone = guestPhone || userPhone || '';
    
    // If user data is not provided, use guest data as fallback
    const finalUserName = userName || guestName || '';
    const finalUserEmail = userEmail ? userEmail.trim().toLowerCase() : (guestEmail ? guestEmail.trim().toLowerCase() : '');
    const finalUserPhone = userPhone || guestPhone || '';

    // Handle totalAmount and totalPrice - they should be the same
    const finalTotalAmount = totalAmount || totalPrice || 0;
    const finalTotalPrice = totalPrice || totalAmount || 0;

    const booking = new RoomBooking({
      roomId,
      branchId: branchId?._id || branchId || room.branchId,
      userId: null, // Walk-in guest, no user account
      userName: finalUserName,
      userPhone: finalUserPhone,
      userEmail: finalUserEmail,
      guestName: finalGuestName,
      guestEmail: finalGuestEmail,
      guestPhone: finalGuestPhone,
      guestGstNumber: guestGstNumber || '',
      aadhaarNumber: aadhaarNumber || '',
      panNumber: panNumber || '',
      aadhaarPic: aadhaarPic || null,
      visaPic: visaPic || null,
      isExceeding24Hours: isExceeding24Hours || false,
      customAmount: customAmount || 0,
      checkInDate: new Date(checkInDate),
      checkOutDate: new Date(checkOutDate),
      checkInTime: checkInTime || '12:00',
      checkOutTime: checkOutTime || '11:00',
      nights: nights || 1,
      baseAmount: baseAmount || finalTotalAmount,
      discountPercent: discountPercent || 0,
      discountAmount: discountAmount || 0,
      gstType: gstType || 'none',
      cgst: cgst || 0,
      sgst: sgst || 0,
      igst: igst || 0,
      totalAmount: finalTotalAmount,
      totalPrice: finalTotalPrice,
      amountPaid: amountPaid || 0,
      cashAmount: cashAmount || 0,
      onlineAmount: onlineAmount || 0,
      payments: payments || [],
      status: status || 'checked-in',
      paymentStatus: paymentStatus || 'pending',
      bookingSource: 'walk-in' // Mark as walk-in booking
    });

    const savedBooking = await booking.save();
    
    // Populate room details
    await savedBooking.populate('roomId');

    res.status(201).json({
      success: true,
      message: "Walk-in booking created successfully",
      booking: savedBooking
    });

  } catch (error) {
    console.error("Error creating walk-in booking:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create walk-in booking"
    });
  }
});

// Get all room bookings
const getRoomBookings = asyncHandler(async (req, res) => {
  try {
    const { status, roomId, branchId, userId, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (roomId) {
      filter.roomId = roomId;
    }
    if (branchId) {
      filter.branchId = branchId;
    }
    if (userId) {
      filter.userId = userId;
    }

    const bookings = await RoomBooking.find(filter)
      .populate('roomId', 'roomType floor price roomNumber branchId')
      .populate('branchId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await RoomBooking.countDocuments(filter);

    res.json({
      success: true,
      bookings: bookings,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total: total
    });

  } catch (error) {
    console.error("Error fetching room bookings:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch room bookings"
    });
  }
});

// Get room booking by ID
const getRoomBookingById = asyncHandler(async (req, res) => {
  try {
    const booking = await RoomBooking.findById(req.params.id)
      .populate('roomId', 'roomType floor price roomNumber branchId images')
      .populate('branchId', 'name');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Room booking not found"
      });
    }

    res.json({
      success: true,
      booking: booking
    });

  } catch (error) {
    console.error("Error fetching room booking:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch room booking"
    });
  }
});

// Update room booking
const updateRoomBooking = asyncHandler(async (req, res) => {
  try {


    const booking = await RoomBooking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Room booking not found"
      });
    }

    const { status, notes, guestName, guestEmail, guestPhone, specialRequests, amountPaid, paymentMethod, paymentAmount } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (guestName) updateData.guestName = guestName.trim();
    if (guestEmail) updateData.guestEmail = guestEmail.trim().toLowerCase();
    if (guestPhone !== undefined) updateData.guestPhone = guestPhone.trim();
    if (specialRequests !== undefined) updateData.specialRequests = specialRequests.trim();

    // Handle payment updates
    if (amountPaid !== undefined) {
      updateData.amountPaid = amountPaid;
      
      // Update payment status based on amount paid
      if (amountPaid >= booking.totalAmount) {
        updateData.paymentStatus = 'paid';
      } else if (amountPaid > 0) {
        updateData.paymentStatus = 'partial';
      } else {
        updateData.paymentStatus = 'pending';
      }
    }

    // Handle new payment
    if (paymentMethod && paymentAmount > 0) {
      if (paymentMethod === 'cash') {
        updateData.cashAmount = (booking.cashAmount || 0) + paymentAmount;
      } else if (paymentMethod === 'online') {
        updateData.onlineAmount = (booking.onlineAmount || 0) + paymentAmount;
      }

      // Add to payments array
      const newPayment = {
        amount: paymentAmount,
        method: paymentMethod,
        date: new Date()
      };
      
      updateData.payments = [...(booking.payments || []), newPayment];
      updateData.amountPaid = (booking.amountPaid || 0) + paymentAmount;
    }

    // Handle status changes with timestamps
    if (status === 'checked-in' && booking.status !== 'checked-in') {
      updateData.actualCheckInTime = new Date();
    } else if (status === 'checked-out' && booking.status !== 'checked-out') {
      updateData.actualCheckOutTime = new Date();
    }

    const updatedBooking = await RoomBooking.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('roomId', 'roomType floor price roomNumber')
     .populate('branchId', 'name');

    res.json({
      success: true,
      message: "Room booking updated successfully",
      booking: updatedBooking
    });

  } catch (error) {
    console.error("Error updating room booking:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update room booking"
    });
  }
});

// Delete room booking
const deleteRoomBooking = asyncHandler(async (req, res) => {
  try {

    const booking = await RoomBooking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Room booking not found"
      });
    }

    await RoomBooking.deleteOne({ _id: req.params.id });

    res.json({
      success: true,
      message: "Room booking deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting room booking:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete room booking"
    });
  }
});

// Get booking statistics
const getBookingStats = asyncHandler(async (req, res) => {
  try {
    const totalBookings = await RoomBooking.countDocuments();
    const pendingBookings = await RoomBooking.countDocuments({ status: 'pending' });
    const confirmedBookings = await RoomBooking.countDocuments({ status: 'confirmed' });
    const checkedInBookings = await RoomBooking.countDocuments({ status: 'checked-in' });
    const completedBookings = await RoomBooking.countDocuments({ status: 'completed' });
    const cancelledBookings = await RoomBooking.countDocuments({ status: 'cancelled' });

    // Get recent bookings
    const recentBookings = await RoomBooking.find()
      .populate('roomId', 'roomType floor price roomNumber')
      .populate('branchId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      stats: {
        total: totalBookings,
        pending: pendingBookings,
        confirmed: confirmedBookings,
        checkedIn: checkedInBookings,
        completed: completedBookings,
        cancelled: cancelledBookings
      },
      recentBookings: recentBookings
    });

  } catch (error) {
    console.error("Error fetching booking stats:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch booking statistics"
    });
  }
});

// Get room active booking
const getRoomActiveBooking = asyncHandler(async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const activeBooking = await RoomBooking.findOne({
      roomId,
      status: { $in: ['confirmed', 'checked-in'] },
      checkOutDate: { $gte: new Date() }
    }).populate('roomId').populate('branchId', 'name');

    res.status(200).json({
      success: true,
      booking: activeBooking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get room booked time slots
const getRoomBookedTimeSlots = asyncHandler(async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date parameter is required"
      });
    }

    // Parse the date and create start/end of day
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find all bookings for this room that overlap with the target date
    const bookings = await RoomBooking.find({
      roomId,
      status: { $nin: ['cancelled', 'checked-out'] },
      $or: [
        // Booking starts on this date
        { checkInDate: { $gte: startOfDay, $lte: endOfDay } },
        // Booking ends on this date
        { checkOutDate: { $gte: startOfDay, $lte: endOfDay } },
        // Booking spans across this date
        { checkInDate: { $lt: startOfDay }, checkOutDate: { $gt: endOfDay } }
      ]
    });

    const timeSlots = bookings.map(booking => ({
      checkIn: booking.checkInDate,
      checkOut: booking.checkOutDate,
      checkInTime: booking.checkInTime,
      checkOutTime: booking.checkOutTime,
      guestName: booking.guestName
    }));

    res.status(200).json({
      success: true,
      roomId,
      date,
      timeSlots
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update booking status
const updateBookingStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await RoomBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const oldStatus = booking.status;
    const updateData = { status };

    // Capture actual check-in/check-out times when status changes
    if (status === 'checked-in' && oldStatus !== 'checked-in') {
      updateData.actualCheckInTime = new Date();
    } else if (status === 'checked-out' && oldStatus !== 'checked-out') {
      updateData.actualCheckOutTime = new Date();
    }

    // Ensure required fields are not null/undefined during update
    if (!booking.baseAmount || booking.baseAmount === 0) {
      updateData.baseAmount = booking.totalAmount || 0;
    }
    if (!booking.totalPrice || booking.totalPrice === 0) {
      updateData.totalPrice = booking.totalAmount || 0;
    }

    const updatedBooking = await RoomBooking.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true,
        runValidators: false // Skip validation for status-only updates
      }
    ).populate('roomId').populate('branchId', 'name');

    res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
      booking: updatedBooking
    });
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update payment
const updatePayment = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      amount, 
      method, 
      note, 
      amountPaid, 
      paymentMethod, 
      paymentAmount 
    } = req.body;

    const booking = await RoomBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Handle both old and new request formats
    const finalAmount = paymentAmount || amount;
    const finalMethod = paymentMethod || method;
    const finalNote = note || '';

    if (!finalAmount || !finalMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment amount and method are required"
      });
    }

    const paymentData = {
      amount: Number(finalAmount),
      method: finalMethod,
      date: new Date(),
      note: finalNote
    };

    // Determine how to handle the payment
    let newAmountPaid;
    
    if (amountPaid !== undefined) {
      // If amountPaid is provided, use it as the total amount paid (not additive)
      newAmountPaid = Number(amountPaid);
    } else {
      // If only paymentAmount is provided, add it to existing amount paid
      newAmountPaid = (booking.amountPaid || 0) + Number(finalAmount);
    }

    // Update payment amounts based on method
    if (finalMethod === 'cash') {
      booking.cashAmount = (booking.cashAmount || 0) + Number(finalAmount);
    } else if (finalMethod === 'online') {
      booking.onlineAmount = (booking.onlineAmount || 0) + Number(finalAmount);
    }

    // Add to payments array
    if (!booking.payments) {
      booking.payments = [];
    }
    booking.payments.push(paymentData);
    
    // Set the total amount paid
    booking.amountPaid = newAmountPaid;
    
    // Update payment status based on amount paid
    if (booking.amountPaid >= booking.totalAmount) {
      booking.paymentStatus = 'paid';
    } else if (booking.amountPaid > 0) {
      booking.paymentStatus = 'partial';
    } else {
      booking.paymentStatus = 'pending';
    }

    await booking.save();

    res.status(200).json({
      success: true,
      message: "Payment updated successfully",
      booking
    });
  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Cancel booking
const cancelBooking = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, cancellationCharges, refundAmount } = req.body;

    const booking = await RoomBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    await booking.cancelBooking(reason, cancellationCharges, refundAmount);

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Request cancellation
const requestCancellation = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await RoomBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    if (booking.status === 'cancelled' || booking.status === 'cancel-requested') {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled or cancellation is pending"
      });
    }

    await booking.requestCancellation(reason);

    res.status(200).json({
      success: true,
      message: "Cancellation request submitted successfully",
      booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Approve cancellation
const approveCancellation = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationCharges, refundAmount } = req.body;

    const booking = await RoomBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    if (booking.status !== 'cancel-requested') {
      return res.status(400).json({
        success: false,
        message: "No cancellation request found for this booking"
      });
    }

    await booking.cancelBooking(booking.cancellationReason, cancellationCharges, refundAmount);

    res.status(200).json({
      success: true,
      message: "Cancellation approved successfully",
      booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get cancellation requests
const getCancellationRequests = asyncHandler(async (req, res) => {
  try {
    const cancellationRequests = await RoomBooking.find({
      status: 'cancel-requested'
    }).populate('roomId').populate('branchId', 'name');

    res.status(200).json({
      success: true,
      requests: cancellationRequests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get payment summary
const getPaymentSummary = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;
    
    const filter = {};
    
    // Date filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    
    if (branchId) filter.branchId = branchId;

    const bookings = await RoomBooking.find(filter)
      .populate('roomId', 'roomNumber roomType')
      .populate('branchId', 'name')
      .sort({ createdAt: -1 });

    // Calculate totals
    let totalCash = 0;
    let totalOnline = 0;
    let totalAmount = 0;
    let totalPending = 0;
    let restaurantRevenue = 0;

    bookings.forEach(booking => {
      totalCash += booking.cashAmount || 0;
      totalOnline += booking.onlineAmount || 0;
      totalAmount += booking.amountPaid || 0;
      restaurantRevenue += booking.restaurantTotal || 0;
      
      if (booking.paymentStatus === 'pending' || booking.paymentStatus === 'partial') {
        totalPending += (booking.totalAmount || 0) - (booking.amountPaid || 0);
      }
    });

    res.json({
      success: true,
      summary: {
        totalCash,
        totalOnline,
        totalCollected: totalAmount,
        totalPending,
        restaurantRevenue,
        bookingCount: bookings.length
      },
      bookings: bookings.map(b => ({
        _id: b._id,
        roomNumber: b.roomId?.roomNumber || 'N/A',
        roomType: b.roomId?.roomType || 'N/A',
        branchName: b.branchId?.name || 'N/A',
        guestName: b.guestName,
        checkInDate: b.checkInDate,
        checkOutDate: b.checkOutDate,
        totalAmount: b.totalAmount,
        amountPaid: b.amountPaid,
        cashAmount: b.cashAmount || 0,
        onlineAmount: b.onlineAmount || 0,
        restaurantTotal: b.restaurantTotal || 0,
        paymentStatus: b.paymentStatus,
        status: b.status,
        payments: b.payments || [],
        createdAt: b.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Add restaurant bill
const addRestaurantBill = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, addedBy } = req.body;

    const booking = await RoomBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0"
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Description is required"
      });
    }

    const billData = {
      amount: parseFloat(amount),
      description: description.trim(),
      addedBy: addedBy || 'Receptionist'
    };

    await booking.addRestaurantBill(billData);

    res.status(200).json({
      success: true,
      message: "Restaurant bill added successfully",
      booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Remove restaurant bill
const removeRestaurantBill = asyncHandler(async (req, res) => {
  try {
    const { id, billId } = req.params;

    const booking = await RoomBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const billIndex = booking.restaurantBills.findIndex(bill => bill._id.toString() === billId);
    if (billIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Restaurant bill not found"
      });
    }

    const removedBill = booking.restaurantBills[billIndex];
    booking.restaurantBills.splice(billIndex, 1);
    booking.restaurantTotal -= removedBill.amount;
    
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Restaurant bill removed successfully",
      booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Extend booking
const extendBooking = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { newCheckOutDate, additionalAmount } = req.body;

    const booking = await RoomBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    if (!newCheckOutDate || !additionalAmount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: newCheckOutDate, additionalAmount"
      });
    }

    // Validate new check-out date is after current check-out date
    const currentCheckOut = new Date(booking.checkOutDate);
    const newCheckOut = new Date(newCheckOutDate);
    
    if (newCheckOut <= currentCheckOut) {
      return res.status(400).json({
        success: false,
        message: "New check-out date must be after current check-out date"
      });
    }

    // Check if room is available for the extended period
    const conflictingBookings = await RoomBooking.find({
      roomId: booking.roomId,
      _id: { $ne: booking._id },
      status: { $nin: ['cancelled', 'checked-out'] },
      checkInDate: { $lt: newCheckOut },
      checkOutDate: { $gt: currentCheckOut }
    });

    if (conflictingBookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Room is already booked for the extended period"
      });
    }

    await booking.extendBooking(newCheckOut, additionalAmount);

    res.status(200).json({
      success: true,
      message: "Booking extended successfully",
      booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Cancel extension
const cancelExtension = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { extensionId, daysToCancel } = req.body;

    const booking = await RoomBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    if (!booking.extensions || booking.extensions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No extensions found for this booking"
      });
    }

    let extensionIndex = -1;
    let extension = null;

    if (extensionId) {
      // Find extension by ID
      extensionIndex = booking.extensions.findIndex(ext => ext._id.toString() === extensionId);
      if (extensionIndex !== -1) {
        extension = booking.extensions[extensionIndex];
      }
    } else if (daysToCancel) {
      // Find extension by days to cancel (from the most recent extensions)
      // Sort extensions by date (most recent first) and find one that matches the days
      const sortedExtensions = booking.extensions
        .map((ext, index) => ({ ...ext.toObject(), originalIndex: index }))
        .sort((a, b) => new Date(b.extendedAt) - new Date(a.extendedAt));

      for (let ext of sortedExtensions) {
        if (ext.additionalNights === parseInt(daysToCancel)) {
          extensionIndex = ext.originalIndex;
          extension = booking.extensions[extensionIndex];
          break;
        }
      }

      // If no exact match, take the most recent extension
      if (extensionIndex === -1 && sortedExtensions.length > 0) {
        extensionIndex = sortedExtensions[0].originalIndex;
        extension = booking.extensions[extensionIndex];
      }
    }

    if (extensionIndex === -1 || !extension) {
      return res.status(404).json({
        success: false,
        message: "Extension not found"
      });
    }

    // Revert the extension
    booking.checkOutDate = extension.previousCheckOutDate;
    booking.totalAmount -= extension.additionalAmount;
    booking.totalPrice = booking.totalAmount;
    booking.extensions.splice(extensionIndex, 1);
    
    // Recalculate nights
    const timeDiff = booking.checkOutDate.getTime() - booking.checkInDate.getTime();
    booking.nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Extension cancelled successfully",
      booking,
      cancelledExtension: extension
    });
  } catch (error) {
    console.error("Error cancelling extension:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Upload documents (Aadhaar, Visa)
const uploadDocuments = asyncHandler(async (req, res) => {
  try {


    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded"
      });
    }

    const uploadedFiles = {};
    
    // Process aadhaarPic if uploaded
    if (req.files.aadhaarPic && req.files.aadhaarPic[0]) {
      uploadedFiles.aadhaarPic = `/uploads/documents/${req.files.aadhaarPic[0].filename}`;
    }
    
    // Process visaPic if uploaded
    if (req.files.visaPic && req.files.visaPic[0]) {
      uploadedFiles.visaPic = `/uploads/documents/${req.files.visaPic[0].filename}`;
    }

    res.status(200).json({
      success: true,
      message: "Files uploaded successfully",
      files: uploadedFiles
    });
  } catch (error) {
    console.error("Error uploading documents:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload documents"
    });
  }
});

module.exports = {
  createBooking: createRoomBooking, // Alias for createRoomBooking
  createRoomBooking,
  createWalkInBooking,
  uploadDocuments,
  getBookings: getRoomBookings, // Alias for getRoomBookings
  getRoomBookings,
  getBookingById: getRoomBookingById, // Alias for getRoomBookingById
  getRoomBookingById,
  updateRoomBooking,
  deleteRoomBooking,
  getBookingStats,
  getRoomActiveBooking,
  getRoomBookedTimeSlots,
  updateBookingStatus,
  updatePayment,
  cancelBooking,
  requestCancellation,
  approveCancellation,
  getCancellationRequests,
  getPaymentSummary,
  addRestaurantBill,
  removeRestaurantBill,
  extendBooking,
  cancelExtension,
};