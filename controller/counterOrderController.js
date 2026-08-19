const CounterOrder = require("../model/counterOrderModel")
const Branch = require("../model/Branch")
const CounterInvoice = require("../model/counterInvoiceModel")
const Menu = require("../model/menuModel")
const Counter = require("../model/counterLoginModel")
const asyncHandler = require("express-async-handler")
const Recipe = require("../model/recipe")
const RawMaterial = require("../model/rawMaterialModel")
const BillingSession = require("../model/billingSessionModel")
const NonChargeableTracking = require("../model/nonChargeableTrackingModel")
const { businessDayKey, businessDayRange } = require("../utils/businessDay")

// ─── In-Memory Cache for GET orders (60s TTL) ──────────────────────────────
// Only caches READ responses. Invalidated on any write (create/update/cancel).
const orderCache = new Map()
const CACHE_TTL = 60 * 1000 // 60 seconds

function getCachedResponse(key) {
  const entry = orderCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    orderCache.delete(key)
    return null
  }
  return entry.data
}

function setCachedResponse(key, data) {
  // Limit cache size to prevent memory leaks (max 50 entries)
  if (orderCache.size > 50) {
    const oldest = orderCache.keys().next().value
    orderCache.delete(oldest)
  }
  orderCache.set(key, { data, timestamp: Date.now() })
}

function invalidateOrderCache() {
  orderCache.clear()
}
// ─── End Cache ──────────────────────────────────────────────────────────────

/**
 * Auto-deduct raw material stock based on recipe ingredients.
 * Each menu item can have a Recipe linked via menuItemId.
 * Deducts: ingredient.quantity × orderItem.quantity from RawMaterial.quantity
 * The RawMaterial pre-save hook automatically updates the status field.
 */
async function deductRawMaterialsForOrder(items) {
  for (const item of items) {
    if (!item.menuItemId) continue

    const recipe = await Recipe.findOne({ menuItemId: item.menuItemId })
    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) continue

    for (const ingredient of recipe.ingredients) {
      const deductQty = ingredient.quantity * item.quantity
      if (deductQty <= 0) continue

      try {
        // $inc deducts atomically; Math.max(0) guard in pre-save handles going negative
        await RawMaterial.findOneAndUpdate(
          { _id: ingredient.rawMaterialId },
          { $inc: { quantity: -deductQty } },
          { new: true }
        ).then(async (doc) => {
          if (doc) {
            // Clamp to 0 if went negative and trigger status update via save
            if (doc.quantity < 0) {
              doc.quantity = 0
              await doc.save()
            } else {
              await doc.save() // triggers pre-save status update
            }
          }
        })
      } catch (err) {
        console.error(`[Stock Deduct] Error for rawMaterial ${ingredient.rawMaterialId}:`, err.message)
        // Non-fatal — order is already saved, don't block the response
      }
    }
  }
}

