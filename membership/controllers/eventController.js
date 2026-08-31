const asyncHandler = require("express-async-handler");
const Event = require("../models/Event");
const EventBooking = require("../models/EventBooking");
const WalletTransaction = require("../models/WalletTransaction");
const Member = require("../models/Member");
const { uploadFile2 } = require("../../middleware/AWS");

// Number of days before event that cancellation is blocked
const CANCEL_CUTOFF_DAYS = 2;

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

  // 🔔 Broadcast notification to all members about new event
  try {
    const Member = require("../models/Member");
    const {sendToMultiple} = require("../../services/firebaseNotification");
    Member.find({fcmToken: {$ne: null, $exists: true}}).select("fcmToken").lean().then(members => {
      const tokens = members.map(m => m.fcmToken).filter(Boolean);
      console.log("[FCM] Broadcasting new event to", tokens.length, "members");
      if (tokens.length > 0) {
        sendToMultiple(
          tokens,
          "New Event!",
          `${event.title} — ${new Date(event.eventDate).toLocaleDateString("en-IN", {day: "numeric", month: "short"})}. Book your spot now!`,
          {type: "new_event", eventId: String(event._id)}
        ).catch(e => console.warn("[FCM] Broadcast error:", e.message));
      }
    }).catch(e => console.warn("[FCM] Member query error:", e.message));
  } catch (fcmErr) { console.warn("[FCM] Event notification error:", fcmErr.message); }
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
  
  const { numberOfPeople, notes, paymentMethod, guests } = req.body;

  if (!numberOfPeople || numberOfPeople < 1) {
    res.status(400);
    throw new Error("Please provide valid number of people");
  }

  // Validate guests array if provided
  if (guests && Array.isArray(guests)) {
    for (const g of guests) {
      if (!g.name || !g.name.trim()) {
        res.status(400);
        throw new Error("Each guest must have a name");
      }
      if (!g.age || g.age < 1) {
        res.status(400);
        throw new Error("Each guest must have a valid age");
      }
    }
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
  const useWallet = paymentMethod === "wallet";
  let walletDeducted = false;

  // Wallet deduction
  if (useWallet && totalAmount > 0) {
    const member = await Member.findById(req.member._id);
    if (!member) {
      res.status(404);
      throw new Error("Member not found");
    }
    if (member.walletBalance < totalAmount) {
      res.status(400);
      throw new Error(
        `Insufficient wallet balance. Available: ₹${member.walletBalance}, Required: ₹${totalAmount}`
      );
    }
    await WalletTransaction.createTransaction({
      memberId: member._id,
      type: "debit",
      amount: totalAmount,
      description: `Event booking: ${event.title}`,
      createdBy: "member",
    });
    walletDeducted = true;
  }

  // Create booking
  const booking = await EventBooking.create({
    eventId: event._id,
    memberId: req.member._id,
    memberName: req.member.name || "Member",
    memberEmail: req.member.email || "",
    memberPhone: req.member.phone || req.member.mobile || "",
    numberOfPeople,
    guests: guests && Array.isArray(guests) ? guests : [],
    pricePerPerson: event.pricePerPerson,
    totalAmount,
    paymentMethod: useWallet ? "wallet" : (paymentMethod || "other"),
    paymentStatus: useWallet ? "paid" : "pending",
    walletDeducted,
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

  // 🔔 Notify member about booking confirmation
  try {
    const {sendToMember} = require("../../services/firebaseNotification");
    const eventTitle = event.title || "Event";
    sendToMember(
      req.member._id,
      "Booking Confirmed!",
      `Your booking for "${eventTitle}" is confirmed. See you there!`,
      {type: "event_booking", bookingId: String(booking._id), eventId: String(event._id)}
    ).then(() => console.log("[FCM] Booking confirmation sent")).catch(e => console.warn("[FCM] Booking notification error:", e.message));
  } catch (fcmErr) { console.warn("[FCM] Booking notification error:", fcmErr.message); }

  // 🔔 Notify admin panel via Socket.IO
  try {
    const io = req.app.get('io');
    if (io) {
      io.emit('new-event-booking', {
        id: booking._id,
        eventTitle: event.title,
        eventDate: event.eventDate,
        memberName: req.member.name || 'Member',
        memberPhone: req.member.phone || '',
        numberOfPeople,
        totalAmount,
        createdAt: new Date().toISOString(),
      });
      console.log('🔔 Emitting new-event-booking event via Socket.IO');
    }
  } catch (socketErr) { /* non-blocking */ }

  // 📧 Email confirmation for event booking
  try {
    if (req.member.email) {
      const { sendConfirmationEmail } = require("../../services/emailService");
      sendConfirmationEmail(req.member.email, {
        name: req.member.name,
        title: "Event Booking Confirmed!",
        subtitle: `You've booked "${event.title}"`,
        rows: [
          { label: "Event", value: event.title },
          { label: "Date", value: event.eventDate ? new Date(event.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "TBA" },
          { label: "Time", value: event.eventTime || "TBA" },
          { label: "Location", value: event.location || "Jagali Koota" },
          { label: "Guests", value: String(numberOfPeople) },
        ],
        amount: totalAmount,
        note: "See you at the event! You can view your booking in the Member App.",
      }).catch((e) => console.warn("[Event Email] Failed:", e.message));
    }
  } catch (_) {}
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

  const booking = await EventBooking.findById(req.params.id).populate("eventId");

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

  // 2-day cancellation cutoff
  const event = booking.eventId; // populated
  if (event) {
    const eventDate = new Date(event.eventDate);
    const cutoff = new Date(eventDate);
    cutoff.setDate(cutoff.getDate() - CANCEL_CUTOFF_DAYS);
    if (new Date() >= cutoff) {
      res.status(400);
      throw new Error(
        `Cancellations are not allowed within ${CANCEL_CUTOFF_DAYS} days of the event`
      );
    }
  }

  // Wallet refund if originally deducted
  let refunded = false;
  if (booking.walletDeducted && booking.totalAmount > 0) {
    await WalletTransaction.createTransaction({
      memberId: booking.memberId,
      type: "credit",
      amount: booking.totalAmount,
      description: `Refund: cancelled event booking — ${event?.title || "Event"}`,
      createdBy: "system",
    });
    booking.paymentStatus = "refunded";
    refunded = true;
  }

  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  booking.cancelReason = cancelReason || "";
  await booking.save();

  // Update event total booked
  if (event && event.save) {
    event.totalBooked = Math.max(0, event.totalBooked - booking.numberOfPeople);
    await event.save();
  }

  res.json({
    success: true,
    message: refunded
      ? `Booking cancelled and ₹${booking.totalAmount} refunded to your wallet`
      : "Booking cancelled successfully",
    refunded,
    refundAmount: refunded ? booking.totalAmount : 0,
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

// @desc    Add more seats to an existing confirmed booking
// @route   PUT /api/v1/hotel/events/bookings/:id/add-seats
// @access  Private/Member
const addSeatsToBooking = asyncHandler(async (req, res) => {
  const { extraPeople, paymentMethod, notes } = req.body;

  const extra = parseInt(extraPeople);
  if (!extra || extra < 1) {
    res.status(400);
    throw new Error("Please provide a valid number of extra seats");
  }

  const booking = await EventBooking.findById(req.params.id).populate("eventId");

  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }

  if (booking.memberId.toString() !== req.member._id.toString()) {
    res.status(403);
    throw new Error("Not authorized");
  }

  if (booking.status !== "confirmed") {
    res.status(400);
    throw new Error("Can only add seats to a confirmed booking");
  }

  const event = booking.eventId;

  // Check available seats
  if (event.maxBookings) {
    const available = event.maxBookings - event.totalBooked;
    if (extra > available) {
      res.status(400);
      throw new Error(`Only ${available} seat(s) remaining`);
    }
  }

  const extraAmount = event.pricePerPerson * extra;
  const useWallet = paymentMethod === "wallet";

  // Wallet deduction for extra seats
  if (useWallet && extraAmount > 0) {
    const member = await Member.findById(req.member._id);
    if (!member) {
      res.status(404);
      throw new Error("Member not found");
    }
    if (member.walletBalance < extraAmount) {
      res.status(400);
      throw new Error(
        `Insufficient wallet balance. Available: ₹${member.walletBalance}, Required: ₹${extraAmount}`
      );
    }
    await WalletTransaction.createTransaction({
      memberId: member._id,
      type: "debit",
      amount: extraAmount,
      description: `Extra seats for event: ${event.title}`,
      createdBy: "member",
    });
    // Mark wallet deducted (already true or now true)
    booking.walletDeducted = true;
  }

  // Update booking
  booking.numberOfPeople += extra;
  booking.totalAmount += extraAmount;
  if (notes) booking.notes = (booking.notes ? booking.notes + "; " : "") + notes;
  await booking.save();

  // Update event seat count
  event.totalBooked += extra;
  await event.save();

  res.json({
    success: true,
    message: `${extra} seat(s) added successfully`,
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
  addSeatsToBooking,
  getEventBookings,
  getAllBookings,
  updateBookingStatus,
};
 
