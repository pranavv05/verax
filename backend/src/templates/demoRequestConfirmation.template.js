const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const demoRequestConfirmationSubject = () => "We've received your Verax demo request";

const demoRequestConfirmationTemplate = ({ contactName }) => `
  <div style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e7dcc8;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827;">
          ${contactName ? `Hi ${escapeHtml(contactName)},` : "Thanks for requesting a demo"}
        </h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">
          Thanks for requesting a demo of Verax. We've received your request and someone from
          our team will get in touch with you shortly.
        </p>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
          Verax — Automate the financial document workflow between your firm and your clients.
        </p>
      </div>
    </div>
  </div>
`;

module.exports = {
  demoRequestConfirmationSubject,
  demoRequestConfirmationTemplate
};