// Tax and service charge rates (same as staff order)
const TAX_RATE = 0.05 // 5%
const SERVICE_CHARGE_RATE = 0.1 // 10%
exports.createCounterOrder = asyncHandler(async (req, res) => {

  
  const {
    userId,
    customerName,
    phoneNumber,
    branchId,
    branchName,
    categoryId,
    categoryName,
    invoiceId,
    items,
    paymentMethod,
    status,
    paymentStatus: reqPaymentStatus,
    orderStatus: reqOrderStatus,
    isComplimentary = false,
    complimentaryReason = null,
    isNonChargeable = false,
    nonChargeableReason = null,
    nonChargeableType = null,
    // Optional: allow frontend to send these, but we'll calculate them
    subtotal: providedSubtotal,
    tax: providedTax,
    serviceCharge: providedServiceCharge,
    totalAmount: providedTotalAmount,
    grandTotal: providedGrandTotal,
    gstAmount: providedGstAmount, // ✅ Accept GST amount from frontend
  } = req.body

  console.log('[createCounterOrder] Incoming bill:', {
    invoiceNumber: req.body.invoiceNumber,
    branchId,
    categoryName,
    categoryId,
    itemCount: items ? items.length : 0,
    paymentMethod,
    totalAmount: providedTotalAmount,
    userId,
  })

  // Validate input — only items and branchId are mandatory; user details are optional
  if (!branchId) {
    res.status(400)
    throw new Error("Branch is required")
  }

  // Make invoiceId optional for KOT orders - they can be created without invoice initially
  // if (!invoiceId) {
  //   res.status(400)
  //   throw new Error("Invoice is required")
  // }

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400)
    throw new Error("Items are required")
  }

  if (paymentMethod && !["cash", "card", "upi", "qr"].includes(paymentMethod)) {
    res.status(400)
    throw new Error("Invalid payment method")
  }

  // Verify counter user exists (optional - allow orders even if user not found)
  let counterUser = null
  try {
    counterUser = await Counter.findById(userId)
    // if (!counterUser) {
    //   console.log(`Counter user ${userId} not found, proceeding with order anyway`)
    // }
  } catch (err) {
    console.log(`Error finding counter user: ${err.message}, proceeding with order anyway`)
  }

  // Verify branch exists — only reject on CastError (bad ObjectId format)
  // Network/connection errors should not block the order save
  let branch = null
  try {
    branch = await Branch.findById(branchId)
  } catch (err) {
    if (err.name === 'CastError') {
      res.status(400)
      throw new Error(`Invalid branchId format: ${branchId}`)
    }
    // Network/DB connection error — log and proceed without branch validation
    console.warn(`[createCounterOrder] Branch lookup failed (DB connection issue): ${err.message} — proceeding anyway`)
    branch = { _id: branchId, name: 'Unknown' } // synthetic branch to pass the null check
  }
  if (!branch) {
    res.status(404)
    throw new Error("Branch not found")
  }

  // ── Idempotency guard ───────────────────────────────────────────────────
  // The offline sync queue retries bill uploads, and its own comment says it
  // "relies solely on the server's 409 duplicate response" to detect repeats.
  // Nothing here ever returned 409, so every retry created another document —
  // invoice 015 ended up with 8 copies, inflating revenue.
  //
  // A bill is uniquely identified by branch + invoiceNumber + business day
  // (invoice numbers legitimately restart at 001 each day, so the day matters).
  // Returning 409 makes the endpoint safe to retry: the queue marks the entry
  // synced instead of duplicating it.
  if (req.body.invoiceNumber) {
    try {
      const { start, end } = businessDayRange(businessDayKey())
      if (start && end) {
        const existing = await CounterOrder.findOne({
          branch: branchId,
          invoiceNumber: req.body.invoiceNumber,
          kotNumber: { $in: [null, undefined, ""] }, // bills only, not KOTs
          createdAt: { $gte: start, $lte: end },
        })
          .select("_id invoiceNumber grandTotal createdAt")
          .lean()

        if (existing) {
          console.log(
            `[createCounterOrder] Duplicate bill ${req.body.invoiceNumber} for this branch/day — returning existing ${existing._id}`
          )
          return res.status(409).json({
            success: false,
            duplicate: true,
            message: `Bill ${req.body.invoiceNumber} already exists for this branch today`,
            order: {
              id: existing._id,
              _id: existing._id,
              invoiceNumber: existing.invoiceNumber,
              grandTotal: existing.grandTotal,
              createdAt: existing.createdAt,
            },
          })
        }
      }
    } catch (dupErr) {
      // A lookup failure must not block billing — log and continue
      console.warn(`[createCounterOrder] Duplicate check skipped: ${dupErr.message}`)
    }
  }

  // ── Billing-session lock ────────────────────────────────────────────────
  // Once a business day is closed (Z-Report frozen), no new bill may be added
  // to it. KOTs are still allowed so the kitchen isn't blocked mid-service —
  // only actual bills (those carrying an invoiceNumber) are refused.
  if (req.body.invoiceNumber) {
    try {
      // Business day, not calendar day — a 1 AM bill belongs to last night
      const todayKey = businessDayKey()
      const session = await BillingSession.findOne({ branchId, date: todayKey })
        .select("status")
        .lean()
      if (session && session.status === "closed") {
        // 423 Locked — deliberately NOT 409, because the offline sync queue
        // treats 409 as "duplicate bill, already saved" and silently marks the
        // entry synced. That would hide this rejection from the cashier.
        res.status(423)
        throw new Error(
          `BILLING_CLOSED: Billing for ${todayKey} is closed. Reopen billing before creating new bills.`
        )
      }
    } catch (err) {
      // Re-throw our own lock error; swallow infrastructure errors so a DB
      // hiccup never blocks billing.
      if (res.statusCode === 423) throw err
      console.warn(`[createCounterOrder] Billing session check skipped: ${err.message}`)
    }
  }

  // Verify invoice exists (optional - allow orders even if invoice not found)
  let invoice = null
  if (invoiceId) {
    try {
      invoice = await CounterInvoice.findById(invoiceId)
      // if (!invoice) {
      //   console.log(`Invoice ${invoiceId} not found, proceeding with order anyway`)
      // }
    } catch (err) {
      console.log(`Error finding invoice: ${err.message}, proceeding with order anyway`)
    }
  } else {
    console.log('No invoiceId provided, creating order without invoice reference')
  }

  // Calculate subtotal and validate items
  let calculatedSubtotal = 0
  for (const item of items) {
    if (!item.name || !item.quantity || item.price === undefined) {
      res.status(400)
      throw new Error("Invalid item data: name, quantity and price are required")
    }

    // menuItemId is optional — if missing or invalid ObjectId, skip DB lookup
    if (item.menuItemId && /^[0-9a-fA-F]{24}$/.test(String(item.menuItemId))) {
      try {
        await Menu.findById(item.menuItemId) // result ignored — price from frontend is used
      } catch (_) {
        // CastError or DB error — ignore, use provided price
      }
    }

    calculatedSubtotal += item.price * item.quantity
  }

  // For counter orders, use provided tax and service charge (allow 0%)
  // If not provided, default to 0 for counter orders
  const finalTax = providedTax !== undefined ? providedTax : 0
  const finalServiceCharge = providedServiceCharge !== undefined ? providedServiceCharge : 0
  const finalTotalAmount = providedTotalAmount !== undefined ? providedTotalAmount : calculatedSubtotal
  const finalGrandTotal = providedGrandTotal !== undefined ? providedGrandTotal : calculatedSubtotal + finalTax + finalServiceCharge

  // Note: subtotal mismatch check removed — offline bills with discounts may differ

  // Create order with provided or default amounts
  const counterOrder = new CounterOrder({
    userId: userId || null,
    customerName: customerName ? customerName.trim() : 'Walk-in Customer',
    phoneNumber: /^\d{10}$/.test(phoneNumber || '') ? phoneNumber.trim() : '0000000000',
    branch: branchId,
    branchName: branchName || null,
    categoryId: categoryId || null,
    categoryName: categoryName || null,
    invoice: invoiceId || null, // Make invoice optional
    tableId: req.body.tableId || null,
    tableNumber: req.body.tableNumber || null,
    serverName: req.body.serverName || null, // Server/Waiter name
    kotNumber: req.body.kotNumber || null,
    kotTime: req.body.kotTime || null,
    invoiceNumber: req.body.invoiceNumber || null,
    items,
    subtotal: calculatedSubtotal,
    gstAmount: providedGstAmount || 0,
    tax: finalTax,
    serviceCharge: finalServiceCharge,
    totalAmount: finalTotalAmount,
    grandTotal: finalGrandTotal,
    isComplimentary,
    complimentaryReason,
    // Non-chargeable at bill time (staff meal, tasting, wastage). A bill can be
    // complimentary OR non-chargeable, never both — complimentary wins if both
    // somehow arrive.
    isNonChargeable: isComplimentary ? false : (isNonChargeable === true || isNonChargeable === 'true'),
    nonChargeableReason: isComplimentary ? null : (nonChargeableReason || null),
    nonChargeableType: isComplimentary
      ? null
      : (["staff", "management", "tasting", "wastage", "other"].includes(nonChargeableType) ? nonChargeableType : null),
    paymentMethod: ["cash", "card", "upi", "qr"].includes(paymentMethod) ? paymentMethod : 'cash',
    // If paymentStatus is 'completed', orderStatus must also be 'completed' regardless of what was sent.
    // 'billed' means the bill is finalised but payment is not yet settled — orderStatus is still
    // 'completed' (kitchen work done) while paymentStatus stays 'billed' until settlement.
    orderStatus: (reqPaymentStatus === 'completed' || reqPaymentStatus === 'billed' || status === 'completed')
      ? 'completed'
      : (reqOrderStatus && ["pending", "processing", "completed", "cancelled"].includes(reqOrderStatus)
          ? reqOrderStatus
          : "processing"),
    // A give-away has nothing to collect, so it is already settled. Leaving it
    // as 'billed' would make it show a Settle button and block the day close.
    paymentStatus: (isComplimentary || isNonChargeable === true || isNonChargeable === 'true')
      ? 'completed'
      : (reqPaymentStatus && ["pending", "completed", "failed", "refunded", "consolidated", "billed"].includes(reqPaymentStatus)
          ? reqPaymentStatus
          : (status || "completed")),
    // Backs the unique index that prevents duplicate bills
    businessDay: businessDayKey(),
  }) 
  try {
    await counterOrder.save()
  } catch (saveErr) {
    // Unique index rejected a duplicate bill — this is the concurrent case the
    // application-level check above can't catch. Report it the same way (409)
    // so the sync queue treats it as already-uploaded rather than retrying.
    if (saveErr.code === 11000) {
      const existing = await CounterOrder.findOne({
        branch: branchId,
        businessDay: businessDayKey(),
        invoiceNumber: counterOrder.invoiceNumber,
      })
        .select("_id invoiceNumber grandTotal createdAt")
        .lean()
        .catch(() => null)

      console.log(`[createCounterOrder] Unique index blocked duplicate ${counterOrder.invoiceNumber}`)
      return res.status(409).json({
        success: false,
        duplicate: true,
        message: `Bill ${counterOrder.invoiceNumber} already exists for this branch today`,
        order: existing
          ? { id: existing._id, _id: existing._id, invoiceNumber: existing.invoiceNumber, grandTotal: existing.grandTotal, createdAt: existing.createdAt }
          : null,
      })
    }

    // If MongoDB is disconnected, return 503 so the frontend knows to retry later
    const errorMessage = saveErr.message || '';
    if (saveErr.name === 'MongoNetworkError' || errorMessage.includes('ENOTFOUND') || errorMessage.includes('buffering timed out') || errorMessage.includes('topology was destroyed')) {
      res.status(503)
      throw new Error('Database temporarily unavailable. Bill saved locally and will sync when connection is restored.')
    }
    throw saveErr
  }
  
  console.log('[createCounterOrder] Saved successfully:', counterOrder.invoiceNumber || counterOrder._id)

  // Roll a bill-time non-chargeable into the daily tracking record, the same
  // way markNonChargeable() does for after-the-fact marking. Best-effort.
  if (counterOrder.isNonChargeable && counterOrder.invoiceNumber) {
    try {
      const amt = Number(calculatedSubtotal || finalGrandTotal || 0)
      const bucket = ["staff", "management", "tasting", "wastage"].includes(counterOrder.nonChargeableType)
        ? counterOrder.nonChargeableType
        : "other"
      await NonChargeableTracking.updateOne(
        { branchId, date: businessDayKey(counterOrder.createdAt || new Date()) },
        {
          $inc: {
            totalNonChargeableBills: 1,
            totalNonChargeableAmount: amt,
            [`byType.${bucket}`]: amt,
          },
          $push: {
            nonChargeableBills: {
              orderId: counterOrder._id,
              invoiceNumber: counterOrder.invoiceNumber,
              customerName: counterOrder.customerName,
              tableNumber: counterOrder.tableNumber,
              amount: amt,
              type: bucket,
              reason: counterOrder.nonChargeableReason,
              approvedBy: counterOrder.customerName || null,
              time: new Date().toLocaleTimeString("en-IN", { hour12: true, hour: "2-digit", minute: "2-digit" }),
            },
          },
          $setOnInsert: { branchId, date: businessDayKey(counterOrder.createdAt || new Date()) },
        },
        { upsert: true }
      )
    } catch (ncErr) {
      console.warn('[createCounterOrder] NC tracking rollup failed:', ncErr.message)
    }
  }

  // Auto-open the billing session on the first bill of the day, so the cashier
  // never has to remember to "open" billing. Non-blocking and idempotent.
  if (counterOrder.invoiceNumber) {
    try {
      // Business day, not calendar day — keeps late-night bills on one session
      const todayKey = businessDayKey()
      await BillingSession.updateOne(
        { branchId, date: todayKey },
        {
          $setOnInsert: {
            branchId,
            branchName: branchName || branch?.name || null,
            date: todayKey,
            status: "open",
            openedAt: new Date(),
            openedBy: customerName || null,
          },
        },
        { upsert: true }
      )
    } catch (sessionErr) {
      console.warn('[createCounterOrder] Could not auto-open billing session:', sessionErr.message)
    }
  }

  // Invalidate order cache so next GET returns fresh data
  invalidateOrderCache()

  // Emit real-time notification via Socket.IO (only for pending KOTs, not completed bills)
  try {
    const io = req.app.get('io')
    if (io && counterOrder.paymentStatus === 'pending') {
      console.log('🔔 Emitting new-kot event via Socket.IO')
      io.emit('new-kot', {
        id: counterOrder._id,
        invoiceNumber: counterOrder.invoiceNumber,
        tableNumber: counterOrder.tableNumber,
        customerName: counterOrder.customerName,
        items: counterOrder.items,
        branchId: counterOrder.branch,
        branchName: counterOrder.branchName,
        categoryName: counterOrder.categoryName,
        totalAmount: counterOrder.grandTotal || counterOrder.totalAmount,
        createdAt: counterOrder.createdAt,
      })
    } else if (io) {
      // Completed bill — just notify for list refresh (no ringtone)
      io.emit('order-updated')
    }
  } catch (err) { console.error('Socket emit error:', err.message) }

  // Auto-deduct raw material stock based on recipe ingredients (non-blocking)
  deductRawMaterialsForOrder(counterOrder.items).catch((err) =>
    console.error('[Recipe Stock Deduct] Error:', err.message)
  )

  // 🔥 WEBHOOK: Call CRM backend to deduct department stock based on recipes
  try {
    const CRM_API_URL = process.env.CRM_API_URL || "http://localhost:9001";
    const axios = require("axios");
    axios.post(`${CRM_API_URL}/api/v1/hotel/department-stock/deduct-by-recipe`, {
      items: counterOrder.items.map(item => ({
        menuItemId: String(item.menuItemId),
        menuItemName: item.name,
        quantity: item.quantity,
      })),
      department: "Kitchen",
      branch: counterOrder.branchName || "MYSURU",
      orderId: String(counterOrder._id),
      orderNumber: counterOrder.invoiceNumber || String(counterOrder._id),
    }).then(() => {
      console.log("✅ CRM stock deduction webhook sent for counter order:", counterOrder.invoiceNumber);
    }).catch(err => {
      console.error("⚠️ CRM webhook failed (non-blocking):", err.message);
    });
  } catch (webhookErr) {
    console.error("⚠️ CRM webhook error:", webhookErr.message);
  }

  // Populate related data
  const populatedOrder = await CounterOrder.findById(counterOrder._id)
    .populate("userId", "name mobile")
    .populate("branch", "name address")
    .populate("invoice", "invoiceNumber")
    .populate("items.menuItemId", "name")

  res.status(201).json({
    message: "Counter order created successfully",
    order: {
      id: populatedOrder._id,
      userId: populatedOrder.userId ? {
        id: populatedOrder.userId._id,
        name: populatedOrder.userId.name,
        mobile: populatedOrder.userId.mobile,
      } : null,
      customerName: populatedOrder.customerName,
      phoneNumber: populatedOrder.phoneNumber,
      branch: {
        id: populatedOrder.branch._id,
        name: populatedOrder.branch.name,
        location: populatedOrder.branch.address,
      },
      invoice: populatedOrder.invoice ? {
        id: populatedOrder.invoice._id,
        invoiceNumber: populatedOrder.invoice.invoiceNumber,
      } : null,
  
    },
  })
})
exports.getCounterOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params

  // Validate ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400)
    throw new Error("Invalid order ID format")
  }

  const counterOrder = await CounterOrder.findById(id)
    .populate("userId", "name mobile")
    .populate("branch", "name address")
    .populate("invoice", "invoiceNumber")
    .populate("items.menuItemId", "name")

  if (!counterOrder) {
    res.status(404)
    throw new Error("Counter order not found")
  }

  res.status(200).json({
    order: {
      id: counterOrder._id,
      userId: counterOrder.userId ? {
        id: counterOrder.userId._id,
        name: counterOrder.userId.name,
        mobile: counterOrder.userId.mobile,
      } : null,
      customerName: counterOrder.customerName,
      phoneNumber: counterOrder.phoneNumber,
      branch: {
        id: counterOrder.branch._id,
        name: counterOrder.branch.name,
        location: counterOrder.branch.address,
      },
      invoice: counterOrder.invoice ? {
        id: counterOrder.invoice._id,
        invoiceNumber: counterOrder.invoice.invoiceNumber,
      } : null,
      items: counterOrder.items,
      subtotal: counterOrder.subtotal,
      gstAmount: counterOrder.gstAmount || 0,
      tax: counterOrder.tax,
      serviceCharge: counterOrder.serviceCharge,
      totalAmount: counterOrder.totalAmount,
      grandTotal: counterOrder.grandTotal,
      paymentMethod: counterOrder.paymentMethod,
      orderStatus: counterOrder.orderStatus,
      paymentStatus: counterOrder.paymentStatus,
      cancellationReason: counterOrder.cancellationReason,
      cancelledAt: counterOrder.cancelledAt,
      createdAt: counterOrder.createdAt,
    },
  })
})
exports.getAllCounterOrders = asyncHandler(async (req, res) => {
  // Check in-memory cache first (only for GET requests)
  const cacheKey = req.originalUrl || req.url
  const cached = getCachedResponse(cacheKey)
  if (cached) {
    return res.status(200).json(cached)
  }

  const { 
    includeComplimentary = false, 
    startDate, 
    endDate, 
    date,
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    search,
    invoiceNumber,
    branchId,
    categoryName,
    paymentStatus,
    orderStatus,
    paymentMethod
  } = req.query
  
  // console.log('📅 Date filter params:', { startDate, endDate, date });
  // console.log('🔍 Filter params:', { search, branchId, categoryName, paymentStatus, orderStatus, paymentMethod });
  
  // Build query to exclude give-aways from sales reports unless explicitly
  // requested. Complimentary and non-chargeable are separate flags so they can
  // be reported independently.
  const query = {}
  if (!includeComplimentary || includeComplimentary === 'false') {
    query.isComplimentary = { $ne: true }
  }
  if (!req.query.includeNonChargeable || req.query.includeNonChargeable === 'false') {
    query.isNonChargeable = { $ne: true }
  }

  // Add date filtering — uses BUSINESS day windows (cutoff-to-cutoff), not
  // midnight-to-midnight, so late-night bills stay on the trading day they
  // belong to. Keeps this filter consistent with the billing-session Z-Report.
  if (date) {
    const { start, end } = businessDayRange(date);
    if (start && end) query.createdAt = { $gte: start, $lte: end };
  } else if (startDate || endDate) {
    // Date range filter. A bare "YYYY-MM-DD" is expanded to a business-day
    // window; a full ISO timestamp is used verbatim because the caller already
    // computed the exact instant it wants.
    const range = {};

    if (startDate) {
      const s = businessDayRange(startDate);
      if (s.start) range.$gte = s.start;
    }

    if (endDate) {
      const e = businessDayRange(endDate);
      // For an exact timestamp the boundary IS that instant, not the window end
      const bound = e.exact ? e.start : e.end;
      if (bound) range.$lte = bound;
    }

    if (Object.keys(range).length > 0) query.createdAt = range;
  }

  // Add search filter - search by customer name, phone number, invoice number, KOT number
  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { customerName: searchRegex },
      { phoneNumber: searchRegex },
      { invoiceNumber: searchRegex },
      { kotNumber: searchRegex }
    ];
  }

  // Exact invoiceNumber lookup (used by sync dedup check — avoids regex false positives)
  if (invoiceNumber && invoiceNumber.trim() !== '') {
    query.invoiceNumber = invoiceNumber.trim();
  }

  // Add branch filter
  if (branchId) {
    query.branch = branchId;
  }

  // Add category filter
  if (categoryName) {
    query.categoryName = new RegExp(categoryName.trim(), 'i');
    // console.log('📂 Category filter applied:', categoryName);
  }

  // Add payment status filter
  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  // Add order status filter
  if (orderStatus) {
    query.orderStatus = orderStatus;
  }

  // Add payment method filter
  if (paymentMethod) {
    query.paymentMethod = paymentMethod;
  }

  // console.log('🔍 Final query:', query);

  // Calculate pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Start performance timer
  const startTime = Date.now();

  // Execute query with pagination
  const [counterOrders, totalCount] = await Promise.all([
    CounterOrder.find(query)
      .populate("userId", "name mobile")
      .populate("branch", "name address")
      .populate("invoice", "invoiceNumber")
      .populate("items.menuItemId", "name")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    CounterOrder.countDocuments(query)
  ]);

  // Log performance
  const queryTime = Date.now() - startTime;
  // console.log(`⚡ Query executed in ${queryTime}ms - Found ${counterOrders.length} of ${totalCount} orders`);

  // console.log('📊 Found orders after filters:', counterOrders.length, 'of', totalCount);

  if (!counterOrders || counterOrders.length === 0) {
    return res.status(200).json({
      success: true,
      message: "No counter orders found",
      data: [],
      orders: [],
      pagination: {
        currentPage: pageNum,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: limitNum,
        hasNextPage: false,
        hasPrevPage: false
      }
    })
  }

  // Add null checks to prevent undefined errors
  const formattedOrders = counterOrders
    .map((order) => {
      // branch is required; userId is optional (offline bills have userId: null)
      if (!order.branch) {
        console.warn(`Order ${order._id} has missing branch reference`)
        return null
      }

      return {
        id: order._id,
        userId: order.userId ? {
          id: order.userId._id,
          name: order.userId.name,
          mobile: order.userId.mobile,
        } : null,
        customerName: order.customerName,
        phoneNumber: order.phoneNumber,
        branch: {
          id: order.branch._id,
          name: order.branch.name,
          location: order.branch.address,
        },
        invoice: order.invoice ? {
          id: order.invoice._id,
          invoiceNumber: order.invoice.invoiceNumber,
        } : null,
        tableId: order.tableId,
        tableNumber: order.tableNumber,
        serverName: order.serverName, // Server/Waiter name
        kotNumber: order.kotNumber,
        kotTime: order.kotTime,
        invoiceNumber: order.invoiceNumber,
        categoryName: order.categoryName,
        categoryId: order.categoryId,
        branchName: order.branchName,
        items: order.items || [],
        subtotal: order.subtotal,
        gstAmount: order.gstAmount || 0,
        tax: order.tax,
        serviceCharge: order.serviceCharge,
        totalAmount: order.totalAmount,
        grandTotal: order.grandTotal,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        isComplimentary: order.isComplimentary || false,
        complimentaryReason: order.complimentaryReason,
        isNonChargeable: order.isNonChargeable || false,
        nonChargeableReason: order.nonChargeableReason,
        nonChargeableType: order.nonChargeableType,
        nonChargeableBy: order.nonChargeableBy,
        originalGrandTotal: order.originalGrandTotal,
        cancellationReason: order.cancellationReason,
        cancelledBy: order.cancelledBy,
        cancelledAt: order.cancelledAt,
        createdAt: order.createdAt,
        orderDate: order.createdAt,
      }
    })
    .filter((order) => order !== null);

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  // console.log('✅ Returning formatted orders:', formattedOrders.length);

  const responseBody = {
    success: true,
    message: "Counter orders retrieved successfully",
    count: formattedOrders.length,
    data: formattedOrders,
    orders: formattedOrders,
    pagination: {
      currentPage: pageNum,
      totalPages,
      totalItems: totalCount,
      itemsPerPage: limitNum,
      hasNextPage,
      hasPrevPage
    },
    filters: {
      includeComplimentary,
      startDate,
      endDate,
      date,
      search,
      branchId,
      categoryName,
      paymentStatus,
      orderStatus,
      paymentMethod
    }
  }

  // Cache the response for subsequent identical requests
  setCachedResponse(cacheKey, responseBody)

  res.status(200).json(responseBody)
})
exports.getCounterOrdersByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params
if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400)
    throw new Error("Invalid user ID format")
  }

  const counterOrders = await CounterOrder.find({ userId })
    .populate("userId", "name mobile")
    .populate("branch", "name address")
    .populate("invoice", "invoiceNumber")
    .populate("items.menuItemId", "name")
    .sort({ createdAt: -1 })

  if (!counterOrders || counterOrders.length === 0) {
    return res.status(200).json({
      message: "No counter orders found for this user",
      orders: [],
    })
  }

  const formattedOrders = counterOrders.map((order) => ({
    id: order._id,
    userId: order.userId ? {
      id: order.userId._id,
      name: order.userId.name,
      mobile: order.userId.mobile,
    } : null,
    customerName: order.customerName,
    phoneNumber: order.phoneNumber,
    branch: {
      id: order.branch._id,
      name: order.branch.name,
      location: order.branch.address,
    },
    invoice: order.invoice ? {
      id: order.invoice._id,
      invoiceNumber: order.invoice.invoiceNumber,
    } : null,
    tableId: order.tableId,
    tableNumber: order.tableNumber,
        serverName: order.serverName, // Server/Waiter name
    kotNumber: order.kotNumber,
    kotTime: order.kotTime,
    invoiceNumber: order.invoiceNumber, // ADD: Include invoiceNumber in response
    items: order.items || [],
    subtotal: order.subtotal,
        gstAmount: order.gstAmount || 0,
    tax: order.tax,
    serviceCharge: order.serviceCharge,
    totalAmount: order.totalAmount,
    grandTotal: order.grandTotal,
    paymentMethod: order.paymentMethod,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    cancellationReason: order.cancellationReason,
    cancelledAt: order.cancelledAt,
    createdAt: order.createdAt,
  }))

  res.status(200).json({
    message: "Counter orders retrieved successfully",
    count: formattedOrders.length,
    orders: formattedOrders,
  })
})

