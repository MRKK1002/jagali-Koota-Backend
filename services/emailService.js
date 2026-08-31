const nodemailer = require("nodemailer");

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Verify connection on startup (non-blocking)
transporter.verify((error) => {
  if (error) {
    console.warn("[Email] SMTP connection issue:", error.message);
  } else {
    console.log("📧 Email service ready");
  }
});

const FROM_NAME = process.env.SMTP_FROM_NAME || "Jagali Koota";

/**
 * Send an OTP email with a branded template
 */
const sendOtpEmail = async (toEmail, name, otp) => {
  const html = `
  <div style="max-width:480px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #eee;border-radius:12px;overflow:hidden;">
    <div style="background:#7a1f1f;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px;">JAGALI KOOTA</h1>
      <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Members' Club</p>
    </div>
    <div style="padding:28px 24px;">
      <p style="font-size:15px;color:#333;margin:0 0 8px;">Hi ${name || "Member"},</p>
      <p style="font-size:14px;color:#555;line-height:1.5;margin:0 0 20px;">
        Use the following One-Time Password (OTP) to reset your password. This code is valid for <b>5 minutes</b>.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;background:#faf2f2;color:#7a1f1f;font-size:32px;font-weight:800;letter-spacing:8px;padding:16px 28px;border-radius:10px;border:1px dashed #d4a5a5;">
          ${otp}
        </span>
      </div>
      <p style="font-size:13px;color:#888;line-height:1.5;margin:0;">
        If you didn't request this, you can safely ignore this email. Never share this code with anyone.
      </p>
    </div>
    <div style="background:#f8f6f3;padding:16px 24px;text-align:center;">
      <p style="font-size:11px;color:#999;margin:0;">© ${new Date().getFullYear()} Jagali Koota, Mysuru</p>
    </div>
  </div>`;

  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: `${otp} is your Jagali Koota password reset code`,
    html,
  });

  console.log(`[Email] OTP sent to ${toEmail}: ${info.messageId}`);
  return info;
};

/**
 * Send a welcome email to a newly registered member with app download link + details
 */
const sendWelcomeMemberEmail = async (toEmail, details) => {
  const { name, phone, membershipId, membershipType, walletBalance } = details;

  // TODO: Replace with your actual Play Store link once published
  const PLAY_STORE_LINK = process.env.MEMBER_APP_PLAYSTORE_LINK || "https://play.google.com/store/apps/details?id=com.jagalikootamemberapp";

  const html = `
  <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #eee;border-radius:12px;overflow:hidden;">
    <div style="background:#7a1f1f;padding:28px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:1px;">JAGALI KOOTA</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Members' Club, Mysuru</p>
    </div>
    <div style="padding:28px 26px;">
      <p style="font-size:16px;color:#333;margin:0 0 8px;">Welcome, ${name}! 🎉</p>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 22px;">
        Your membership has been created. Download the Jagali Koota Member App to complete your
        registration, order food, book events, subscribe to sports, and manage your wallet.
      </p>

      <div style="background:#faf6f4;border-radius:10px;padding:8px 20px;margin-bottom:22px;">
        <div style="padding:12px 0;border-bottom:1px solid #efe6e2;">
          <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Membership ID</div>
          <div style="font-size:16px;font-weight:700;color:#7a1f1f;">${membershipId}</div>
        </div>
        <div style="padding:12px 0;border-bottom:1px solid #efe6e2;">
          <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Membership Type</div>
          <div style="font-size:15px;font-weight:600;color:#333;">${membershipType}</div>
        </div>
        <div style="padding:12px 0;border-bottom:1px solid #efe6e2;">
          <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Registered Phone</div>
          <div style="font-size:15px;font-weight:600;color:#333;">${phone}</div>
        </div>
        <div style="padding:12px 0;border-bottom:1px solid #efe6e2;">
          <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Registered Email</div>
          <div style="font-size:15px;font-weight:600;color:#333;word-break:break-all;">${toEmail}</div>
        </div>
        <div style="padding:12px 0;">
          <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Wallet Balance</div>
          <div style="font-size:18px;font-weight:800;color:#16a34a;">₹${(walletBalance || 0).toFixed(2)}</div>
        </div>
      </div>

      <div style="text-align:center;margin:26px 0;">
        <a href="${PLAY_STORE_LINK}" style="display:inline-block;background:#7a1f1f;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;">
          📲 Download Member App
        </a>
      </div>

      <p style="font-size:13px;color:#777;line-height:1.6;margin:0;">
        <b>How to get started:</b><br/>
        1. Install the app from the link above.<br/>
        2. Open it and log in using your registered phone number: <b>${phone}</b>.<br/>
        3. Complete your registration by setting a password and uploading documents.<br/>
        4. Start ordering, booking, and enjoying member benefits!
      </p>
    </div>
    <div style="background:#f8f6f3;padding:16px 24px;text-align:center;">
      <p style="font-size:11px;color:#999;margin:0;">© ${new Date().getFullYear()} Jagali Koota, Mysuru</p>
    </div>
  </div>`;

  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: `Welcome to Jagali Koota — Your Membership (${membershipId})`,
    html,
  });

  console.log(`[Email] Welcome email sent to ${toEmail}: ${info.messageId}`);
  return info;
};

