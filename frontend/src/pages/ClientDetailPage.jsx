import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import { clientsApi } from "../api/clients-api";
import { formatDateTime, parseApiError } from "../lib/utils";

const ClientDetailPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [client, setClient] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const loadClient = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await clientsApi.getById(id);
      setClient(result);
    } catch (loadError) {
      setError(parseApiError(loadError, "Unable to load client details"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClient();
  }, [id]);

  const onRequestDocs = async () => {
    setRequesting(true);
    setError("");
    setToast("");
    try {
      const result = await clientsApi.requestDocuments(id);
      setToast(`Upload link refreshed. Expires ${formatDateTime(result.uploadTokenExpiresAt)}.`);
      await loadClient();
    } catch (requestError) {
      setError(parseApiError(requestError, "Unable to request documents"));
    } finally {
      setRequesting(false);
    }
  };

  const summary = client?.documentSummary || {};

  return (
    <AppShell title={client?.name || "Client Detail"} subtitle="Client profile, upload status, and compliance pipeline.">
      {loading ? <LoadingState message="Loading client details..." /> : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !client ? (
        <EmptyState
          title="Client not found"
          description="The requested client is unavailable or you do not have access."
        />
      ) : null}

      {client ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total documents" value={summary.totalDocuments ?? 0} />
            <StatCard label="Processing" value={summary.processingDocuments ?? 0} tone="warning" />
            <StatCard label="Reviewed" value={summary.reviewedDocuments ?? 0} tone="success" />
            <StatCard label="Exported" value={summary.exportedDocuments ?? 0} tone="success" />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-ink-900">Client profile</h2>
                <StatusBadge status={client.status} />
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[#6a7b90]">Email</dt>
                  <dd className="text-sm font-semibold text-ink-900">{client.email || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[#6a7b90]">Phone</dt>
                  <dd className="text-sm font-semibold text-ink-900">{client.phone || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[#6a7b90]">GSTIN</dt>
                  <dd className="text-sm font-semibold text-ink-900">{client.gstin || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[#6a7b90]">Last upload</dt>
                  <dd className="text-sm font-semibold text-ink-900">
                    {formatDateTime(summary.lastUploadedAt)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-[#6a7b90]">Upload token</dt>
                  <dd className="font-mono text-xs text-[#596a82] break-all">{client.uploadToken}</dd>
                </div>
              </dl>
            </article>

            <article className="panel p-5">
              <h2 className="text-lg font-bold text-ink-900">Actions</h2>
              <div className="mt-4 space-y-3">
                <button type="button" className="btn-primary w-full" disabled={requesting} onClick={onRequestDocs}>
                  {requesting ? "Refreshing link..." : "Request documents"}
                </button>
                <Link className="btn-secondary block w-full text-center" to={`/clients/${id}/documents`}>
                  View documents
                </Link>
                <Link className="btn-secondary block w-full text-center" to="/clients">
                  Back to clients list
                </Link>
              </div>
              {toast ? (
                <div className="mt-4 rounded-lg border border-mint-300 bg-mint-500/10 px-3 py-2 text-sm text-mint-700">
                  {toast}
                </div>
              ) : null}
            </article>
          </section>
        </>
      ) : null}
    </AppShell>
  );
};

export default ClientDetailPage;