exports.updateCounterOrder = asyncHandler(async (req, res) => {
  invalidateOrderCache()
  // Emit order-updated event
  try { const io = req.app.get('io'); if (io) io.emit('order-updated') } catch (_) {}
  const { id } = req.params
  const updateData = req.body

  // Validate ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400)
    throw new Error("Invalid order ID format")
  }

  const counterOrder = await CounterOrder.findById(id)
  if (!counterOrder) {
    res.status(404)
    throw new Error("Counter order not found")
  }

  // If items are being updated, recalculate totals
  if (updateData.items) {
    let calculatedSubtotal = 0
    for (const item of updateData.items) {
      calculatedSubtotal += item.price * item.quantity
    }

    updateData.subtotal = calculatedSubtotal
    updateData.tax = calculatedSubtotal * TAX_RATE
    updateData.serviceCharge = calculatedSubtotal * SERVICE_CHARGE_RATE
    updateData.totalAmount = calculatedSubtotal
    updateData.grandTotal = calculatedSubtotal + updateData.tax + updateData.serviceCharge
  }

  // Update the order
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] !== undefined) {
      counterOrder[key] = updateData[key]
    }
  })

  await counterOrder.save()

  const populatedOrder = await CounterOrder.findById(id)
    .populate("userId", "name mobile")
    .populate("branch", "name address")
    .populate("invoice", "invoiceNumber")
    .populate("items.menuItemId", "name")

  res.status(200).json({
    message: "Counter order updated successfully",
    order: {
      id: populatedOrder._id,
      userId: populatedOrder.userId ? {
        id: populatedOrder.userId._id,
        name: populatedOrder.userId.name,
        mobile: populatedOrder.userId.mobile,
      } : null,
      customerName: populatedOrder.customerName,
      phoneNumber: populatedOrder.phoneNumber,
      branch: {
        id: populatedOrder.branch._id,
        name: populatedOrder.branch.name,
        location: populatedOrder.branch.address,
      },
      invoice: populatedOrder.invoice ? { id: populatedOrder.invoice._id, invoiceNumber: populatedOrder.invoice.invoiceNumber, } : null,
      tableId: populatedOrder.tableId,
      tableNumber: populatedOrder.tableNumber,
      kotNumber: populatedOrder.kotNumber,
      kotTime: populatedOrder.kotTime,
      invoiceNumber: populatedOrder.invoiceNumber, // ADD: Include invoiceNumber in response
      items: populatedOrder.items,
      subtotal: populatedOrder.subtotal,
      gstAmount: populatedOrder.gstAmount || 0,
      tax: populatedOrder.tax,
      serviceCharge: populatedOrder.serviceCharge,
      totalAmount: populatedOrder.totalAmount,
      grandTotal: populatedOrder.grandTotal,
      paymentMethod: populatedOrder.paymentMethod,
      orderStatus: populatedOrder.orderStatus,
      paymentStatus: populatedOrder.paymentStatus,
      cancellationReason: populatedOrder.cancellationReason,
      cancelledAt: populatedOrder.cancelledAt,
      createdAt: populatedOrder.createdAt,
    },
  })
})

