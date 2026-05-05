const PASSWORD_RESET_SUBJECT = "Reset your Verax password";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const passwordResetTemplate = ({ resetLink, expiryMinutes = 15, firmName = "Verax" }) => `
  <div style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e7dcc8;border-radius:12px;padding:28px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(firmName)}</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#111827;">Reset your password</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
          We received a request to reset your Verax password.
        </p>
        <a href="${resetLink}" style="display:inline-block;margin:0 0 20px;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">
          Reset Password
        </a>
        <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#64748b;">
          This link expires in ${expiryMinutes} minutes.
        </p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
          If you didn't request this, ignore this email.
        </p>
      </div>
    </div>
  </div>
`;

module.exports = {
  PASSWORD_RESET_SUBJECT,
  passwordResetTemplate
};
