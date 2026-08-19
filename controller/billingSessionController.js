const BillingSession = require("../model/billingSessionModel")
const CounterOrder = require("../model/counterOrderModel")
const Branch = require("../model/Branch")
const asyncHandler = require("express-async-handler")
const { businessDayKey, businessDayRange } = require("../utils/businessDay")

// Business day the current moment belongs to (respects the late-night cutoff,
// so a 1 AM bill still counts towards the previous night's trading).
const localDateKey = (d = new Date()) => businessDayKey(d)

// Real timestamp window for a business-day key (cutoff-to-cutoff, not midnight)
const dayRange = (dateKey) => businessDayRange(dateKey)

/**
 * Build the live figures for a branch + business day, straight from CounterOrder.
 * This is the single source of truth used both for the pre-close preview and for
 * the frozen Z-Report snapshot, so the two can never disagree.
 */
async function computeDayFigures(branchId, dateKey) {
  const { start, end } = dayRange(dateKey)

  // Never hand Mongoose an Invalid Date — it throws a CastError. An unparseable
  // date means "no window", so report zeroes rather than 500-ing.
  if (!start || !end) {
    return {
      totals: { billCount: 0, grossSales: 0, gst: 0, discount: 0 },
      paymentBreakdown: { cash: 0, upi: 0, card: 0 },
      giveaways: {
        complimentary: { count: 0, amount: 0 },
        nonChargeable: { count: 0, amount: 0, byType: { staff: 0, management: 0, tasting: 0, wastage: 0, other: 0 } },
      },
      cashExpected: 0,
      unsettledBills: [],
      openKOTs: [],
    }
  }

  const orders = await CounterOrder.find({
    branch: branchId,
    createdAt: { $gte: start, $lte: end },
  })
    .select(
      "invoiceNumber kotNumber tableNumber paymentStatus orderStatus status grandTotal totalAmount gstAmount discountAmount isComplimentary complimentaryReason isNonChargeable nonChargeableType nonChargeableReason originalGrandTotal settlementDetails paymentMethod createdAt"
    )
    .lean()

  const norm = (v) => String(v == null ? "" : v).toLowerCase().trim()

  // Give-aways — reported separately from sales, and from each other
  const isGiveaway = (o) => o.isComplimentary || o.isNonChargeable
  const amountOfRaw = (b) =>
    Number(b.originalGrandTotal != null ? b.originalGrandTotal : (b.grandTotal != null ? b.grandTotal : b.totalAmount || 0))

  const realBill = (o) => {
    if (!o.invoiceNumber) return false
    if (o.kotNumber) return false
    const ord = norm(o.orderStatus || o.status)
    if (ord === "cancelled") return false
    return true
  }

  const complimentary = orders.filter((o) => realBill(o) && o.isComplimentary)
  const nonChargeable = orders.filter((o) => realBill(o) && o.isNonChargeable && !o.isComplimentary)

  // Real bills only: has an invoiceNumber, not a KOT, not cancelled, not a give-away
  const bills = orders.filter((o) => realBill(o) && !isGiveaway(o))

  const unsettled = bills.filter((b) => norm(b.paymentStatus) === "billed")
  const settled = bills.filter((b) => norm(b.paymentStatus) === "completed")

  // Open KOTs — kitchen tickets still awaiting a bill
  const openKOTs = orders.filter((o) => {
    if (!o.kotNumber) return false
    const pay = norm(o.paymentStatus)
    const ord = norm(o.orderStatus || o.status)
    if (ord === "cancelled") return false
    // 'pending' KOTs are still running; 'consolidated' ones are already billed
    return pay === "pending"
  })

  const amountOf = (b) => Number(b.grandTotal != null ? b.grandTotal : b.totalAmount || 0)

  const paymentBreakdown = { cash: 0, upi: 0, card: 0 }
  settled.forEach((b) => {
    // Prefer the recorded settlement method; fall back to paymentMethod for
    // legacy bills that were completed before settlement existed.
    let method = norm(b.settlementDetails?.method) || norm(b.paymentMethod)
    if (method === "qr") method = "upi" // legacy alias
    if (!["cash", "upi", "card"].includes(method)) method = "cash"
    paymentBreakdown[method] += amountOf(b)
  })

  // Round to 2dp — summing floats produces artefacts like 6065.549999999999
  const round2 = (n) => Number(Number(n || 0).toFixed(2))

  paymentBreakdown.cash = round2(paymentBreakdown.cash)
  paymentBreakdown.upi = round2(paymentBreakdown.upi)
  paymentBreakdown.card = round2(paymentBreakdown.card)

  const totals = {
    billCount: settled.length,
    grossSales: round2(settled.reduce((s, b) => s + amountOf(b), 0)),
    gst: round2(settled.reduce((s, b) => s + Number(b.gstAmount || 0), 0)),
    discount: round2(settled.reduce((s, b) => s + Number(b.discountAmount || 0), 0)),
  }

  // Give-away figures — shown as separate lines on the Z-Report so "spent on
  // customers" and "consumed internally" never get mixed into sales.
  const ncByType = { staff: 0, management: 0, tasting: 0, wastage: 0, other: 0 }
  nonChargeable.forEach((b) => {
    const t = ["staff", "management", "tasting", "wastage"].includes(b.nonChargeableType)
      ? b.nonChargeableType
      : "other"
    ncByType[t] = round2(ncByType[t] + amountOfRaw(b))
  })

  const giveaways = {
    complimentary: {
      count: complimentary.length,
      amount: round2(complimentary.reduce((s, b) => s + amountOfRaw(b), 0)),
    },
    nonChargeable: {
      count: nonChargeable.length,
      amount: round2(nonChargeable.reduce((s, b) => s + amountOfRaw(b), 0)),
      byType: ncByType,
    },
  }

  return {
    totals,
    paymentBreakdown,
    giveaways,
    cashExpected: paymentBreakdown.cash,
    unsettledBills: unsettled.map((b) => ({
      id: b._id,
      invoiceNumber: b.invoiceNumber,
      tableNumber: b.tableNumber,
      amount: amountOf(b),
    })),
    openKOTs: openKOTs.map((k) => ({
      id: k._id,
      kotNumber: k.kotNumber,
      tableNumber: k.tableNumber,
    })),
  }
}