// Update order status only
exports.updateCounterOrderStatus = asyncHandler(async (req, res) => {
  invalidateOrderCache()
  // Emit order-updated event
  try { const io = req.app.get('io'); if (io) io.emit('order-updated') } catch (_) {}
  const { id } = req.params
  const { orderStatus } = req.body

  // Validate ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400)
    throw new Error("Invalid order ID format")
  }

  if (!orderStatus || !["pending", "processing", "completed", "cancelled"].includes(orderStatus)) {
    res.status(400)
    throw new Error("Invalid order status. Must be one of: pending, processing, completed, cancelled")
  }

  const counterOrder = await CounterOrder.findById(id)
  if (!counterOrder) {
    res.status(404)
    throw new Error("Counter order not found")
  }

  // Check if order is already cancelled
  if (counterOrder.orderStatus === "cancelled") {
    res.status(400)
    throw new Error("Cannot update status of a cancelled order")
  }

  counterOrder.orderStatus = orderStatus
  await counterOrder.save()

  const populatedOrder = await CounterOrder.findById(id)
    .populate("userId", "name mobile")
    .populate("branch", "name address")
    .populate("invoice", "invoiceNumber")
    .populate("items.menuItemId", "name")

  res.status(200).json({
    message: "Counter order status updated successfully",
    order: {
      id: populatedOrder._id,
      userId: populatedOrder.userId ? {
        id: populatedOrder.userId._id,
        name: populatedOrder.userId.name,
        mobile: populatedOrder.userId.mobile,
      } : null,
      customerName: populatedOrder.customerName,
      phoneNumber: populatedOrder.phoneNumber,
      branch: {
        id: populatedOrder.branch._id,
        name: populatedOrder.branch.name,
        location: populatedOrder.branch.address,
      },
      invoice: populatedOrder.invoice ? { id: populatedOrder.invoice._id, invoiceNumber: populatedOrder.invoice.invoiceNumber, } : null,
      tableId: populatedOrder.tableId,
      tableNumber: populatedOrder.tableNumber,
      kotNumber: populatedOrder.kotNumber,
      kotTime: populatedOrder.kotTime,
      invoiceNumber: populatedOrder.invoiceNumber, // ADD: Include invoiceNumber in response
      items: populatedOrder.items,
      subtotal: populatedOrder.subtotal,
      gstAmount: populatedOrder.gstAmount || 0,
      tax: populatedOrder.tax,
      serviceCharge: populatedOrder.serviceCharge,
      totalAmount: populatedOrder.totalAmount,
      grandTotal: populatedOrder.grandTotal,
      paymentMethod: populatedOrder.paymentMethod,
      orderStatus: populatedOrder.orderStatus,
      paymentStatus: populatedOrder.paymentStatus,
      cancellationReason: populatedOrder.cancellationReason,
      cancelledAt: populatedOrder.cancelledAt,
      createdAt: populatedOrder.createdAt,
    },
  })
})

