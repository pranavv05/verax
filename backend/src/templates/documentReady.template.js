const documentReadySubject = ({ documentName }) => `Document ready for review - ${documentName}`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const documentReadyTemplate = ({ firmName, clientName, documentName, reviewUrl }) => `
  <div style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e7dcc8;border-radius:12px;padding:28px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(firmName)}</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#111827;">Document ready for review</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
          ${escapeHtml(documentName)} for ${escapeHtml(clientName)} has finished processing and is ready for review.
        </p>
        <a href="${reviewUrl}" style="display:inline-block;margin:0 0 20px;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">
          Review Now
        </a>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
          Open Verax to review extracted fields and approve the document for export.
        </p>
      </div>
    </div>
  </div>
`;

module.exports = {
  documentReadySubject,
  documentReadyTemplate
};
