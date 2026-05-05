import { useEffect, useState } from "react";
import AppShell from "../components/layout/AppShell";
import { TableRowsSkeleton } from "../components/ui/skeletons";
import EmptyState from "../components/ui/EmptyState";
import { auditApi } from "../api/audit-api";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTime, parseApiError } from "../lib/utils";
import { isAdmin } from "../utils/permissions";

const ENTITY_TYPES = ["firm", "client", "document", "extraction", "user"];

const LIMIT = 20;

const formatAction = (action) => {
  if (!action) return "-";
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const shortId = (id) => {
  if (!id) return "-";
  return String(id).slice(0, 8);
};

const MetaDetails = ({ metadata }) => {
  if (!metadata || typeof metadata !== "object" || Object.keys(metadata).length === 0) {
    return <span className="text-ink-400">-</span>;
  }
  const entries = Object.entries(metadata).slice(0, 6);
  return (
    <div className="space-y-0.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1 text-xs">
          <span className="font-semibold text-ink-700">{key}:</span>
          <span className="text-ink-500 break-all">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
      {Object.keys(metadata).length > 6 && (
        <div className="text-xs text-ink-400">+{Object.keys(metadata).length - 6} more</div>
      )}
    </div>
  );
};

const AuditLogPage = () => {
  const { user } = useAuth();
  const canAdmin = isAdmin(user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const [filters, setFilters] = useState({ page: 1, action: "", entityType: "" });

  const loadLogs = async (activeFilters) => {
    setLoading(true);
    setError("");
    try {
      const params = { limit: LIMIT, page: activeFilters.page };
      if (activeFilters.action) params.action = activeFilters.action;
      if (activeFilters.entityType) params.entityType = activeFilters.entityType;
      const result = await auditApi.list(params);
      const rows = result.data || [];
      setRows(rows);
      const total = result.total || rows.length;
      setPagination({
        page: result.page || activeFilters.page,
        total,
        totalPages: Math.max(1, Math.ceil(total / LIMIT))
      });
    } catch (loadError) {
      setError(parseApiError(loadError, "Unable to load audit logs"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canAdmin) {
      setLoading(false);
      return;
    }
    loadLogs(filters);
  }, [filters.page, filters.action, filters.entityType, canAdmin]);

  const onActionChange = (event) => {
    setFilters((prev) => ({ ...prev, page: 1, action: event.target.value }));
  };

  const onEntityTypeChange = (event) => {
    setFilters((prev) => ({ ...prev, page: 1, entityType: event.target.value }));
  };

  const canGoPrev = pagination.page > 1;
  const canGoNext = pagination.totalPages > pagination.page;

  return (
    <AppShell title="Audit Log" subtitle="Track all critical operations and changes across your firm.">
      {!canAdmin ? (
        <article className="panel p-6">
          <h2 className="text-lg font-bold text-ink-900">Admin access required</h2>
          <p className="mt-2 text-sm text-ink-500">
            Audit logs are available to firm admins only.
          </p>
        </article>
      ) : (
      <article className="panel p-5">
        {/* Filter bar */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap gap-2">
            <input
              className="field max-w-[260px]"
              placeholder="Filter by action (e.g. document_approved)"
              value={filters.action}
              onChange={onActionChange}
            />
            <select
              className="field max-w-[200px]"
              value={filters.entityType}
              onChange={onEntityTypeChange}
            >
              <option value="">All entity types</option>
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <p className="flex-shrink-0 text-sm text-ink-500">
            {pagination.total != null ? `${pagination.total} total entries` : ""}
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6d7e95]">
                  <th className="rounded-l-lg px-3 py-3 whitespace-nowrap">Timestamp</th>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3 whitespace-nowrap">Entity Type</th>
                  <th className="px-3 py-3 whitespace-nowrap">Entity ID</th>
                  <th className="rounded-r-lg px-3 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                <TableRowsSkeleton rows={8} cols={6} />
              </tbody>
            </table>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No audit log entries"
            description="Operations and changes to firm data will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-sand-100 text-left text-xs uppercase tracking-wide text-[#6d7e95]">
                  <th className="rounded-l-lg px-3 py-3 whitespace-nowrap">Timestamp</th>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3 whitespace-nowrap">Entity Type</th>
                  <th className="px-3 py-3 whitespace-nowrap">Entity ID</th>
                  <th className="rounded-r-lg px-3 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry, index) => (
                  <tr
                    key={entry.id || index}
                    className="border-t border-[#eadfcf] transition-colors hover:bg-sand-50/40"
                  >
                    <td className="px-3 py-3 text-xs text-[#6e7f96] whitespace-nowrap">
                      {formatDateTime(entry.createdAt || entry.created_at)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-semibold text-ink-900">
                        {entry.userName || entry.user_name || entry.user?.name || "-"}
                      </div>
                      <div className="text-xs text-ink-500">
                        {entry.userEmail || entry.user_email || entry.user?.email || ""}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full border border-ink-700/20 bg-ink-900/5 px-2.5 py-1 text-xs font-semibold text-ink-700">
                        {formatAction(entry.action)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-ink-700 capitalize">
                        {entry.entityType || entry.entity_type || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs text-ink-500">
                        {shortId(entry.entityId || entry.entity_id)}
                      </span>
                    </td>
                    <td className="px-3 py-3 max-w-[240px]">
                      <MetaDetails metadata={entry.metadata} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && rows.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-[#6b7b90]">
              Page {pagination.page} of {Math.max(1, pagination.totalPages || 1)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                disabled={!canGoPrev}
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                disabled={!canGoNext}
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </article>
      )}
    </AppShell>
  );
};

export default AuditLogPage;