/**
 * Send a subscription/purchase confirmation email
 * details: { name, title, subtitle, rows: [{label, value}], amount, note }
 */
const sendConfirmationEmail = async (toEmail, details) => {
  const { name, title, subtitle, rows = [], amount, note } = details;

  const rowsHtml = rows
    .map(
      (r) => `
      <div style="padding:12px 0;border-bottom:1px solid #efe6e2;">
        <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">${r.label}</div>
        <div style="font-size:15px;font-weight:600;color:#333;word-break:break-word;">${r.value}</div>
      </div>`
    )
    .join("");

  const html = `
  <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #eee;border-radius:12px;overflow:hidden;">
    <div style="background:#7a1f1f;padding:26px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px;">JAGALI KOOTA</h1>
      <p style="color:rgba(255,255,255,0.85);margin:5px 0 0;font-size:12px;">Members' Club, Mysuru</p>
    </div>
    <div style="padding:28px 26px;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:28px;background:#f0fdf4;color:#16a34a;font-size:28px;">✓</div>
      </div>
      <h2 style="text-align:center;font-size:20px;color:#1a1a1a;margin:0 0 6px;">${title}</h2>
      ${subtitle ? `<p style="text-align:center;font-size:14px;color:#666;margin:0 0 22px;">${subtitle}</p>` : ""}

      <div style="background:#faf6f4;border-radius:10px;padding:8px 20px;margin-bottom:20px;">
        ${rowsHtml}
        ${
          amount !== undefined
            ? `<div style="padding:12px 0;">
                 <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Amount Paid</div>
                 <div style="font-size:18px;font-weight:800;color:#16a34a;">₹${Number(amount).toFixed(2)}</div>
               </div>`
            : ""
        }
      </div>

      ${note ? `<p style="font-size:13px;color:#777;line-height:1.6;margin:0;text-align:center;">${note}</p>` : ""}
    </div>
    <div style="background:#f8f6f3;padding:16px 24px;text-align:center;">
      <p style="font-size:11px;color:#999;margin:0;">© ${new Date().getFullYear()} Jagali Koota, Mysuru</p>
    </div>
  </div>`;

  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: title,
    html,
  });

  console.log(`[Email] Confirmation email sent to ${toEmail}: ${info.messageId}`);
  return info;
};

/**
 * Send a birthday wish email with a discount offer
 */