// ─── GET /billing-session/current?branchId=&date= ────────────────────────────
// Returns the session for the day (or null if never opened) plus live counts so
// the UI can show the Open/Closed badge and enable/disable the close button.
exports.getCurrentSession = asyncHandler(async (req, res) => {
  const { branchId } = req.query
  const dateKey = req.query.date || localDateKey()

  if (!branchId) {
    res.status(400)
    throw new Error("branchId is required")
  }

  const session = await BillingSession.findOne({ branchId, date: dateKey }).lean()
  const figures = await computeDayFigures(branchId, dateKey)

  res.status(200).json({
    success: true,
    date: dateKey,
    session: session || null,
    // 'open' when no session exists yet — billing is allowed, it just hasn't
    // been formally opened (it auto-opens on the first bill).
    status: session?.status || "open",
    canClose: figures.unsettledBills.length === 0 && figures.openKOTs.length === 0,
    unsettledCount: figures.unsettledBills.length,
    openKOTCount: figures.openKOTs.length,
    live: figures,
  })
})

// ─── GET /billing-session/preview-close?branchId=&date= ──────────────────────
// The numbers the cashier sees in the confirmation dialog before closing.
exports.previewClose = asyncHandler(async (req, res) => {
  const { branchId } = req.query
  const dateKey = req.query.date || localDateKey()

  if (!branchId) {
    res.status(400)
    throw new Error("branchId is required")
  }

  const existing = await BillingSession.findOne({ branchId, date: dateKey }).lean()
  if (existing?.status === "closed") {
    res.status(400)
    throw new Error(`Billing for ${dateKey} is already closed`)
  }

  const figures = await computeDayFigures(branchId, dateKey)

  res.status(200).json({
    success: true,
    date: dateKey,
    canClose: figures.unsettledBills.length === 0 && figures.openKOTs.length === 0,
    ...figures,
  })
})

// ─── POST /billing-session/open ──────────────────────────────────────────────
// Explicitly open a day. Idempotent — returns the existing session if already open.
exports.openSession = asyncHandler(async (req, res) => {
  const { branchId, openedBy } = req.body
  const dateKey = req.body.date || localDateKey()

  if (!branchId) {
    res.status(400)
    throw new Error("branchId is required")
  }

  const existing = await BillingSession.findOne({ branchId, date: dateKey })
  if (existing) {
    if (existing.status === "open") {
      return res.status(200).json({
        success: true,
        message: "Billing is already open",
        session: existing,
      })
    }
    res.status(400)
    throw new Error(`Billing for ${dateKey} is closed. Reopen it instead.`)
  }

  let branchName = null
  try {
    const branch = await Branch.findById(branchId).select("name").lean()
    branchName = branch?.name || null
  } catch (_) {
    // Branch lookup is best-effort only
  }

  const session = await BillingSession.create({
    branchId,
    branchName,
    date: dateKey,
    status: "open",
    openedAt: new Date(),
    openedBy: openedBy || null,
  })

  res.status(201).json({
    success: true,
    message: "Billing opened",
    session,
  })
})