// Update payment status only
exports.updateCounterPaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { paymentStatus } = req.body

  // Validate ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400)
    throw new Error("Invalid order ID format")
  }

  if (!paymentStatus || !["pending", "completed", "failed", "refunded", "consolidated", "billed"].includes(paymentStatus)) {
    res.status(400)
    throw new Error("Invalid payment status. Must be one of: pending, completed, failed, refunded, consolidated, billed")
  }

  const counterOrder = await CounterOrder.findById(id)
  if (!counterOrder) {
    res.status(404)
    throw new Error("Counter order not found")
  }

  // Check if order is cancelled
  if (counterOrder.orderStatus === "cancelled") {
    res.status(400)
    throw new Error("Cannot update payment status of a cancelled order")
  }

  counterOrder.paymentStatus = paymentStatus
  await counterOrder.save()

  const populatedOrder = await CounterOrder.findById(id)
    .populate("userId", "name mobile")
    .populate("branch", "name address")
    .populate("invoice", "invoiceNumber")
    .populate("items.menuItemId", "name")

  res.status(200).json({
    message: "Counter payment status updated successfully",
    order: {
      id: populatedOrder._id,
      userId: populatedOrder.userId ? {
        id: populatedOrder.userId._id,
        name: populatedOrder.userId.name,
        mobile: populatedOrder.userId.mobile,
      } : null,
      customerName: populatedOrder.customerName,
      phoneNumber: populatedOrder.phoneNumber,
      branch: {
        id: populatedOrder.branch._id,
        name: populatedOrder.branch.name,
        location: populatedOrder.branch.address,
      },
      invoice: populatedOrder.invoice ? { id: populatedOrder.invoice._id, invoiceNumber: populatedOrder.invoice.invoiceNumber, } : null,
      tableId: populatedOrder.tableId,
      tableNumber: populatedOrder.tableNumber,
      kotNumber: populatedOrder.kotNumber,
      kotTime: populatedOrder.kotTime,
      invoiceNumber: populatedOrder.invoiceNumber, // ADD: Include invoiceNumber in response
      items: populatedOrder.items,
      subtotal: populatedOrder.subtotal,
      gstAmount: populatedOrder.gstAmount || 0,
      tax: populatedOrder.tax,
      serviceCharge: populatedOrder.serviceCharge,
      totalAmount: populatedOrder.totalAmount,
      grandTotal: populatedOrder.grandTotal,
      paymentMethod: populatedOrder.paymentMethod,
      orderStatus: populatedOrder.orderStatus,
      paymentStatus: populatedOrder.paymentStatus,
      cancellationReason: populatedOrder.cancellationReason,
      cancelledAt: populatedOrder.cancelledAt,
      createdAt: populatedOrder.createdAt,
    },
  })
})

// Cancel order with reason
exports.cancelCounterOrder = asyncHandler(async (req, res) => {
  invalidateOrderCache()
  // Emit order-updated event
  try { const io = req.app.get('io'); if (io) io.emit('order-updated') } catch (_) {}
  const { id } = req.params
  const { cancellationReason, cancelledBy } = req.body

  // Validate ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400)
    throw new Error("Invalid order ID format")
  }

  if (!cancellationReason || !cancellationReason.trim()) {
    res.status(400)
    throw new Error("Cancellation reason is required")
  }

  if (cancellationReason.trim().length > 500) {
    res.status(400)
    throw new Error("Cancellation reason cannot exceed 500 characters")
  }

  const counterOrder = await CounterOrder.findById(id)
  if (!counterOrder) {
    res.status(404)
    throw new Error("Counter order not found")
  }

  // Check if order is already cancelled
  if (counterOrder.orderStatus === "cancelled") {
    res.status(400)
    throw new Error("Order is already cancelled")
  }

  // REMOVED: Allow cancelling completed orders
  // if (counterOrder.orderStatus === "completed") {
  //   res.status(400)
  //   throw new Error("Cannot cancel a completed order")
  // }

  // Update order status to cancelled and add cancellation details
  counterOrder.orderStatus = "cancelled"
  counterOrder.cancellationReason = cancellationReason.trim()
  counterOrder.cancelledBy = cancelledBy ? cancelledBy.trim() : null
  counterOrder.cancelledAt = new Date()
  await counterOrder.save()

  const populatedOrder = await CounterOrder.findById(id)
    .populate("userId", "name mobile")
    .populate("branch", "name address")
    .populate("invoice", "invoiceNumber")
    .populate("items.menuItemId", "name")

  res.status(200).json({
    message: "Counter order cancelled successfully",
    order: {
      id: populatedOrder._id,
      userId: populatedOrder.userId ? {
        id: populatedOrder.userId._id,
        name: populatedOrder.userId.name,
        mobile: populatedOrder.userId.mobile,
      } : null,
      customerName: populatedOrder.customerName,
      phoneNumber: populatedOrder.phoneNumber,
      branch: {
        id: populatedOrder.branch._id,
        name: populatedOrder.branch.name,
        location: populatedOrder.branch.address,
      },
      invoice: populatedOrder.invoice ? { id: populatedOrder.invoice._id, invoiceNumber: populatedOrder.invoice.invoiceNumber, } : null,
      tableId: populatedOrder.tableId,
      tableNumber: populatedOrder.tableNumber,
      kotNumber: populatedOrder.kotNumber,
      kotTime: populatedOrder.kotTime,
      invoiceNumber: populatedOrder.invoiceNumber, // ADD: Include invoiceNumber in response
      items: populatedOrder.items,
      subtotal: populatedOrder.subtotal,
      tax: populatedOrder.tax,
      serviceCharge: populatedOrder.serviceCharge,
      totalAmount: populatedOrder.totalAmount,
      grandTotal: populatedOrder.grandTotal,
      paymentMethod: populatedOrder.paymentMethod,
      orderStatus: populatedOrder.orderStatus,
      paymentStatus: populatedOrder.paymentStatus,
      cancellationReason: populatedOrder.cancellationReason,
      cancelledBy: populatedOrder.cancelledBy,
      cancelledAt: populatedOrder.cancelledAt,
      createdAt: populatedOrder.createdAt,
    },
  })
})

// Clear all counter orders (for testing/cleanup)
exports.clearAllCounterOrders = asyncHandler(async (req, res) => {
  try {
    // Delete all counter orders
    const deleteResult = await CounterOrder.deleteMany({})
    
    res.status(200).json({
      message: "All counter orders cleared successfully",
      deletedCount: deleteResult.deletedCount
    })
  } catch (error) {
    console.error("Error clearing counter orders:", error)
    res.status(500)
    throw new Error("Failed to clear counter orders")
  }
})