const sendBirthdayEmail = async (toEmail, name, discountPercent) => {
  const html = `
  <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #eee;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#7a1f1f,#a83232);padding:36px 26px;text-align:center;">
      <div style="font-size:44px;margin-bottom:8px;">🎂🎉</div>
      <h1 style="color:#fff;margin:0;font-size:26px;letter-spacing:0.5px;">Happy Birthday!</h1>
      <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:15px;">${name}</p>
    </div>
    <div style="padding:30px 26px;text-align:center;">
      <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 24px;">
        Wishing you a wonderful day filled with joy and celebration!
        As our valued member, here's a special gift from all of us at Jagali Koota. 🎁
      </p>

      <div style="background:linear-gradient(135deg,#fff7ed,#fef3c7);border:2px dashed #d97706;border-radius:14px;padding:24px;margin-bottom:24px;">
        <div style="font-size:13px;color:#92400e;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Birthday Special</div>
        <div style="font-size:44px;font-weight:900;color:#7a1f1f;margin:8px 0;">${discountPercent}% OFF</div>
        <div style="font-size:14px;color:#78350f;">on your bill today</div>
      </div>

      <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">
        Visit us today and show this email to avail your birthday discount.<br/>
        Valid only on your birthday. Cheers! 🥂
      </p>
    </div>
    <div style="background:#f8f6f3;padding:16px 24px;text-align:center;">
      <p style="font-size:11px;color:#999;margin:0;">© ${new Date().getFullYear()} Jagali Koota, Mysuru</p>
    </div>
  </div>`;

  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: `🎂 Happy Birthday, ${name}! A special gift inside`,
    html,
  });

  console.log(`[Email] Birthday email sent to ${toEmail}: ${info.messageId}`);
  return info;
};

/**
 * Send an itemized order/bill receipt
 * details: { name, tableNumber, items:[{name,quantity,price}], subtotal, discountPercent, discountAmount, total, balanceAfter }
 */