// ─── POST /billing-session/close ─────────────────────────────────────────────
// Hard validation, then freeze the Z-Report.
exports.closeSession = asyncHandler(async (req, res) => {
  const { branchId, closedBy, cashDeclared, notes } = req.body
  const dateKey = req.body.date || localDateKey()

  if (!branchId) {
    res.status(400)
    throw new Error("branchId is required")
  }

  const existing = await BillingSession.findOne({ branchId, date: dateKey })
  if (existing?.status === "closed") {
    res.status(400)
    throw new Error(`Billing for ${dateKey} is already closed`)
  }

  const figures = await computeDayFigures(branchId, dateKey)

  // Gate 1 — every bill must be settled
  if (figures.unsettledBills.length > 0) {
    res.status(400)
    throw new Error(
      `Cannot close billing: ${figures.unsettledBills.length} bill(s) are not settled yet (` +
        figures.unsettledBills.map((b) => b.invoiceNumber).join(", ") +
        ")"
    )
  }

  // Gate 2 — no kitchen ticket may still be running
  if (figures.openKOTs.length > 0) {
    res.status(400)
    throw new Error(
      `Cannot close billing: ${figures.openKOTs.length} KOT(s) are still open (` +
        figures.openKOTs.map((k) => k.kotNumber || k.tableNumber).join(", ") +
        ")"
    )
  }

  const declared = Number(cashDeclared || 0)
  const expected = Number(figures.cashExpected || 0)

  let branchName = existing?.branchName || null
  if (!branchName) {
    try {
      const branch = await Branch.findById(branchId).select("name").lean()
      branchName = branch?.name || null
    } catch (_) {
      // best-effort
    }
  }

  const payload = {
    branchId,
    branchName,
    date: dateKey,
    status: "closed",
    closedAt: new Date(),
    closedBy: closedBy || null,
    totals: figures.totals,
    paymentBreakdown: figures.paymentBreakdown,
    giveaways: figures.giveaways,
    cashExpected: expected,
    cashDeclared: declared,
    cashVariance: Number((declared - expected).toFixed(2)),
    notes: notes || null,
  }

  // Upsert so a day that was never explicitly opened can still be closed
  const session = await BillingSession.findOneAndUpdate(
    { branchId, date: dateKey },
    {
      $set: payload,
      $setOnInsert: { openedAt: new Date(), openedBy: closedBy || null },
    },
    { new: true, upsert: true, runValidators: true }
  )

  res.status(200).json({
    success: true,
    message: "Billing closed",
    session,
  })
})

// ─── POST /billing-session/reopen ────────────────────────────────────────────
// Escape hatch for an accidental close. Records who and why.
exports.reopenSession = asyncHandler(async (req, res) => {
  const { branchId, reopenedBy, reason } = req.body
  const dateKey = req.body.date || localDateKey()

  if (!branchId) {
    res.status(400)
    throw new Error("branchId is required")
  }
  if (!reason || !String(reason).trim()) {
    res.status(400)
    throw new Error("A reason is required to reopen billing")
  }

  const session = await BillingSession.findOne({ branchId, date: dateKey })
  if (!session) {
    res.status(404)
    throw new Error(`No billing session found for ${dateKey}`)
  }
  if (session.status === "open") {
    res.status(400)
    throw new Error("Billing is already open")
  }

  session.status = "open"
  session.closedAt = null
  session.closedBy = null
  session.reopenHistory.push({
    reopenedAt: new Date(),
    reopenedBy: reopenedBy || null,
    reason: String(reason).trim(),
  })

  await session.save()

  res.status(200).json({
    success: true,
    message: "Billing reopened",
    session,
  })
})

// ─── GET /billing-session?branchId=&from=&to= ────────────────────────────────
// Past Z-Reports, newest first.
exports.listSessions = asyncHandler(async (req, res) => {
  const { branchId, from, to, limit = 60 } = req.query

  const query = {}
  if (branchId) query.branchId = branchId
  if (from || to) {
    query.date = {}
    if (from) query.date.$gte = from
    if (to) query.date.$lte = to
  }

  const sessions = await BillingSession.find(query)
    .sort({ date: -1 })
    .limit(Math.min(Number(limit) || 60, 365))
    .lean()

  res.status(200).json({ success: true, count: sessions.length, sessions })
})

// Exported for use by the bill-creation guard in counterOrderController
exports._helpers = { localDateKey, computeDayFigures }
