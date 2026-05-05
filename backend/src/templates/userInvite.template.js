const userInviteSubject = ({ firmName }) => `You've been invited to ${firmName} on Verax`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const userInviteTemplate = ({ inviterName, firmName, loginUrl, tempPassword }) => `
  <div style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e7dcc8;border-radius:12px;padding:28px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Verax Team Invite</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#111827;">You've been invited to ${escapeHtml(firmName)}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
          ${escapeHtml(inviterName)} invited you to join ${escapeHtml(firmName)} on Verax.
        </p>
        <a href="${loginUrl}" style="display:inline-block;margin:0 0 20px;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">
          Open Verax
        </a>
        <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Temporary password</p>
        <div style="margin:0 0 16px;padding:12px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-family:Consolas,monospace;font-size:15px;color:#111827;">
          ${escapeHtml(tempPassword)}
        </div>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
          Change your password after first login.
        </p>
      </div>
    </div>
  </div>
`;

module.exports = {
  userInviteSubject,
  userInviteTemplate
};