const sendReceiptEmail = async (toEmail, details) => {
  const { name, tableNumber, items = [], subtotal, discountPercent, discountAmount, total, balanceAfter, invoiceNumber } = details;

  const itemsHtml = items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#333;">${it.name} <span style="color:#999;">x${it.quantity}</span></td>
        <td style="padding:8px 0;font-size:13px;color:#333;text-align:right;">₹${((it.price || 0) * (it.quantity || 1)).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const html = `
  <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #eee;border-radius:12px;overflow:hidden;">
    <div style="background:#7a1f1f;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px;">JAGALI KOOTA</h1>
      <p style="color:rgba(255,255,255,0.85);margin:5px 0 0;font-size:12px;">Order Receipt</p>
    </div>
    <div style="padding:26px;">
      <p style="font-size:15px;color:#333;margin:0 0 4px;">Thank you, ${name}!</p>
      <p style="font-size:13px;color:#777;margin:0 0 20px;">
        ${invoiceNumber ? `Bill #${invoiceNumber} · ` : ""}${tableNumber ? `Table ${tableNumber} · ` : ""}${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </p>

      <div style="border-top:1px solid #eee;border-bottom:1px solid #eee;padding:6px 0;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">${itemsHtml}</table>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:4px 0;color:#666;">Subtotal</td><td style="padding:4px 0;text-align:right;color:#333;">₹${Number(subtotal).toFixed(2)}</td></tr>
        ${discountPercent > 0 ? `<tr><td style="padding:4px 0;color:#16a34a;">Member Discount (${discountPercent}%)</td><td style="padding:4px 0;text-align:right;color:#16a34a;">- ₹${Number(discountAmount).toFixed(2)}</td></tr>` : ""}
        <tr><td style="padding:10px 0 0;font-size:16px;font-weight:800;color:#1a1a1a;border-top:1px solid #eee;">Total Paid</td><td style="padding:10px 0 0;text-align:right;font-size:16px;font-weight:800;color:#7a1f1f;border-top:1px solid #eee;">₹${Number(total).toFixed(2)}</td></tr>
      </table>

      ${balanceAfter !== undefined ? `<p style="font-size:13px;color:#888;margin:18px 0 0;text-align:right;">Wallet balance after: <b style="color:#16a34a;">₹${Number(balanceAfter).toFixed(2)}</b></p>` : ""}
    </div>
    <div style="background:#f8f6f3;padding:16px 24px;text-align:center;">
      <p style="font-size:11px;color:#999;margin:0;">Thank you for visiting · © ${new Date().getFullYear()} Jagali Koota, Mysuru</p>
    </div>
  </div>`;

  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: `Your Jagali Koota Receipt${invoiceNumber ? ` — #${invoiceNumber}` : ""}`,
    html,
  });

  console.log(`[Email] Receipt sent to ${toEmail}: ${info.messageId}`);
  return info;
};

/**
 * Low wallet balance alert
 */
const sendLowBalanceEmail = async (toEmail, name, balance, threshold) => {
  const html = `
  <div style="max-width:480px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #eee;border-radius:12px;overflow:hidden;">
    <div style="background:#d97706;padding:24px;text-align:center;">
      <div style="font-size:32px;">⚠️</div>
      <h1 style="color:#fff;margin:6px 0 0;font-size:20px;">Low Wallet Balance</h1>
    </div>
    <div style="padding:26px;text-align:center;">
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 18px;">
        Hi ${name}, your wallet balance is running low.
      </p>
      <div style="font-size:34px;font-weight:800;color:#d97706;margin-bottom:18px;">₹${Number(balance).toFixed(2)}</div>
      <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">
        Top up your wallet to continue enjoying seamless orders, events, and subscriptions.
      </p>
    </div>
    <div style="background:#f8f6f3;padding:14px 24px;text-align:center;">
      <p style="font-size:11px;color:#999;margin:0;">© ${new Date().getFullYear()} Jagali Koota, Mysuru</p>
    </div>
  </div>`;

  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: "⚠️ Your Jagali Koota wallet balance is low",
    html,
  });
  console.log(`[Email] Low balance alert sent to ${toEmail}`);
  return info;
};

/**
 * Subscription expiry reminder
 */
const sendExpiryReminderEmail = async (toEmail, name, sportName, endDate, daysLeft) => {
  const html = `
  <div style="max-width:480px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #eee;border-radius:12px;overflow:hidden;">
    <div style="background:#7a1f1f;padding:24px;text-align:center;">
      <div style="font-size:30px;">⏳</div>
      <h1 style="color:#fff;margin:6px 0 0;font-size:20px;">Subscription Expiring Soon</h1>
    </div>
    <div style="padding:26px;text-align:center;">
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 16px;">
        Hi ${name}, your <b>${sportName}</b> subscription expires in <b>${daysLeft} day${daysLeft !== 1 ? "s" : ""}</b>.
      </p>
      <div style="background:#faf6f4;border-radius:10px;padding:16px;margin-bottom:18px;">
        <div style="font-size:12px;color:#999;text-transform:uppercase;">Expires On</div>
        <div style="font-size:18px;font-weight:700;color:#7a1f1f;">${new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
      </div>
      <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">
        Renew now in the Member App to keep enjoying ${sportName} without interruption.
      </p>
    </div>
    <div style="background:#f8f6f3;padding:14px 24px;text-align:center;">
      <p style="font-size:11px;color:#999;margin:0;">© ${new Date().getFullYear()} Jagali Koota, Mysuru</p>
    </div>
  </div>`;
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: `⏳ Your ${sportName} subscription expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
    html,
  });
  console.log(`[Email] Expiry reminder sent to ${toEmail}`);
  return info;
};

/**
 * Membership anniversary wish
 */
