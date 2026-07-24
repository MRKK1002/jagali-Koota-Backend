const Reservation = require("../model/Reservation")
const Table = require("../model/Table")
const Customer = require("../model/customerModel")
 

const createReservation = async (req, res) => {
  try {

    const {
      tableId,
      branchId: providedBranchId,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      guestCount,
      reservationDate,
      timeSlot,
      status,
      notes,
    } = req.body

    if (!tableId || !customerName || !customerPhone || !guestCount || !reservationDate || !timeSlot) {
      return res.status(400).json({ error: "Required fields are missing" })
    }

    
    const table = await Table.findById(tableId).populate('branchId')
    if (!table) {
      return res.status(404).json({ error: "Table not found" })
    }

    // Get branchId from table if not provided or if mismatch
    const tableBranchId = table.branchId._id || table.branchId
    let branchId = providedBranchId || tableBranchId.toString()
    
    if (providedBranchId && providedBranchId !== tableBranchId.toString()) {
      // Use the table's branchId instead
      branchId = tableBranchId.toString()
    }

    // Create or find customer
    let customer
    if (customerId) {
      customer = await Customer.findById(customerId)
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" })
      }
    } else {
      // Create new customer
      customer = new Customer({
        name: customerName,
        mobileNumber: customerPhone,
        email: customerEmail || "",
      })
      await customer.save()
    }

    // Create reservation
    const reservation = new Reservation({
      tableId,
      branchId,
      customerId: customer._id,
      customerName,
      customerPhone,
      customerEmail: customerEmail || "",
      guestCount,
      reservationDate: new Date(reservationDate),
      timeSlot,
      status: status || "reserved",
      notes: notes || "",
    })

    const createdReservation = await reservation.save()

    // Update table status to reserved
    await Table.findByIdAndUpdate(tableId, { status: "reserved" })

    // Populate the response
    const populatedReservation = await Reservation.findById(createdReservation._id)
      .populate({
        path: "tableId",
        select: "number branchId",
        populate: {
          path: "branchId",
          select: "name address"
        }
      })
      .populate("branchId", "name address")
      .populate("customerId", "name mobileNumber email")

    res.status(201).json(populatedReservation)
  } catch (err) {
    console.error("Error creating reservation:", err)
    res.status(500).json({ error: err.message })
  }
}

// Get all reservations with pagination
const getReservations = async (req, res) => {
  try {

    const { tableId, customerId, status, date, page = 1, limit = 10 } = req.query

    const query = {}

    if (tableId) query.tableId = tableId
    if (customerId) query.customerId = customerId
    if (status) query.status = status
    if (date) {
      const startDate = new Date(date)
      const endDate = new Date(date)
      endDate.setDate(endDate.getDate() + 1)
      query.reservationDate = { $gte: startDate, $lt: endDate }
    }

    // Convert page and limit to numbers
    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    // Get total count for pagination
    const totalCount = await Reservation.countDocuments(query)

    // Fetch paginated reservations
    const reservations = await Reservation.find(query)
      .populate({
        path: "tableId",
        select: "number branchId",
        populate: {
          path: "branchId",
          select: "name address"
        }
      })
      .populate("branchId", "name address")
      .populate("customerId", "name mobileNumber email")
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .skip(skip)
      .limit(limitNum)

    // Fix reservations that don't have branchId set
    const fixedReservations = []
    for (const reservation of reservations) {
      let reservationObj = reservation.toObject()
      
      // If reservation doesn't have branchId but table has branchId, update it
      if (!reservationObj.branchId && reservationObj.tableId && reservationObj.tableId.branchId) {
        
        // Update the reservation in database
        await Reservation.findByIdAndUpdate(reservationObj._id, {
          branchId: reservationObj.tableId.branchId._id || reservationObj.tableId.branchId
        })
        
        // Update the object for response
        reservationObj.branchId = reservationObj.tableId.branchId
      }
      
      fixedReservations.push(reservationObj)
    }


    // Return paginated response
    res.json({
      success: true,
      data: fixedReservations,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount: totalCount,
        limit: limitNum,
        hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
        hasPrevPage: pageNum > 1
      }
    })
  } catch (err) {
    console.error("Error fetching reservations:", err)
    res.status(500).json({ error: err.message })
  }
}

// Get reservation by ID
const getReservationById = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate({
        path: "tableId",
        select: "number branchId",
        populate: {
          path: "branchId",
          select: "name address"
        }
      })
      .populate("branchId", "name address")
      .populate("customerId", "name mobileNumber email")

    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" })
    }

    res.json(reservation)
  } catch (err) {
    console.error("Error fetching reservation:", err)
    res.status(500).json({ error: err.message })
  }
}

// Update reservation
const updateReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)

    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" })
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate({
        path: "tableId",
        select: "number branchId",
        populate: {
          path: "branchId",
          select: "name address"
        }
      })
      .populate("branchId", "name address")
      .populate("customerId", "name mobileNumber email")

    res.json(updatedReservation)
  } catch (err) {
    console.error("Error updating reservation:", err)
    res.status(500).json({ error: err.message })
  }
}

// Delete reservation
const deleteReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)

    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" })
    }

    // Check if there are other active reservations for this table
    const otherReservations = await Reservation.find({
      tableId: reservation.tableId,
      _id: { $ne: req.params.id },
      status: { $in: ["reserved", "confirmed"] },
    })

    // Update table status back to available if no other active reservations
    if (otherReservations.length === 0) {
      await Table.findByIdAndUpdate(reservation.tableId, { status: "available" })
    }

    await Reservation.findByIdAndDelete(req.params.id)

    res.json({ message: "Reservation deleted successfully" })
  } catch (err) {
    console.error("Error deleting reservation:", err)
    res.status(500).json({ error: err.message })
  }
}

// Cancel reservation
const cancelReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)

    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" })
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status: "cancelled" },
      { new: true },
    )
      .populate({
        path: "tableId",
        select: "number branchId",
        populate: {
          path: "branchId",
          select: "name address"
        }
      })
      .populate("customerId", "name mobileNumber email")

    // Check if there are other active reservations for this table
    const activeReservations = await Reservation.find({
      tableId: reservation.tableId,
      status: { $in: ["reserved", "confirmed"] },
    })

    // Update table status back to available if no active reservations
    if (activeReservations.length === 0) {
      await Table.findByIdAndUpdate(reservation.tableId, { status: "available" })
    }

    res.json(updatedReservation)
  } catch (err) {
    console.error("Error cancelling reservation:", err)
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  createReservation,
  getReservations,
  getReservationById,
  updateReservation,
  deleteReservation,
  cancelReservation,
}