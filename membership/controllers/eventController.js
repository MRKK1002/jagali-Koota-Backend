const asyncHandler = require("express-async-handler");
const Event = require("../models/Event");
const EventBooking = require("../models/EventBooking");
const { uploadFile2 } = require("../../middleware/AWS");

// @desc    Create event (Admin only)
// @route   POST /api/v1/hotel/events/create
// @access  Private/Admin
const createEvent = asyncHandler(async (req, res) => {
  const { 
    title, 
    description, 
    eventDate, 
    eventTime, 
    location, 
    branchId, 
    isPinned,
    bookingEnabled,
    pricePerPerson,
    maxBookings
  } = req.body;

  if (!title || !description || !eventDate || !eventTime) {
    res.status(400);
    throw new Error("Please provide title, description, eventDate, and eventTime");
  }

  // Handle multiple image uploads - save to local /uploads folder
  let images = [];
  if (req.files && req.files.length > 0) {
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '../../uploads/events');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    for (const file of req.files) {
      try {
        const fileName = `${Date.now()}-${file.originalname}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, file.buffer);
        
        // Store as /uploads/events/filename.jpg
        images.push(`/uploads/events/${fileName}`);
      } catch (error) {
        console.error('Error saving image:', error);
      }
    }
  }

  const event = await Event.create({
    title,
    description,
    images,
    eventDate,
    eventTime,
    location,
    branchId,
    isPinned: isPinned || false,
    bookingEnabled: bookingEnabled || false,
    pricePerPerson: pricePerPerson || 0,
    maxBookings: maxBookings || null,
    createdBy: req.admin?.id || req.user?.id,
  });

  res.status(201).json({
    success: true,
    message: "Event created successfully",
    event,
  });
});

// @desc    Get all events
// @route   GET /api/v1/hotel/events/all
// @access  Public
const getAllEvents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, upcoming, past } = req.query;

  const query = { isActive: true };

  // Filter upcoming or past events
  if (upcoming === "true") {
    query.eventDate = { $gte: new Date() };
  } else if (past === "true") {
    query.eventDate = { $lt: new Date() };
  }

  const events = await Event.find(query)
    .sort({ isPinned: -1, eventDate: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate("branchId", "name address")
    .populate("createdBy", "name email");

  const count = await Event.countDocuments(query);

  res.json({
    success: true,
    events,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    total: count,
  });
});

// @desc    Get single event by ID
// @route   GET /api/v1/hotel/events/:id
// @access  Public
const getEventById = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id)
    .populate("branchId", "name address contact")
    .populate("createdBy", "name email");

  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  res.json({
    success: true,
    event,
  });
});

// @desc    Update event (Admin only)
// @route   PUT /api/v1/hotel/events/:id
// @access  Private/Admin
const updateEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  const {
    title,
    description,
    eventDate,
    eventTime,
    location,
    branchId,
    isActive,
    isPinned,
    bookingEnabled,
    pricePerPerson,
    maxBookings,
  } = req.body;

  // Update fields
  if (title) event.title = title;
  if (description) event.description = description;
  if (eventDate) event.eventDate = eventDate;
  if (eventTime) event.eventTime = eventTime;
  if (location) event.location = location;
  if (branchId) event.branchId = branchId;
  if (isActive !== undefined) event.isActive = isActive;
  if (isPinned !== undefined) event.isPinned = isPinned;
  
  // Update booking fields
  if (bookingEnabled !== undefined) event.bookingEnabled = bookingEnabled;
  if (pricePerPerson !== undefined) event.pricePerPerson = pricePerPerson;
  if (maxBookings !== undefined) event.maxBookings = maxBookings;

  // Handle image uploads if new images provided
  if (req.files && req.files.length > 0) {
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '../../uploads/events');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const newImages = [];
    for (const file of req.files) {
      try {
        const fileName = `${Date.now()}-${file.originalname}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, file.buffer);
        
        newImages.push(`/uploads/events/${fileName}`);
      } catch (error) {
        console.error('Error saving image:', error);
      }
    }
    event.images = [...event.images, ...newImages];
  }

  const updatedEvent = await event.save();

  res.json({
    success: true,
    message: "Event updated successfully",
    event: updatedEvent,
  });
});

// @desc    Delete event (Admin only)
// @route   DELETE /api/v1/hotel/events/:id
// @access  Private/Admin
const deleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  // Soft delete
  event.isActive = false;
  await event.save();

  res.json({
    success: true,
    message: "Event deleted successfully",
  });
});

// @desc    Remove event image (Admin only)
// @route   DELETE /api/v1/hotel/events/:id/image
// @access  Private/Admin
const removeEventImage = asyncHandler(async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    res.status(400);
    throw new Error("Please provide imageUrl to remove");
  }

  const event = await Event.findById(req.params.id);

  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  event.images = event.images.filter((img) => img !== imageUrl);
  await event.save();

  res.json({
    success: true,
    message: "Image removed successfully",
    event,
  });
});

module.exports = {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  removeEventImage,
};


// ========== EVENT BOOKING FUNCTIONS ==========

