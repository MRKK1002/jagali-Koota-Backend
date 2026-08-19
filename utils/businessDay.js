/**
 * Business day helpers.
 *
 * A restaurant that serves past midnight must not have its night split across
 * two sales reports. So the "business day" does not end at midnight — it ends
 * at BUSINESS_DAY_CUTOFF_HOUR the next morning.
 *
 * With a cutoff of 3:
 *   18 Aug 11:30 PM  -> business day 2026-08-18
 *   19 Aug 12:30 AM  -> business day 2026-08-18   (still last night's service)
 *   19 Aug 02:59 AM  -> business day 2026-08-18
 *   19 Aug 03:00 AM  -> business day 2026-08-19   (new day starts)
 *
 * Both the billing-session Z-Report and the sales-report date filter use these
 * helpers, so the two can never disagree about which day a bill belongs to.
 */

const CUTOFF_HOUR = (() => {
  const raw = parseInt(process.env.BUSINESS_DAY_CUTOFF_HOUR, 10)
  if (Number.isNaN(raw) || raw < 0 || raw > 23) return 3
  return raw
})()

const pad = (n) => String(n).padStart(2, "0")

/** Format a Date as YYYY-MM-DD in server local time. */
const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * The business day a given moment belongs to.
 * Anything before the cutoff hour rolls back to the previous calendar date.
 */
const businessDayKey = (d = new Date()) => {
  const shifted = new Date(d.getTime())
  if (shifted.getHours() < CUTOFF_HOUR) {
    shifted.setDate(shifted.getDate() - 1)
  }
  return toDateKey(shifted)
}

/** True for a bare calendar date like "2026-08-18" (no time component). */
const isDateOnly = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim())

/**
 * Real timestamp window for a business-day key.
 * Runs from cutoff on that date to just before cutoff the next date.
 * e.g. 2026-08-18 with cutoff 3 -> [18 Aug 03:00:00.000, 19 Aug 02:59:59.999]
 *
 * Accepts EITHER:
 *   - "2026-08-18"                -> business-day window (cutoff to cutoff)
 *   - "2026-08-17T18:30:00.000Z"  -> used verbatim; the caller already computed
 *                                    an exact instant, so re-deriving a window
 *                                    would silently move their boundary.
 *
 * Returns null start/end for unparseable input so callers can skip the filter
 * instead of handing Mongoose an Invalid Date (which throws a CastError).
 */
const businessDayRange = (dateKey) => {
  const raw = String(dateKey || "").trim()

  if (isDateOnly(raw)) {
    const [y, m, d] = raw.split("-").map(Number)
    const start = new Date(y, m - 1, d, CUTOFF_HOUR, 0, 0, 0)
    const end = new Date(y, m - 1, d + 1, CUTOFF_HOUR, 0, 0, 0)
    end.setMilliseconds(end.getMilliseconds() - 1)
    return { start, end }
  }

  // Full timestamp (or anything else parseable) — honour it as given
  const exact = new Date(raw)
  if (!Number.isNaN(exact.valueOf())) {
    return { start: exact, end: exact, exact: true }
  }

  return { start: null, end: null, invalid: true }
}

module.exports = {
  CUTOFF_HOUR,
  toDateKey,
  businessDayKey,
  businessDayRange,
  isDateOnly,
}