const sendAnniversaryEmail = async (toEmail, name, years) => {
  const html = `
  <div style="max-width:480px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #eee;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#7a1f1f,#a83232);padding:34px 26px;text-align:center;">
      <div style="font-size:40px;">🥂</div>
      <h1 style="color:#fff;margin:8px 0 0;font-size:24px;">Happy Anniversary!</h1>
    </div>
    <div style="padding:28px 26px;text-align:center;">
      <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 18px;">
        Dear ${name}, it's been <b>${years} year${years !== 1 ? "s" : ""}</b> since you joined the Jagali Koota family!
      </p>
      <p style="font-size:14px;color:#666;line-height:1.6;margin:0;">
        Thank you for being a valued member. Here's to many more wonderful moments together! 🎉
      </p>
    </div>
    <div style="background:#f8f6f3;padding:14px 24px;text-align:center;">
      <p style="font-size:11px;color:#999;margin:0;">© ${new Date().getFullYear()} Jagali Koota, Mysuru</p>
    </div>
  </div>`;
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: `🥂 Happy ${years}-Year Anniversary with Jagali Koota!`,
    html,
  });
  console.log(`[Email] Anniversary email sent to ${toEmail}`);
  return info;
};

/**
 * Monthly statement — spending + wallet summary
 * summary: { monthLabel, totalSpent, ordersCount, walletBalance, topUps }
 */
const sendMonthlyStatementEmail = async (toEmail, name, summary) => {
  const { monthLabel, totalSpent, ordersCount, walletBalance, topUps } = summary;
  const html = `
  <div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #eee;border-radius:12px;overflow:hidden;">
    <div style="background:#7a1f1f;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px;">JAGALI KOOTA</h1>
      <p style="color:rgba(255,255,255,0.85);margin:5px 0 0;font-size:13px;">Monthly Statement — ${monthLabel}</p>
    </div>
    <div style="padding:26px;">
      <p style="font-size:15px;color:#333;margin:0 0 20px;">Hi ${name}, here's your activity summary for ${monthLabel}.</p>
      <div style="background:#faf6f4;border-radius:10px;padding:8px 20px;">
        <div style="padding:12px 0;border-bottom:1px solid #efe6e2;"><div style="font-size:11px;color:#999;text-transform:uppercase;">Total Spent</div><div style="font-size:18px;font-weight:800;color:#7a1f1f;">₹${Number(totalSpent).toFixed(2)}</div></div>
        <div style="padding:12px 0;border-bottom:1px solid #efe6e2;"><div style="font-size:11px;color:#999;text-transform:uppercase;">Orders</div><div style="font-size:15px;font-weight:600;color:#333;">${ordersCount}</div></div>
        <div style="padding:12px 0;border-bottom:1px solid #efe6e2;"><div style="font-size:11px;color:#999;text-transform:uppercase;">Wallet Top-ups</div><div style="font-size:15px;font-weight:600;color:#16a34a;">₹${Number(topUps).toFixed(2)}</div></div>
        <div style="padding:12px 0;"><div style="font-size:11px;color:#999;text-transform:uppercase;">Current Wallet Balance</div><div style="font-size:18px;font-weight:800;color:#16a34a;">₹${Number(walletBalance).toFixed(2)}</div></div>
      </div>
    </div>
    <div style="background:#f8f6f3;padding:14px 24px;text-align:center;">
      <p style="font-size:11px;color:#999;margin:0;">© ${new Date().getFullYear()} Jagali Koota, Mysuru</p>
    </div>
  </div>`;
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.SMTP_EMAIL}>`,
    to: toEmail,
    subject: `Your Jagali Koota Statement — ${monthLabel}`,
    html,
  });
  console.log(`[Email] Monthly statement sent to ${toEmail}`);
  return info;
};

module.exports = { sendOtpEmail, sendWelcomeMemberEmail, sendConfirmationEmail, sendBirthdayEmail, sendReceiptEmail, sendLowBalanceEmail, sendExpiryReminderEmail, sendAnniversaryEmail, sendMonthlyStatementEmail, transporter };
