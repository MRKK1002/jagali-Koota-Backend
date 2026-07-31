const asyncHandler = require("express-async-handler");
const CounterOrder = require("../model/counterOrderModel");
const StaffOrder = require("../model/staffOrderModel");
const Branch = require("../model/Branch");
const MemberOrder = require("../membership/models/MemberOrder");
const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────
// GET /api/v1/hotel/sales-report
// Query params: period, from, to, branch, orderType
// ─────────────────────────────────────────────────────────────
exports.getSalesReport = asyncHandler(async (req, res) => {
  const { period, from, to, branch, orderType } = req.query;

  // ── Build date filter ──────────────────────────────────────
  let dateFilter = {};
  const now = new Date();

  if (period === "daily") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    dateFilter = { $gte: start, $lte: end };
  } else if (period === "weekly") {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);
    dateFilter = { $gte: weekStart, $lte: weekEnd };
  } else if (period === "monthly") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const monthEnd = new Date(now);
    monthEnd.setHours(23, 59, 59, 999);
    dateFilter = { $gte: monthStart, $lte: monthEnd };
  } else if (period === "custom" && from && to) {
    dateFilter = { $gte: new Date(from), $lte: new Date(to) };
  }

  // ── Filters per collection ────────────────────────────────
  const counterFilter = {
    createdAt: dateFilter,
    ...(branch && branch !== "all" ? { branch } : {}),
    orderStatus: { $ne: "cancelled" },
  };

  const staffFilter = {
    createdAt: dateFilter,
    ...(branch && branch !== "all" ? { branchId: branch } : {}),
    status: { $ne: "cancelled" },
    ...(orderType === "guest"
      ? { isGuestOrder: true }
      : orderType === "staff"
      ? { isGuestOrder: false }
      : {}),
  };

  const memberFilter = {
    createdAt: dateFilter,
    ...(branch && branch !== "all" ? { branchId: branch } : {}),
    status: { $ne: "cancelled" },
  };

  // ── Aggregation pipeline helper (same shape for all) ─────
  const itemPipeline = (branchLocalField, branchForeignField) => [
    { $unwind: "$items" },
    {
      $lookup: {
        from: "branches",
        localField: branchLocalField,
        foreignField: branchForeignField,
        as: "branchData",
      },
    },
    { $unwind: { path: "$branchData", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: {
          itemName: "$items.name",
          branch: "$branchData.name",
        },
        quantitySold: { $sum: "$items.quantity" },
        totalRevenue: {
          $sum: { $multiply: ["$items.quantity", "$items.price"] },
        },
        unitPrice: { $avg: "$items.price" },
        orderDates: { $push: "$createdAt" },
      },
    },
  ];

  // ── Run aggregations ──────────────────────────────────────
  let salesData = [];

  // Counter Orders
  if (!orderType || orderType === "all" || orderType === "counter") {
    const counterData = await CounterOrder.aggregate([
      { $match: counterFilter },
      ...itemPipeline("branch", "_id"),
    ]);
    salesData = [
      ...salesData,
      ...counterData.map((d) => ({ ...d, orderType: "counter" })),
    ];
  }

  // Staff / Guest Orders
  if (
    !orderType ||
    orderType === "all" ||
    orderType === "staff" ||
    orderType === "guest"
  ) {
    const staffData = await StaffOrder.aggregate([
      { $match: staffFilter },
      ...itemPipeline("branchId", "_id"),
    ]);
    salesData = [
      ...salesData,
      ...staffData.map((d) => ({
        ...d,
        orderType: d._id?.isGuestOrder ? "guest" : "staff",
      })),
    ];
  }

  // Member Orders
  if (!orderType || orderType === "all" || orderType === "member") {
    const memberData = await MemberOrder.aggregate([
      { $match: memberFilter },
      ...itemPipeline("branchId", "_id"),
    ]);
    salesData = [
      ...salesData,
      ...memberData.map((d) => ({ ...d, orderType: "member" })),
    ];
  }

  // ── Combine & format ──────────────────────────────────────
  const combined = salesData.reduce((acc, curr) => {
    const key = `${curr._id.itemName}-${curr._id.branch}-${curr.orderType}`;
    if (!acc[key]) {
      acc[key] = {
        itemName: curr._id.itemName || "Unknown Item",
        branch: curr._id.branch || "Unknown Branch",
        orderType: curr.orderType,
        quantitySold: 0,
        totalRevenue: 0,
        unitPrice: 0,
        orderDates: [],
      };
    }
    acc[key].quantitySold += curr.quantitySold;
    acc[key].totalRevenue += curr.totalRevenue;
    acc[key].unitPrice =
      acc[key].totalRevenue / acc[key].quantitySold;
    acc[key].orderDates.push(...(curr.orderDates || []));
    return acc;
  }, {});

  const result = Object.values(combined).map((item) => ({
    itemName: item.itemName,
    branch: item.branch,
    orderType: item.orderType,
    quantitySold: item.quantitySold,
    unitPrice: Number(item.unitPrice.toFixed(2)),
    totalRevenue: Number(item.totalRevenue.toFixed(2)),
    topSellingTime:
      item.orderDates.length > 0
        ? `${new Date(item.orderDates[0]).getHours()}:00 - ${
            new Date(item.orderDates[0]).getHours() + 1
          }:00`
        : "N/A",
  }));

  // Apply final orderType filter if specified
  const filtered =
    orderType && orderType !== "all"
      ? result.filter((r) => r.orderType === orderType)
      : result;

  res.status(200).json(filtered);
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/hotel/sales-report/branches
// ─────────────────────────────────────────────────────────────
exports.getBranches = asyncHandler(async (req, res) => {
  const branches = await Branch.find({}, "name _id");
  res.status(200).json(
    branches.map((b) => ({ id: b._id.toString(), name: b.name }))
  );
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/hotel/sales-report/order-types
// ─────────────────────────────────────────────────────────────
exports.getOrderTypes = asyncHandler(async (req, res) => {
  res.status(200).json([
    { id: "counter", name: "Counter Order" },
    { id: "staff",   name: "Staff Order"   },
    { id: "guest",   name: "Guest Order"   },
    { id: "member",  name: "Member Order"  },
  ]);
});
