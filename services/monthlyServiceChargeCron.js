/**
 * Monthly Service Charge Cron
 * Runs on the 1st of every month and deducts monthlyServiceCharge from each member's wallet.
 * Sends push notification to each member after deduction.
 */
const cron = require("node-cron");
const Member = require("../membership/models/Member");
const WalletTransaction = require("../membership/models/WalletTransaction");
const SportSubscription = require("../membership/models/SportSubscription");
const { sendToDevice } = require("./firebaseNotification");

// Birthday discount percentage
const BIRTHDAY_DISCOUNT = 20;
// Days before subscription end to send the expiry reminder
const EXPIRY_REMINDER_DAYS = 3;
// Run daily at 08:00 AM — wish members whose birthday is today
const startBirthdayCron = () => {
  cron.schedule("0 8 * * *", async () => {
    console.log("[CRON] 🎂 Checking for member birthdays...");
    try {
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();

      const members = await Member.find({
        isActive: true,
        dateOfBirth: { $ne: null },
      }).select("name email dateOfBirth fcmToken");

      const birthdayMembers = members.filter((m) => {
        if (!m.dateOfBirth) return false;
        const dob = new Date(m.dateOfBirth);
        return dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay;
      });

      console.log(`[CRON] 🎂 ${birthdayMembers.length} birthday(s) today`);

      for (const member of birthdayMembers) {
        // Push notification
        if (member.fcmToken) {
          sendToDevice(
            member.fcmToken,
            "Happy Birthday! 🎂",
            `Wishing you a wonderful day, ${member.name}! Enjoy ${BIRTHDAY_DISCOUNT}% OFF on your bill today. 🎁`,
            { type: "birthday", discount: String(BIRTHDAY_DISCOUNT) }
          ).catch(() => {});
        }
        // Email
        if (member.email) {
          const { sendBirthdayEmail } = require("./emailService");
          sendBirthdayEmail(member.email, member.name, BIRTHDAY_DISCOUNT).catch((e) =>
            console.warn("[Birthday Email] Failed:", e.message)
          );
        }
      }
    } catch (error) {
      console.error("[CRON] Birthday cron error:", error.message);
    }
  });

  console.log("⏰ Birthday cron scheduled (daily 08:00 AM)");
};
// Run at 00:05 AM on the 1st of every month
const startMonthlyServiceChargeCron = () => {
  cron.schedule("5 0 1 * *", async () => {
    console.log("[CRON] 📅 Running monthly service charge deduction...");

    try {
      // Find all active members with a service charge > 0
      const members = await Member.find({
        isActive: true,
        monthlyServiceCharge: { $gt: 0 },
      }).select("_id name phone walletBalance monthlyServiceCharge fcmToken");

      console.log(`[CRON] Found ${members.length} members with service charge`);

      let successCount = 0;
      let failCount = 0;

      for (const member of members) {
        try {
          const charge = member.monthlyServiceCharge;

          // Check if wallet has enough balance
          if ((member.walletBalance || 0) < charge) {
            console.log(`[CRON] ⚠️ ${member.name}: Insufficient balance (₹${member.walletBalance} < ₹${charge})`);
            
            // Still notify them about the failed deduction
            if (member.fcmToken) {
              sendToDevice(
                member.fcmToken,
                "Service Charge Failed",
                `Monthly service charge of ₹${charge} could not be deducted. Insufficient wallet balance (₹${(member.walletBalance || 0).toFixed(2)}). Please top up.`,
                { type: "service_charge_failed" }
              ).catch(() => {});
            }
            failCount++;
            continue;
          }

          // Deduct from wallet
          const transaction = await WalletTransaction.createTransaction({
            memberId: member._id,
            type: "debit",
            amount: charge,
            description: `Monthly service charge — ${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`,
            createdBy: "system",
            metadata: {
              source: "monthly_service_charge",
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
            },
          });

          console.log(`[CRON] ✅ ${member.name}: ₹${charge} deducted. New balance: ₹${transaction.balanceAfter}`);

          // Send notification
          if (member.fcmToken) {
            sendToDevice(
              member.fcmToken,
              "Monthly Service Charge",
              `₹${charge.toFixed(2)} has been deducted from your wallet as monthly service charge. Balance: ₹${transaction.balanceAfter.toFixed(2)}`,
              { type: "service_charge_deducted", amount: String(charge) }
            ).catch(() => {});
          }

          successCount++;
        } catch (memberErr) {
          console.error(`[CRON] ❌ Error processing ${member.name}:`, memberErr.message);
          failCount++;
        }
      }

      console.log(`[CRON] ✅ Monthly service charge complete: ${successCount} success, ${failCount} failed`);
    } catch (error) {
      console.error("[CRON] ❌ Monthly service charge cron error:", error.message);
    }
  });

  console.log("⏰ Monthly service charge cron scheduled (1st of every month, 00:05 AM)");
};
// Run daily at 09:00 AM — remind members whose subscription ends in EXPIRY_REMINDER_DAYS
const startExpiryReminderCron = () => {
  cron.schedule("0 9 * * *", async () => {
    console.log("[CRON] ⏳ Checking for expiring subscriptions...");
    try {
      // Window: subscriptions ending exactly EXPIRY_REMINDER_DAYS days from now (that calendar day)
      const now = new Date();
      const target = new Date(now);
      target.setDate(target.getDate() + EXPIRY_REMINDER_DAYS);
      const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999);

      const subs = await SportSubscription.find({
        status: "active",
        endDate: { $gte: dayStart, $lte: dayEnd },
      })
        .populate("memberId", "name email fcmToken isActive")
        .populate("sportId", "name");

      console.log(`[CRON] ⏳ ${subs.length} subscription(s) expiring in ${EXPIRY_REMINDER_DAYS} days`);

      for (const sub of subs) {
        const member = sub.memberId;
        if (!member || member.isActive === false) continue;
        const sportName = sub.sportId?.name || "your sport";

        // Push
        if (member.fcmToken) {
          sendToDevice(
            member.fcmToken,
            "Subscription Expiring Soon ⏳",
            `Your ${sportName} subscription ends in ${EXPIRY_REMINDER_DAYS} days. Renew now to keep playing!`,
            { type: "subscription_expiry", sport: sportName, daysLeft: String(EXPIRY_REMINDER_DAYS) }
          ).catch(() => {});
        }
        // Email
        if (member.email) {
          const { sendExpiryReminderEmail } = require("./emailService");
          sendExpiryReminderEmail(member.email, member.name, sportName, sub.endDate, EXPIRY_REMINDER_DAYS).catch((e) =>
            console.warn("[Expiry Email] Failed:", e.message)
          );
        }
      }
    } catch (error) {
      console.error("[CRON] Expiry reminder cron error:", error.message);
    }
  });

  console.log("⏰ Expiry reminder cron scheduled (daily 09:00 AM)");
};
// Run daily at 08:00 AM — wish members on their membership anniversary (joiningDate)
const startAnniversaryCron = () => {
  cron.schedule("0 8 * * *", async () => {
    console.log("[CRON] 🥂 Checking for membership anniversaries...");
    try {
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();

      const members = await Member.find({
        isActive: true,
        joiningDate: { $ne: null },
      }).select("name email joiningDate fcmToken");

      const anniversaryMembers = members.filter((m) => {
        if (!m.joiningDate) return false;
        const jd = new Date(m.joiningDate);
        // Only celebrate on/after the first full year
        if (jd.getFullYear() >= today.getFullYear()) return false;
        return jd.getMonth() + 1 === todayMonth && jd.getDate() === todayDay;
      });

      console.log(`[CRON] 🥂 ${anniversaryMembers.length} anniversary(ies) today`);

      for (const member of anniversaryMembers) {
        const years = today.getFullYear() - new Date(member.joiningDate).getFullYear();

        if (member.fcmToken) {
          sendToDevice(
            member.fcmToken,
            "Happy Anniversary! 🥂",
            `It's been ${years} year${years !== 1 ? "s" : ""} with Jagali Koota, ${member.name}. Thank you for being with us!`,
            { type: "anniversary", years: String(years) }
          ).catch(() => {});
        }
        if (member.email) {
          const { sendAnniversaryEmail } = require("./emailService");
          sendAnniversaryEmail(member.email, member.name, years).catch((e) =>
            console.warn("[Anniversary Email] Failed:", e.message)
          );
        }
      }
    } catch (error) {
      console.error("[CRON] Anniversary cron error:", error.message);
    }
  });

  console.log("⏰ Anniversary cron scheduled (daily 08:00 AM)");
};
// Run at 06:00 AM on the 1st of every month — email each member last month's statement
const startMonthlyStatementCron = () => {
  cron.schedule("0 6 1 * *", async () => {
    console.log("[CRON] 📊 Generating monthly statements...");
    try {
      // Previous month window
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      const monthLabel = monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

      const members = await Member.find({ isActive: true }).select("name email walletBalance");

      let sent = 0;
      for (const member of members) {
        if (!member.email) continue;

        const txns = await WalletTransaction.find({
          memberId: member._id,
          createdAt: { $gte: monthStart, $lte: monthEnd },
        }).select("type amount metadata description");

        if (txns.length === 0) continue; // No activity — skip

        let totalSpent = 0;
        let topUps = 0;
        let ordersCount = 0;
        for (const t of txns) {
          if (t.type === "debit") {
            totalSpent += t.amount;
            const src = t.metadata?.source;
            // Count order-type debits (exclude system service charge)
            if (src !== "monthly_service_charge") ordersCount++;
          } else if (t.type === "credit") {
            topUps += t.amount;
          }
        }

        const { sendMonthlyStatementEmail } = require("./emailService");
        sendMonthlyStatementEmail(member.email, member.name, {
          monthLabel,
          totalSpent,
          ordersCount,
          walletBalance: member.walletBalance || 0,
          topUps,
        }).catch((e) => console.warn("[Statement Email] Failed:", e.message));
        sent++;
      }

      console.log(`[CRON] 📊 Monthly statements queued for ${sent} member(s) — ${monthLabel}`);
    } catch (error) {
      console.error("[CRON] Monthly statement cron error:", error.message);
    }
  });

  console.log("⏰ Monthly statement cron scheduled (1st of every month, 06:00 AM)");
};
module.exports = {
  startMonthlyServiceChargeCron,
  startBirthdayCron,
  startExpiryReminderCron,
  startAnniversaryCron,
  startMonthlyStatementCron,
};