// Get categorized orders with pagination and filtering (optimized for big data)
exports.getCategorizedOrders = asyncHandler(async (req, res) => {
  const { 
    includeComplimentary = false, 
    startDate, 
    endDate, 
    date,
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    search,
    branchId,
    categoryName,
    paymentStatus,
    orderStatus,
    paymentMethod
  } = req.query
  
  // console.log('📊 getCategorizedOrders called with params:', { 
  //   date, startDate, endDate, categoryName, orderStatus, page, limit 
  // });
  
  // Build query to exclude give-aways unless explicitly requested
  const query = {}
  if (!includeComplimentary || includeComplimentary === 'false') {
    query.isComplimentary = { $ne: true }
  }
  if (!req.query.includeNonChargeable || req.query.includeNonChargeable === 'false') {
    query.isNonChargeable = { $ne: true }
  }

  // Only include orders with invoice numbers (completed bills)
  query.$or = [
    { invoiceNumber: { $exists: true, $ne: null, $ne: '' } },
    { 'invoice': { $exists: true, $ne: null } }
  ]

  // Add date filtering — business day windows (cutoff-to-cutoff), matching the
  // counter sales report and the billing-session Z-Report.
  if (date) {
    const { start, end } = businessDayRange(date);
    if (start && end) query.createdAt = { $gte: start, $lte: end };
  } else if (startDate || endDate) {
    const range = {};

    if (startDate) {
      const s = businessDayRange(startDate);
      if (s.start) range.$gte = s.start;
    }

    if (endDate) {
      const e = businessDayRange(endDate);
      const bound = e.exact ? e.start : e.end;
      if (bound) range.$lte = bound;
    }

    if (Object.keys(range).length > 0) query.createdAt = range;
  }

  // Add search filter
  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { customerName: searchRegex },
        { phoneNumber: searchRegex },
        { invoiceNumber: searchRegex },
        { kotNumber: searchRegex }
      ]
    });
  }

  // Add branch filter
  if (branchId) {
    query.branch = branchId;
  }

  // Add category filter
  if (categoryName && categoryName !== 'all') {
    const categoryLower = categoryName.toLowerCase().trim();
    
    if (categoryLower === 'selfservice' || categoryLower === 'self service') {
      // Self service: categoryName contains 'self service' or 'darshini', OR no table
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { categoryName: /self service|self-service|darshini/i },
          { $and: [
            { categoryName: { $not: /restaurant|temple/i } },
            { $or: [
              { tableNumber: { $exists: false } },
              { tableNumber: null },
              { tableNumber: '' }
            ]}
          ]}
        ]
      });
    } else if (categoryLower === 'restaurant') {
      // Restaurant: categoryName contains 'restaurant' OR has table number
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { categoryName: /restaurant/i },
          { $and: [
            { categoryName: { $not: /temple|self service|darshini/i } },
            { tableNumber: { $exists: true, $ne: null, $ne: '' } }
          ]}
        ]
      });
    } else if (categoryLower === 'templemeals' || categoryLower === 'temple meals') {
      // Temple meals: categoryName contains 'temple'
      query.categoryName = /temple/i;
    }
  }

  // Add payment status filter
  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  // Add order status filter
  if (orderStatus) {
    query.orderStatus = orderStatus;
  }

  // Add payment method filter
  if (paymentMethod) {
    query.paymentMethod = paymentMethod;
  }

  // console.log('🔍 Final query:', JSON.stringify(query, null, 2));

  // Calculate pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Start performance timer
  const startTime = Date.now();

  // Execute query with pagination
  const [counterOrders, totalCount] = await Promise.all([
    CounterOrder.find(query)
      .populate("userId", "name mobile")
      .populate("branch", "name address")
      .populate("invoice", "invoiceNumber")
      .populate("items.menuItemId", "name")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    CounterOrder.countDocuments(query)
  ]);

  // Same filters, minus the give-away exclusions. Needed so the complimentary
  // and non-chargeable badge counts aren't zeroed out by their own filter.
  const baseQuery = { ...query };
  delete baseQuery.isComplimentary;
  delete baseQuery.isNonChargeable;

  // Calculate category counts (for all matching orders, not just current page)
  const categoryCounts = await Promise.all([
    // Self Service count
    CounterOrder.countDocuments({
      ...query,
      $or: [
        { categoryName: /self service|self-service|darshini/i },
        { $and: [
          { categoryName: { $not: /restaurant|temple/i } },
          { $or: [
            { tableNumber: { $exists: false } },
            { tableNumber: null },
            { tableNumber: '' }
          ]}
        ]}
      ]
    }),
    // Restaurant count
    CounterOrder.countDocuments({
      ...query,
      $or: [
        { categoryName: /restaurant/i },
        { $and: [
          { categoryName: { $not: /temple|self service|darshini/i } },
          { tableNumber: { $exists: true, $ne: null, $ne: '' } }
        ]}
      ]
    }),
    // Temple Meals count
    CounterOrder.countDocuments({
      ...query,
      categoryName: /temple/i
    }),
    // Complimentary count — for the Complimentary tab badge. Counted server-side
    // so the badge is correct on every tab, not just while that tab is open.
    // Uses baseQuery (not query) so the flag's own exclusion filter doesn't
    // zero out its own count.
    CounterOrder.countDocuments({
      ...baseQuery,
      isComplimentary: true
    }),
    // Non-chargeable count — same reasoning
    CounterOrder.countDocuments({
      ...baseQuery,
      isNonChargeable: true
    })
  ]);

  // Calculate statistics for all matching orders (not just current page)
  const allMatchingOrders = await CounterOrder.find(query).select('grandTotal totalAmount orderStatus').lean();
  
  const stats = {
    // Orders that actually count as sales — cancelled ones are reported
    // separately, so including them here would double-count on screen.
    totalOrders: 0,
    // Every matching document, cancelled included (for pagination/debug)
    matchedOrders: totalCount,
    totalRevenue: 0,
    cancelledOrders: 0,
    cancelledAmount: 0,
    completedOrders: 0,
    pendingOrders: 0
  };

  allMatchingOrders.forEach(order => {
    const status = (order.orderStatus || 'completed').toLowerCase();
    const amount = order.grandTotal || order.totalAmount || 0;
    
    if (status === 'cancelled') {
      stats.cancelledOrders++;
      stats.cancelledAmount += amount;
    } else {
      stats.totalOrders++;
      stats.totalRevenue += amount;
      if (status === 'completed') {
        stats.completedOrders++;
      } else if (status === 'pending' || status === 'processing') {
        stats.pendingOrders++;
      }
    }
  });

  // Round money to 2dp — float sums produce artefacts like 13562.199999999
  stats.totalRevenue = Number(stats.totalRevenue.toFixed(2));
  stats.cancelledAmount = Number(stats.cancelledAmount.toFixed(2));

  // Log performance
  const queryTime = Date.now() - startTime;
  // console.log(`⚡ Query executed in ${queryTime}ms - Found ${counterOrders.length} of ${totalCount} orders`);

  if (!counterOrders || counterOrders.length === 0) {
    return res.status(200).json({
      success: true,
      message: "No counter orders found",
      data: [],
      orders: [],
      stats,
      categoryCounts: {
        selfService: categoryCounts[0],
        restaurant: categoryCounts[1],
        templeMeals: categoryCounts[2]
      },
      complimentaryCount: categoryCounts[3] || 0,
      nonChargeableCount: categoryCounts[4] || 0,
      pagination: {
        currentPage: pageNum,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: limitNum,
        hasNextPage: false,
        hasPrevPage: false
      }
    })
  }

  // Format orders
  const formattedOrders = counterOrders
    .map((order) => {
      // branch is required; userId is optional (offline bills have userId: null)
      if (!order.branch) {
        console.warn(`Order ${order._id} has missing branch reference`)
        return null
      }

      return {
        id: order._id,
        userId: order.userId ? {
          id: order.userId._id,
          name: order.userId.name,
          mobile: order.userId.mobile,
        } : null,
        customerName: order.customerName,
        phoneNumber: order.phoneNumber,
        branch: {
          id: order.branch._id,
          name: order.branch.name,
          location: order.branch.address,
        },
        invoice: order.invoice ? {
          id: order.invoice._id,
          invoiceNumber: order.invoice.invoiceNumber,
        } : null,
        tableId: order.tableId,
        tableNumber: order.tableNumber,
        serverName: order.serverName, // Server/Waiter name
        kotNumber: order.kotNumber,
        kotTime: order.kotTime,
        invoiceNumber: order.invoiceNumber,
        categoryName: order.categoryName,
        categoryId: order.categoryId,
        branchName: order.branchName,
        items: order.items || [],
        subtotal: order.subtotal,
        gstAmount: order.gstAmount || 0,
        tax: order.tax,
        serviceCharge: order.serviceCharge,
        totalAmount: order.totalAmount,
        grandTotal: order.grandTotal,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        isComplimentary: order.isComplimentary || false,
        complimentaryReason: order.complimentaryReason,
        isNonChargeable: order.isNonChargeable || false,
        nonChargeableReason: order.nonChargeableReason,
        nonChargeableType: order.nonChargeableType,
        nonChargeableBy: order.nonChargeableBy,
        originalGrandTotal: order.originalGrandTotal,
        cancellationReason: order.cancellationReason,
        cancelledBy: order.cancelledBy,
        cancelledAt: order.cancelledAt,
        createdAt: order.createdAt,
        orderDate: order.createdAt,
      }
    })
    .filter((order) => order !== null);

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  // console.log('✅ Returning formatted orders:', formattedOrders.length);

  res.status(200).json({
    success: true,
    message: "Categorized orders retrieved successfully",
    count: formattedOrders.length,
    data: formattedOrders,
    orders: formattedOrders,
    stats,
    categoryCounts: {
      selfService: categoryCounts[0],
      restaurant: categoryCounts[1],
      templeMeals: categoryCounts[2]
    },
    complimentaryCount: categoryCounts[3] || 0,
    nonChargeableCount: categoryCounts[4] || 0,
    pagination: {
      currentPage: pageNum,
      totalPages,
      totalItems: totalCount,
      itemsPerPage: limitNum,
      hasNextPage,
      hasPrevPage
    },
    filters: {
      includeComplimentary,
      startDate,
      endDate,
      date,
      search,
      branchId,
      categoryName,
      paymentStatus,
      orderStatus,
      paymentMethod
    }
  })
})
// ─── Settle a billed order (collect payment) ─────────────────────────────────
// PUT /api/v1/hotel/counter-order/orders/:id/settle
exports.settleOrder = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { paymentMethod, utr, settledBy } = req.body

  // Validate payment method
  if (!paymentMethod || !['cash', 'upi', 'card'].includes(paymentMethod)) {
    res.status(400)
    throw new Error('Payment method is required and must be one of: cash, upi, card')
  }

  // UTR is optional for UPI — cashiers often settle before the reference lands
  const order = await CounterOrder.findById(id)
  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  // Nothing to collect on a give-away
  if (order.isNonChargeable) {
    res.status(400)
    throw new Error('Order is non-chargeable — there is no payment to settle')
  }
  if (order.isComplimentary) {
    res.status(400)
    throw new Error('Order is complimentary — there is no payment to settle')
  }

  // Only 'billed' orders can be settled
  if (order.paymentStatus !== 'billed') {
    res.status(400)
    throw new Error(`Cannot settle order with status "${order.paymentStatus}". Only "billed" orders can be settled.`)
  }

  // Update payment status and settlement details
  order.paymentStatus = 'completed'
  order.paymentMethod = paymentMethod
  order.settlementDetails = {
    method: paymentMethod,
    utr: utr || null,
    settledAt: new Date(),
    settledBy: settledBy || null,
  }

  await order.save()

  // Invalidate any cached order lists
  if (typeof invalidateOrderCache === 'function') {
    invalidateOrderCache()
  }

  res.status(200).json({
    success: true,
    message: 'Order settled successfully',
    order: {
      id: order._id,
      invoiceNumber: order.invoiceNumber,
      grandTotal: order.grandTotal,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      settlementDetails: order.settlementDetails,
    },
  })
})
// ─── Mark an order non-chargeable (internal consumption) ─────────────────────
// PUT /api/v1/hotel/counter-order/orders/:id/non-chargeable
//
// Distinct from complimentary: complimentary is a goodwill give-away to a
// customer, non-chargeable is internal consumption (staff meal, management,
// tasting, wastage). Both zero the bill, but they are reported separately.
exports.markNonChargeable = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { reason, type, approvedBy } = req.body

  const allowedTypes = ["staff", "management", "tasting", "wastage", "other"]

  if (!reason || !String(reason).trim()) {
    res.status(400)
    throw new Error("A reason is required to mark an order non-chargeable")
  }
  if (!type || !allowedTypes.includes(type)) {
    res.status(400)
    throw new Error(`Type is required and must be one of: ${allowedTypes.join(", ")}`)
  }

  const order = await CounterOrder.findById(id)
  if (!order) {
    res.status(404)
    throw new Error("Order not found")
  }

  const ordStatus = String(order.orderStatus || "").toLowerCase()
  if (ordStatus === "cancelled") {
    res.status(400)
    throw new Error("Cannot mark a cancelled order non-chargeable")
  }
  if (order.isNonChargeable) {
    res.status(400)
    throw new Error("Order is already marked non-chargeable")
  }
  if (order.isComplimentary) {
    res.status(400)
    throw new Error("Order is already complimentary — it cannot also be non-chargeable")
  }

  // Preserve what the bill was worth before zeroing it
  const original = Number(order.grandTotal != null ? order.grandTotal : order.totalAmount || 0)

  order.isNonChargeable = true
  order.nonChargeableReason = String(reason).trim()
  order.nonChargeableType = type
  order.nonChargeableBy = approvedBy ? String(approvedBy).trim() : null
  order.nonChargeableAt = new Date()
  order.originalGrandTotal = original

  // No money changes hands, so the bill is settled at zero. This deliberately
  // does NOT block the day close — same behaviour as complimentary.
  order.grandTotal = 0
  order.totalAmount = 0
  order.gstAmount = 0
  order.tax = 0
  order.paymentStatus = "completed"
  order.orderStatus = "completed"

  await order.save()

  // Roll up into the per-day tracking record (best-effort — a tracking failure
  // must not undo a saved order)
  try {
    const branchId = order.branch
    const day = businessDayKey(order.createdAt || new Date())
    const bucket = allowedTypes.includes(type) ? type : "other"

    await NonChargeableTracking.findOneAndUpdate(
      { branchId, date: day },
      {
        $inc: {
          totalNonChargeableBills: 1,
          totalNonChargeableAmount: original,
          [`byType.${bucket}`]: original,
        },
        $push: {
          nonChargeableBills: {
            orderId: order._id,
            invoiceNumber: order.invoiceNumber || null,
            customerName: order.customerName || null,
            tableNumber: order.tableNumber || null,
            amount: original,
            type,
            reason: String(reason).trim(),
            approvedBy: approvedBy ? String(approvedBy).trim() : null,
            time: new Date().toLocaleTimeString("en-IN", { hour12: true, hour: "2-digit", minute: "2-digit" }),
          },
        },
        $setOnInsert: { branchId, date: day },
      },
      { upsert: true, new: true, runValidators: true }
    )
  } catch (trackErr) {
    console.warn("[markNonChargeable] tracking rollup failed:", trackErr.message)
  }

  invalidateOrderCache()

  res.status(200).json({
    success: true,
    message: "Order marked non-chargeable",
    order: {
      id: order._id,
      invoiceNumber: order.invoiceNumber,
      originalGrandTotal: order.originalGrandTotal,
      grandTotal: order.grandTotal,
      isNonChargeable: order.isNonChargeable,
      nonChargeableType: order.nonChargeableType,
      nonChargeableReason: order.nonChargeableReason,
      nonChargeableBy: order.nonChargeableBy,
      nonChargeableAt: order.nonChargeableAt,
    },
  })
})