// @desc    Book an event (Member)
// @route   POST /api/v1/hotel/events/:id/book
// @access  Private/Member
const bookEvent = asyncHandler(async (req, res) => {
  console.log('=== BOOK EVENT REQUEST ===');
  console.log('Event ID:', req.params.id);
  console.log('Request body:', req.body);
  console.log('Member:', req.member?._id, req.member?.name);
  
  const { numberOfPeople, notes } = req.body;

  if (!numberOfPeople || numberOfPeople < 1) {
    res.status(400);
    throw new Error("Please provide valid number of people");
  }

  const event = await Event.findById(req.params.id);

  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  console.log('Event found:', event.title, 'Booking enabled:', event.bookingEnabled);

  if (!event.bookingEnabled) {
    res.status(400);
    throw new Error("Booking is not enabled for this event");
  }

  // Check if event is in the past
  if (new Date(event.eventDate) < new Date()) {
    res.status(400);
    throw new Error("Cannot book past events");
  }

  // Check available seats
  if (event.maxBookings) {
    const availableSeats = event.maxBookings - event.totalBooked;
    if (numberOfPeople > availableSeats) {
      res.status(400);
      throw new Error(`Only ${availableSeats} seats available`);
    }
  }

  // Check if user already booked
  const existingBooking = await EventBooking.findOne({
    eventId: event._id,
    memberId: req.member._id,
    status: { $in: ["confirmed", "attended"] },
  });

  if (existingBooking) {
    res.status(400);
    throw new Error("You have already booked this event");
  }

  const totalAmount = event.pricePerPerson * numberOfPeople;

  // Create booking
  const booking = await EventBooking.create({
    eventId: event._id,
    memberId: req.member._id,
    memberName: req.member.name || "Member",
    memberEmail: req.member.email || "",
    memberPhone: req.member.phone || req.member.mobile || "",
    numberOfPeople,
    pricePerPerson: event.pricePerPerson,
    totalAmount,
    notes: notes || "",
  });

  // Update event total booked
  event.totalBooked += numberOfPeople;
  await event.save();

  console.log('Booking created successfully:', booking._id);

  res.status(201).json({
    success: true,
    message: "Event booked successfully",
    booking,
  });
});

// @desc    Get member's event bookings
// @route   GET /api/v1/hotel/events/my-bookings
// @access  Private/Member
const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await EventBooking.find({ memberId: req.member._id })
    .populate("eventId", "title description eventDate eventTime location images")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    bookings,
  });
});

// @desc    Cancel event booking (Member)
// @route   PUT /api/v1/hotel/events/bookings/:id/cancel
// @access  Private/Member
const cancelBooking = asyncHandler(async (req, res) => {
  const { cancelReason } = req.body;

  const booking = await EventBooking.findById(req.params.id);

  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }

  if (booking.memberId.toString() !== req.member._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to cancel this booking");
  }

  if (booking.status === "cancelled") {
    res.status(400);
    throw new Error("Booking already cancelled");
  }

  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  booking.cancelReason = cancelReason || "";
  await booking.save();

  // Update event total booked
  const event = await Event.findById(booking.eventId);
  if (event) {
    event.totalBooked = Math.max(0, event.totalBooked - booking.numberOfPeople);
    await event.save();
  }

  res.json({
    success: true,
    message: "Booking cancelled successfully",
    booking,
  });
});

// @desc    Get all bookings for an event (Admin)
// @route   GET /api/v1/hotel/events/:id/bookings
// @access  Private/Admin
const getEventBookings = asyncHandler(async (req, res) => {
  const bookings = await EventBooking.find({ eventId: req.params.id })
    .populate("memberId", "name email phone mobile")
    .sort({ createdAt: -1 });

  const event = await Event.findById(req.params.id);

  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  res.json({
    success: true,
    event: {
      title: event.title,
      eventDate: event.eventDate,
      pricePerPerson: event.pricePerPerson,
      totalBooked: event.totalBooked,
      maxBookings: event.maxBookings,
    },
    bookings,
  });
});

// @desc    Get all event bookings (Admin)
// @route   GET /api/v1/hotel/events/bookings/all
// @access  Private/Admin
const getAllBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, eventId } = req.query;

  const query = {};
  if (status) query.status = status;
  if (eventId) query.eventId = eventId;

  const bookings = await EventBooking.find(query)
    .populate("eventId", "title eventDate eventTime location")
    .populate("memberId", "name email phone mobile")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const count = await EventBooking.countDocuments(query);

  res.json({
    success: true,
    bookings,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    total: count,
  });
});

// @desc    Update booking status (Admin)
// @route   PUT /api/v1/hotel/events/bookings/:id/status
// @access  Private/Admin
const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status, adminNotes, paymentStatus, paymentMethod } = req.body;

  const booking = await EventBooking.findById(req.params.id);

  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }

  if (status) booking.status = status;
  if (adminNotes !== undefined) booking.adminNotes = adminNotes;
  if (paymentStatus) booking.paymentStatus = paymentStatus;
  if (paymentMethod) booking.paymentMethod = paymentMethod;

  await booking.save();

  res.json({
    success: true,
    message: "Booking updated successfully",
    booking,
  });
});

module.exports = {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  removeEventImage,
  bookEvent,
  getMyBookings,
  cancelBooking,
  getEventBookings,
  getAllBookings,
  updateBookingStatus,
};
