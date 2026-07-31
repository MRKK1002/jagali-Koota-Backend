# Member Order → KOT → Sales Report Integration

## ✅ Implementation Complete

This document explains the changes made to integrate **Member App orders** into the **KOT (Kitchen Order Ticket) system** and **Sales Reports**.

---

## 🎯 What Was Done

### **STEP 1 — Updated MemberOrder Model**
**File:** `membership/models/MemberOrder.js`

**Added fields:**
- `branchId` — Branch reference for the order
- `branchName` — Branch name for display
- `kotNumber` — KOT reference (links to StaffOrder)
- `memberName` — Member's name (for KOT display)
- `memberPhone` — Member's phone (for KOT display)

---

### **STEP 2 — Rewrote Member Order Controller**
**File:** `membership/controllers/memberOrderController.js`

#### **Auto-create KOT on order placement:**
- When member places order → `MemberOrder` saved
- **Immediately** creates a `StaffOrder` (KOT) with:
  - `orderType`: uses `isGuestOrder: true` flag (no userId needed)
  - `tableNumber`: `"Member App"`
  - `customerName`: member's name
  - `customerMobile`: member's phone
  - `kotNumber`: auto-generated via `KotCounter.getNextKotNumber(branchId)`
  - `paymentMethod`: `"wallet"`
  - `paymentStatus`: `"pending"` (wallet not deducted yet)

#### **Auto-deduct wallet on completion:**
- When admin/kitchen marks order `completed` → wallet is automatically deducted
- Linked KOT (`StaffOrder`) also marked as `completed`
- Member cannot cancel after completion

**Non-blocking design:**
- If KOT creation fails, order still succeeds (member gets confirmation, KOT tries again on next request)

---

### **STEP 3 — Created Sales Report Controller**
**File:** `controller/salesReportController.js`

**Includes 4 order sources:**
1. **CounterOrder** (counter/darshini orders)
2. **StaffOrder** (staff/guest/restaurant orders)
3. **MemberOrder** (member app orders) ← **NEW**
4. Tagged as `orderType: "member"` in reports

**Routes:**
- `GET /api/v1/hotel/sales-report` — main report
- `GET /api/v1/hotel/sales-report/branches` — list branches
- `GET /api/v1/hotel/sales-report/order-types` — list order types (now includes "member")

**File:** `routes/salesReportRoutes.js` ← created
**Registered in:** `server.js`

---

## 📊 Flow Diagram

```
Member browses menu → adds to cart → places order
         ↓
    POST /member-orders
         ↓
MemberOrder created (status: "pending", payment: "pending")
         ↓
StaffOrder (KOT) auto-created
  - orderType: guest (uses isGuestOrder flag)
  - tableNumber: "Member App"
  - kotNumber: RES-KOT-001, RES-KOT-002, etc.
  - paymentStatus: "pending"
         ↓
Kitchen Display shows order immediately
         ↓
Kitchen marks items Ready → marks order Complete
         ↓
MemberOrder updated to "completed"
Member wallet deducted automatically
         ↓
Sales report includes it as "member" order type
```

---

## 🔧 No Breaking Changes

**Other features unaffected:**
- Counter orders → still work as before
- Staff orders → still work as before
- Guest orders (QR) → still work as before
- Existing KOT system → still works exactly the same
- Sales report for counter/staff/guest → unchanged

**Only additions:**
- Member orders now visible in Kitchen Display
- Member orders now in Sales Report (tagged as "member")
- Wallet deduction is automatic on completion

---

## 🧪 Testing Checklist

### Member App:
- [ ] Place order from member app
- [ ] Check that order appears in kitchen display
- [ ] Kitchen marks order complete
- [ ] Verify wallet balance deducted
- [ ] Check order status changes to "completed"

### Sales Report:
- [ ] Filter by "member" order type
- [ ] Verify member orders appear with correct quantities/revenue
- [ ] Check "All Orders" includes member orders

### KOT:
- [ ] KOT shows "Member App" as table
- [ ] KOT shows member name as customer
- [ ] KOT number is sequential (RES-KOT-###)

---

## 📝 API Endpoints

### Member Orders (existing, now with KOT):
```
POST   /api/v1/hotel/member-orders           Place order (auto-creates KOT)
GET    /api/v1/hotel/member-orders/my-orders Get member's orders
GET    /api/v1/hotel/member-orders/all       Get all orders (admin)
PUT    /api/v1/hotel/member-orders/:id/complete  Complete & deduct wallet
PUT    /api/v1/hotel/member-orders/:id/status    Update status
PUT    /api/v1/hotel/member-orders/:id/cancel    Cancel order
```

### Sales Report (NEW):
```
GET /api/v1/hotel/sales-report?period=daily&branch=all&orderType=member
GET /api/v1/hotel/sales-report/branches
GET /api/v1/hotel/sales-report/order-types
```

---

## 🚀 Deployment Notes

**No database migrations needed** — fields are added with defaults, backward compatible.

**Environment variables** — none added.

**Restart required** — yes (new routes registered in `server.js`).

---

## 🐛 Troubleshooting

**KOT not appearing in kitchen?**
- Check that `StaffOrder` was created (search by `kotNumber` in DB)
- Check `branchId` is valid in `MemberOrder`

**Wallet not deducting?**
- Check `MemberOrder.status === "completed"`
- Check `Member.walletBalance` has sufficient funds

**Sales report missing member orders?**
- Check `MemberOrder.status !== "cancelled"`
- Use filter `orderType=member` in query params

---

## 👨‍💻 Files Modified/Created

### Modified:
- `membership/models/MemberOrder.js`
- `server.js`

### Created:
- `membership/controllers/memberOrderController.js` (rewritten)
- `controller/salesReportController.js`
- `routes/salesReportRoutes.js`

---

**Implementation Date:** 2026-07-31  
**Backend:** jagali-Koota-Backend (main backend)
