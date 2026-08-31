/**
 * TEMPORARY migration — makes the duplicate-bill unique index possible.
 *
 *   1. Backfills `businessDay` on every existing order
 *   2. Reports duplicate bill groups (same branch + business day + invoice)
 *   3. With --apply: keeps the OLDEST of each group, deletes the rest, then
 *      builds the unique index
 *
 * Run without --apply first to see exactly what it would do.
 */
process.env.TZ = process.env.TZ || "Asia/Kolkata"
require("dotenv").config()
const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")

const APPLY = process.argv.includes("--apply")

async function main() {
  await mongoose.connect(process.env.MONGO_URI)
  const CounterOrder = require("./model/counterOrderModel")
  const { businessDayKey } = require("./utils/businessDay")

  console.log(APPLY ? "MODE: APPLY (will modify data)\n" : "MODE: DRY RUN (no changes)\n")

  // ── 1. Backfill businessDay ──────────────────────────────────────────────
  const missing = await CounterOrder.find({
    $or: [{ businessDay: null }, { businessDay: { $exists: false } }],
  })
    .select("_id createdAt")
    .lean()

  console.log(`Orders needing businessDay backfill: ${missing.length}`)
  if (APPLY && missing.length > 0) {
    const ops = missing.map((o) => ({
      updateOne: {
        filter: { _id: o._id },
        update: { $set: { businessDay: businessDayKey(o.createdAt) } },
      },
    }))
    for (let i = 0; i < ops.length; i += 500) {
      await CounterOrder.bulkWrite(ops.slice(i, i + 500))
    }
    console.log("  backfilled")
  }
  const bills = await CounterOrder.find({
    invoiceNumber: { $type: "string", $ne: "" },
    $or: [{ kotNumber: null }, { kotNumber: { $exists: false } }, { kotNumber: "" }],
  })
    .select("_id invoiceNumber branch createdAt grandTotal totalAmount paymentStatus")
    .sort({ createdAt: 1 })
    .lean()
  const groups = {}
  bills.forEach((b) => {
    const k = `${b.branch}|${businessDayKey(b.createdAt)}|${b.invoiceNumber}`
    groups[k] = groups[k] || []
    groups[k].push(b)
  })
  const toDelete = []
  let phantom = 0
  dups.forEach(([k, v]) => {
    const [, day, inv] = k.split("|")
    const amt = Number(v[0].grandTotal ?? v[0].totalAmount ?? 0)
    phantom += (v.length - 1) * amt
    console.log(`  ${day} invoice ${inv}: ${v.length} copies @ Rs${amt} — keeping oldest, deleting ${v.length - 1}`)
    // v is sorted oldest-first; keep [0]
    v.slice(1).forEach((d) => toDelete.push(d._id))
  })
  if (APPLY && toDelete.length > 0) {
    // Back up the ones being deleted
    const doomed = await CounterOrder.find({ _id: { $in: toDelete } }).lean()
    const dir = path.join(__dirname, "_backups")
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `duplicate-bills-removed-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
    fs.writeFileSync(file, JSON.stringify({ removedAt: new Date().toISOString(), orders: doomed }, null, 2))
    console.log(`\nBackup of deleted duplicates: ${file}`)

    const r = await CounterOrder.deleteMany({ _id: { $in: toDelete } })
    console.log(`Deleted: ${r.deletedCount}`)
  }
  if (APPLY) {
    try {
      await CounterOrder.collection.createIndex(
        { branch: 1, businessDay: 1, invoiceNumber: 1 },
        {
          unique: true,
          name: "uniq_bill_per_branch_day",
          partialFilterExpression: {
            invoiceNumber: { $type: "string" },
            businessDay: { $type: "string" },
          },
        }
      )
      console.log("\nUnique index created: uniq_bill_per_branch_day")
    } catch (e) {
      console.log("\nIndex creation failed:", e.message)
    }
  }
  await mongoose.disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
