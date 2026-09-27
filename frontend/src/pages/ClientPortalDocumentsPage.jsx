import { useEffect, useState } from "react";
import ClientPortalShell from "../components/layout/ClientPortalShell";
import ClientStatusBadge, { CLIENT_STATUS_HELP } from "../components/ui/ClientStatusBadge";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import { Alert, Card, Segmented } from "../components/app/primitives";
import { IconExport, IconFile } from "../components/app/icons";
import { clientPortalApi } from "../api/client-portal-api";
import { formatDate, parseApiError, triggerFileDownload } from "../lib/utils";

const filters = [
  { value: "", label: "All" },
  { value: "processing", label: "Processing" },
  { value: "under_review", label: "Under review" },
  { value: "complete", label: "Complete" }
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
    <ClientPortalShell title="Your documents." subtitle="Everything your accountant holds for you, and where each one has got to.">
      <Segmented
        ariaLabel="Filter by status"
        layoutId="portal-doc-filter"
        value={statusFilter}
        onChange={setStatusFilter}
        options={filters}
      />

      {error ? (
        <Alert tone="err" className="mt-6">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingState message="Loading your documents…" />
        </div>
      ) : documents.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nothing to show here"
            description={statusFilter ? "No documents are at this stage right now." : "Documents will appear as soon as they're sent in."}
          />
        </div>
      ) : (
        <Card className="mt-6 overflow-hidden">
          <ul className="divide-y divide-ui-line">
            {documents.map((document) => (
              <li key={document.id} className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center">
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ui-line bg-ui-subtle text-ui-fg-3 sm:flex">
                  <IconFile size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="break-words text-base font-semibold text-ui-fg">{document.originalFilename}</p>
                    <ClientStatusBadge status={document.status} />
                  </div>
                  <p className="mt-1 text-sm text-ui-fg-3">
                    {docTypeLabels[document.documentType] || "Document"} · {formatDate(document.createdAt)}
                    {document.source ? ` · ${document.source}` : ""}
                  </p>
                  {CLIENT_STATUS_HELP[document.status] ? (
                    <p className="mt-1.5 text-[0.9375rem] text-ui-fg-2">{CLIENT_STATUS_HELP[document.status]}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn-secondary w-full py-2.5 text-[0.875rem] sm:w-auto"
                  disabled={downloadingId === document.id}
                  onClick={() => onDownload(document)}
                >
                  <IconExport size={15} />
                  {downloadingId === document.id ? "Preparing…" : "Download original"}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </ClientPortalShell>
  );
};

export default ClientPortalDocumentsPage;