// ─── GET /api/v1/hotel/counter-order/sales-report ────────────────────────────
// Aggregated sales report: category-wise or item-wise.
// Excludes cancelled, complimentary, and non-chargeable orders.
// Supports date range (business-day aware) and branch filter.
exports.getSalesReport = asyncHandler(async (req, res) => {
  const {
    branchId,
    startDate,
    endDate,
    groupBy = 'category', // 'category' | 'item'
    page = 1,
    limit = 20,
  } = req.query

  if (!branchId) {
    res.status(400)
    throw new Error("branchId is required")
  }
  if (!startDate || !endDate) {
    res.status(400)
    throw new Error("startDate and endDate are required")
  }

  // Build date range using business-day-aware helpers
  const startRange = businessDayRange(startDate)
  const endRange = businessDayRange(endDate)
  const dateFilter = {}
  if (startRange.start) dateFilter.$gte = startRange.start
  if (endRange.end) dateFilter.$lte = endRange.exact ? endRange.start : endRange.end

  if (!dateFilter.$gte || !dateFilter.$lte) {
    res.status(400)
    throw new Error("Invalid date range")
  }

  // Base match: active orders only (no cancelled, no complimentary, no NC)
  const matchStage = {
    branch: new (require('mongoose').Types.ObjectId)(branchId),
    createdAt: dateFilter,
    orderStatus: { $ne: 'cancelled' },
    isComplimentary: { $ne: true },
    isNonChargeable: { $ne: true },
    // Only include completed bills (have invoiceNumber), not raw KOTs
    invoiceNumber: { $ne: null },
  }

  if (groupBy === 'category') {
    // Category-wise aggregation — groups by menu item's actual category (Conti Kitchen, Tandoori, etc.)
    const pipeline = [
      { $match: matchStage },
      { $unwind: '$items' },
      // Lookup the menu item to get its categoryId
      {
        $lookup: {
          from: 'menus',
          localField: 'items.menuItemId',
          foreignField: '_id',
          as: '_menuItem'
        }
      },
      // Lookup the category name
      {
        $lookup: {
          from: 'categoryys',
          localField: '_menuItem.categoryId',
          foreignField: '_id',
          as: '_category'
        }
      },
      {
        $group: {
          _id: { $ifNull: [{ $arrayElemAt: ['$_category.name', 0] }, 'Uncategorized'] },
          orders: { $addToSet: '$_id' },
          itemsSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          gst: {
            $sum: {
              $multiply: [
                { $multiply: ['$items.price', '$items.quantity'] },
                { $divide: [{ $ifNull: ['$items.gstRate', 0] }, 100] }
              ]
            }
          },
        }
      },
      {
        $project: {
          _id: 0,
          category: { $ifNull: ['$_id', 'Uncategorized'] },
          orders: { $size: '$orders' },
          itemsSold: 1,
          revenue: { $round: ['$revenue', 2] },
          gst: { $round: ['$gst', 2] },
          netRevenue: { $round: [{ $add: ['$revenue', '$gst'] }, 2] },
        }
      },
      { $sort: { revenue: -1 } }
    ]

    const results = await CounterOrder.aggregate(pipeline)

    // Compute totals
    const totals = results.reduce((acc, r) => {
      acc.orders += r.orders
      acc.itemsSold += r.itemsSold
      acc.revenue += r.revenue
      acc.gst += r.gst
      acc.netRevenue += r.netRevenue
      return acc
    }, { orders: 0, itemsSold: 0, revenue: 0, gst: 0, netRevenue: 0 })

    res.status(200).json({
      success: true,
      groupBy: 'category',
      startDate,
      endDate,
      data: results,
      totals: {
        orders: totals.orders,
        itemsSold: totals.itemsSold,
        revenue: Math.round(totals.revenue * 100) / 100,
        gst: Math.round(totals.gst * 100) / 100,
        netRevenue: Math.round(totals.netRevenue * 100) / 100,
      }
    })

  } else if (groupBy === 'item') {
    // Item-wise aggregation — shows actual menu category for each item
    // With server-side pagination
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const pipeline = [
      { $match: matchStage },
      { $unwind: '$items' },
      // Lookup the menu item to get its categoryId
      {
        $lookup: {
          from: 'menus',
          localField: 'items.menuItemId',
          foreignField: '_id',
          as: '_menuItem'
        }
      },
      // Lookup the category name
      {
        $lookup: {
          from: 'categoryys',
          localField: '_menuItem.categoryId',
          foreignField: '_id',
          as: '_category'
        }
      },
      {
        $group: {
          _id: { name: '$items.name', category: { $ifNull: [{ $arrayElemAt: ['$_category.name', 0] }, 'Uncategorized'] } },
          qtySold: { $sum: '$items.quantity' },
          unitPrice: { $avg: '$items.price' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          gst: {
            $sum: {
              $multiply: [
                { $multiply: ['$items.price', '$items.quantity'] },
                { $divide: [{ $ifNull: ['$items.gstRate', 0] }, 100] }
              ]
            }
          },
        }
      },
      {
        $project: {
          _id: 0,
          itemName: '$_id.name',
          category: { $ifNull: ['$_id.category', 'Uncategorized'] },
          qtySold: 1,
          unitPrice: { $round: ['$unitPrice', 2] },
          totalRevenue: { $round: ['$totalRevenue', 2] },
          gst: { $round: ['$gst', 2] },
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]

    // Run full pipeline for totals count
    const allResults = await CounterOrder.aggregate(pipeline)
    const totalItems = allResults.length

    // Compute totals from full result set
    const totals = allResults.reduce((acc, r) => {
      acc.qtySold += r.qtySold
      acc.totalRevenue += r.totalRevenue
      acc.gst += r.gst
      return acc
    }, { qtySold: 0, totalRevenue: 0, gst: 0 })

    // Paginate
    const paginatedResults = allResults.slice(skip, skip + limitNum)
    const totalPages = Math.ceil(totalItems / limitNum)

    res.status(200).json({
      success: true,
      groupBy: 'item',
      startDate,
      endDate,
      data: paginatedResults,
      totals: {
        qtySold: totals.qtySold,
        totalRevenue: Math.round(totals.totalRevenue * 100) / 100,
        gst: Math.round(totals.gst * 100) / 100,
      },
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      }
    })

  } else {
    res.status(400)
    throw new Error("groupBy must be 'category' or 'item'")
  }
})

// ─── GET /api/v1/hotel/counter-order/non-chargeable-orders ───────────────────
// Paginated listing of actual non-chargeable order documents (not the rollup).
// Supports date filter, branch filter, type filter, search, and pagination.
exports.getNonChargeableOrders = asyncHandler(async (req, res) => {
  const {
    branchId,
    date,
    startDate,
    endDate,
    type, // staff | management | tasting | wastage | other
    search,
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query

  if (!branchId) {
    res.status(400)
    throw new Error("branchId is required")
  }

  const query = { isNonChargeable: true, branch: branchId }

  // Date filter — business-day aware
  if (date) {
    const { start, end } = businessDayRange(date)
    if (start && end) query.createdAt = { $gte: start, $lte: end }
  } else if (startDate || endDate) {
    const range = {}
    if (startDate) {
      const s = businessDayRange(startDate)
      if (s.start) range.$gte = s.start
    }
    if (endDate) {
      const e = businessDayRange(endDate)
      const bound = e.exact ? e.start : e.end
      if (bound) range.$lte = bound
    }
    if (Object.keys(range).length > 0) query.createdAt = range
  }

  // Type filter
  if (type) {
    query.nonChargeableType = type
  }

  // Search
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i')
    query.$or = [
      { customerName: searchRegex },
      { invoiceNumber: searchRegex },
      { nonChargeableReason: searchRegex },
      { nonChargeableBy: searchRegex },
    ]
  }

  const pageNum = parseInt(page)
  const limitNum = parseInt(limit)
  const skip = (pageNum - 1) * limitNum

  const sort = {}
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1

  const [orders, totalCount] = await Promise.all([
    CounterOrder.find(query)
      .populate("branch", "name address")
      .populate("items.menuItemId", "name")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    CounterOrder.countDocuments(query)
  ])

  const formattedOrders = orders.map((order) => ({
    id: order._id,
    invoiceNumber: order.invoiceNumber,
    customerName: order.customerName || 'Walk-in Customer',
    tableNumber: order.tableNumber || null,
    items: order.items || [],
    originalGrandTotal: order.originalGrandTotal || order.grandTotal || 0,
    totalAmount: order.originalGrandTotal || order.totalAmount || 0,
    grandTotal: order.grandTotal || 0,
    isNonChargeable: true,
    nonChargeableReason: order.nonChargeableReason,
    nonChargeableType: order.nonChargeableType,
    nonChargeableBy: order.nonChargeableBy,
    nonChargeableAt: order.nonChargeableAt,
    categoryName: order.categoryName || null,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
  }))

  const totalPages = Math.ceil(totalCount / limitNum)

  res.status(200).json({
    success: true,
    message: "Non-chargeable orders retrieved successfully",
    count: formattedOrders.length,
    data: formattedOrders,
    orders: formattedOrders,
    pagination: {
      currentPage: pageNum,
      totalPages,
      totalItems: totalCount,
      itemsPerPage: limitNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    },
    summary: {
      totalBills: totalCount,
      totalAmount: orders.reduce((sum, o) => sum + (o.originalGrandTotal || o.totalAmount || 0), 0),
    }
  })
})

// ─── GET /api/v1/hotel/counter-order/non-chargeable-summary ──────────────────
// Per-day rollup for reporting: totals plus the split by type.
exports.getNonChargeableSummary = asyncHandler(async (req, res) => {
  const { branchId } = req.query
  const date = req.query.date || businessDayKey()

  if (!branchId) {
    res.status(400)
    throw new Error("branchId is required")
  }

  const tracking = await NonChargeableTracking.findOne({ branchId, date }).lean()

  res.status(200).json({
    success: true,
    date,
    summary: tracking || {
      branchId,
      date,
      totalNonChargeableBills: 0,
      totalNonChargeableAmount: 0,
      byType: { staff: 0, management: 0, tasting: 0, wastage: 0, other: 0 },
      nonChargeableBills: [],
    },
  })
})
