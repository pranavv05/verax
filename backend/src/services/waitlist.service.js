const pool = require("../db/pool");
const env = require("../config/env");
const { sendEmail } = require("./email.service");
const { demoRequestSubject, demoRequestTemplate } = require("../templates/demoRequest.template");
const {
  demoRequestConfirmationSubject,
  demoRequestConfirmationTemplate
} = require("../templates/demoRequestConfirmation.template");

const addToWaitlist = async ({ email, firmName, contactName, phone } = {}) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  const normalizedFirmName = firmName ? String(firmName).trim() : null;
  const normalizedContactName = contactName ? String(contactName).trim() : null;
  const normalizedPhone = phone ? String(phone).trim() : null;

  let entry;
  try {
    const result = await pool.query(
      `
      INSERT INTO waitlist (email, firm_name, contact_name, phone)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email)
      DO UPDATE SET
        firm_name = COALESCE(EXCLUDED.firm_name, waitlist.firm_name),
        contact_name = COALESCE(EXCLUDED.contact_name, waitlist.contact_name),
        phone = COALESCE(EXCLUDED.phone, waitlist.phone),
        updated_at = NOW()
      RETURNING *
      `,
      [normalizedEmail, normalizedFirmName, normalizedContactName, normalizedPhone]
    );
    entry = result.rows[0];
  } catch (error) {
    console.error("Error adding to waitlist:", error);
    throw error;
  }

  // The lead is already persisted at this point regardless of what happens below —
  // email delivery is best-effort and must never make an already-saved lead look lost.
  const notifyResult = await sendEmail({
    to: env.DEMO_NOTIFICATION_EMAIL,
    subject: demoRequestSubject({ firmName: normalizedFirmName, email: normalizedEmail }),
    html: demoRequestTemplate({
      firmName: normalizedFirmName,
      contactName: normalizedContactName,
      email: normalizedEmail,
      phone: normalizedPhone,
      requestedAt: entry.created_at
    })
  });

  if (!notifyResult.sent) {
    console.error("[waitlist] internal demo-request notification not sent", {
      email: normalizedEmail,
      provider: notifyResult.provider,
      error: notifyResult.error
    });
  }

  const confirmationResult = await sendEmail({
    to: normalizedEmail,
    subject: demoRequestConfirmationSubject(),
    html: demoRequestConfirmationTemplate({ contactName: normalizedContactName })
  });

  return {
    ...entry,
    notificationSent: notifyResult.sent,
    confirmationSent: confirmationResult.sent
  };
};

module.exports = {
  addToWaitlist
};
