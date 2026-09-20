import { useEffect, useState } from "react";
import ClientPortalShell from "../components/layout/ClientPortalShell";
import ClientStatusBadge, { CLIENT_STATUS_HELP } from "../components/ui/ClientStatusBadge";
import { clientPortalApi } from "../api/client-portal-api";
import { formatDate, parseApiError, triggerFileDownload } from "../lib/utils";

const filters = [
  ["", "All"],
  ["processing", "Processing"],
  ["under_review", "Under Review"],
  ["complete", "Complete"]
];

const docTypeLabels = {
  invoice: "Invoice",
  bill: "Bill",
  bank_statement: "Bank statement",
  other: "Other"
};

const ClientPortalDocumentsPage = () => {
  const [statusFilter, setStatusFilter] = useState("");
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await clientPortalApi.documents({
          status: statusFilter || undefined,
          page: 1,
          limit: 100
        });
        if (!active) return;
        setDocuments(result.data || []);
      } catch (loadError) {
        if (!active) return;
        setError(parseApiError(loadError, "We couldn't load your documents just now."));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [statusFilter]);

  const onDownload = async (document) => {
    setDownloadingId(document.id);
    setError("");
    try {
      const result = await clientPortalApi.documentDownload(document.id);
      await triggerFileDownload(result.downloadUrl, result.originalFilename);
    } catch (downloadError) {
      setError(parseApiError(downloadError, "We couldn't prepare that download."));
    } finally {
      setDownloadingId("");
    }
  };

  return (
    <ClientPortalShell
      title="Your documents"
      subtitle="Everything your accountant holds for you, and where each one has got to."
    >
      <div className="flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <button
            key={label}
            type="button"
            className={`rounded-full border px-4 py-2 text-base font-semibold transition ${
              statusFilter === value
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-[#e7dcc8] bg-white text-ink-700 hover:bg-sand-50"
            }`}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-base font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-6 text-base text-[#607086]">Loading your documents...</p>
      ) : documents.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[#e7dcc8] bg-sand-50 px-4 py-8 text-center">
          <p className="text-lg font-semibold text-ink-900">Nothing to show here</p>
          <p className="mt-1 text-base text-[#607086]">
            {statusFilter
              ? "No documents are at this stage right now."
              : "Documents will appear as soon as they're sent in."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {documents.map((document) => (
            <li key={document.id} className="rounded-2xl border border-[#e7dcc8] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-lg font-semibold text-ink-900">
                    {document.originalFilename}
                  </p>
                  <p className="mt-1 text-base text-[#607086]">
                    {docTypeLabels[document.documentType] || "Document"} ·{" "}
                    {formatDate(document.createdAt)}
                  </p>
                  <p className="mt-1 text-sm text-[#7f8a99]">{document.source}</p>
                </div>
                <ClientStatusBadge status={document.status} />
              </div>

              <p className="mt-3 text-base text-[#607086]">
                {CLIENT_STATUS_HELP[document.status]}
              </p>

              <button
                type="button"
                className="btn-secondary mt-4 w-full py-2.5 text-base sm:w-auto"
                disabled={downloadingId === document.id}
                onClick={() => onDownload(document)}
              >
                {downloadingId === document.id ? "Preparing..." : "Download original"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </ClientPortalShell>
  );
};

export default ClientPortalDocumentsPage;
