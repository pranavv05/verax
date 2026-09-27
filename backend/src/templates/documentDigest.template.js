const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Long lists are cut off in the email; the dashboard shows the rest.
const MAX_LISTED_DOCUMENTS = 50;

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

const documentDigestSubject = ({ documentCount }) =>
  `${plural(documentCount, "document")} ready for review`;

/**
 * One email per admin per day, listing the documents processed since the last
 * digest that are still waiting for review, grouped by client.
 * `documents`: [{ id, fileName, clientName, needsAttention }]
 */
const documentDigestTemplate = ({ firmName, documents, frontendUrl }) => {
  const listed = documents.slice(0, MAX_LISTED_DOCUMENTS);
  const byClient = new Map();
  for (const doc of listed) {
    if (!byClient.has(doc.clientName)) byClient.set(doc.clientName, []);
    byClient.get(doc.clientName).push(doc);
  }
  const attentionCount = documents.filter((doc) => doc.needsAttention).length;
  const hiddenCount = documents.length - listed.length;

  const clientSections = [...byClient.entries()]
    .map(
      ([clientName, docs]) => `
        <p style="margin:18px 0 6px;font-size:14px;font-weight:700;color:#111827;">${escapeHtml(clientName)}</p>
        <ul style="margin:0;padding-left:20px;color:#475569;font-size:14px;line-height:1.7;">
          ${docs
            .map(
              (doc) => `<li><a href="${frontendUrl}/review/${encodeURIComponent(doc.id)}" style="color:#111827;">${escapeHtml(
                doc.fileName
              )}</a>${doc.needsAttention ? ' <span style="color:#b45309;">· needs a closer look</span>' : ""}</li>`
            )
            .join("")}
        </ul>`
    )
    .join("");

  return `
  <div style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e7dcc8;border-radius:12px;padding:28px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(firmName)}</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#111827;">${plural(documents.length, "document")} ready for review</h1>
        <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#475569;">
          Processed since your last summary${
            attentionCount > 0 ? `, including ${plural(attentionCount, "document")} flagged for a closer look` : ""
          }.
        </p>
        ${clientSections}
        ${
          hiddenCount > 0
            ? `<p style="margin:12px 0 0;font-size:13px;color:#64748b;">…and ${plural(hiddenCount, "more document")}.</p>`
            : ""
        }
        <a href="${frontendUrl}/dashboard" style="display:inline-block;margin:24px 0 20px;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">
          Open Verax
        </a>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
          You get this summary once a day when there is something new. Failed documents are still emailed as they happen.
        </p>
      </div>
    </div>
  </div>
`;
};

module.exports = {
  MAX_LISTED_DOCUMENTS,
  documentDigestSubject,
  documentDigestTemplate
};
