import { useEffect, useState } from "react";
import AppShell from "../components/layout/AppShell";
import { TableRowsSkeleton } from "../components/ui/skeletons";
import EmptyState from "../components/ui/EmptyState";
import { Pagination, SearchField, TableScroll, Toolbar } from "../components/app/TableKit";
import { Alert, Avatar, Badge, Card, PageHeader, Segmented } from "../components/app/primitives";
import { IconLock, IconSpark } from "../components/app/icons";
import { auditApi } from "../api/audit-api";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTime, parseApiError } from "../lib/utils";
import { isAdmin } from "../utils/permissions";

const ENTITY_TYPES = ["firm", "client", "document", "extraction", "user"];

const LIMIT = 20;

// Actions where the client themself (not a firm user) performed the action via the
// magic-link / client portal — the client's name should be shown as the Actor.
const CLIENT_ACTOR_ACTIONS = new Set([
  "document_upload_initiated",
  "document_upload_confirmed",
  "client_portal_login",
  "client_portal_login_failed",
  "client_portal_logout",
  "client_portal_password_changed"
]);

// System/worker-triggered actions that relate to a client's document but weren't
// caused by anyone logging in — Actor is "System", with the related client called out.
const SYSTEM_CLIENT_ACTIONS = new Set([
  "ai_extraction_saved",
  "document_processed",
  "document_processing_failed",
  "document_processing_alert"
]);

const formatAction = (action) => {
  if (!action) return "—";
  const text = action.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Colour means outcome: failures red, security events amber, completed work teal.
const actionTone = (action = "") => {
  if (/failed|alert/.test(action)) return "err";
  if (/deleted|password_reset/.test(action)) return "warn";
  if (/login|logout/.test(action)) return "neutral";
  if (/approved|exported|generated|processed|confirmed|downloaded/.test(action)) return "ok";
  return "neutral";
};

const shortId = (id) => {
  if (!id) return "-";
  return String(id).slice(0, 8);
};

const getActorDisplay = (entry) => {
  const userName = entry.userName || entry.user_name || entry.user?.name;
  const userEmail = entry.userEmail || entry.user_email || entry.user?.email;
  if (userName) {
    return { primary: userName, secondary: userEmail || "" };
  }
  const clientName = entry.clientName || entry.client_name;
  if (clientName && CLIENT_ACTOR_ACTIONS.has(entry.action)) {
    return { primary: clientName, secondary: "Client" };
  }
  if (SYSTEM_CLIENT_ACTIONS.has(entry.action)) {
    // Older AI-service entries were written without metadata.clientId.
    return { primary: "System", secondary: clientName ? `Client: ${clientName}` : "" };
  }
  return { primary: "-", secondary: "" };
};

const MetaDetails = ({ metadata, expanded, onToggle }) => {
  if (!metadata || typeof metadata !== "object" || Object.keys(metadata).length === 0) {
    return <span className="text-ui-fg-4">—</span>;
  }
  const all = Object.entries(metadata);
  const entries = expanded ? all : all.slice(0, 2);
  return (
    <div className="space-y-0.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1.5 text-xs">
          <span className="shrink-0 text-ui-fg-4">{key}</span>
          <span className="ui-mono break-all text-[0.7rem] text-ui-fg-2">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
      {all.length > 2 ? (
        <button type="button" className="link-action text-xs" onClick={onToggle}>
          {expanded ? "Show less" : `+${all.length - 2} more`}
        </button>
      ) : null}
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

  const [filters, setFilters] = useState({ page: 1, search: "", entityType: "" });
  const [searchInput, setSearchInput] = useState("");

  const loadLogs = async (activeFilters) => {
    setLoading(true);
    setError("");
    try {
      const params = { limit: LIMIT, page: activeFilters.page };
      if (activeFilters.search) params.search = activeFilters.search;
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
  }, [filters.page, filters.search, filters.entityType, canAdmin]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFilters((prev) => (prev.search === searchInput ? prev : { ...prev, page: 1, search: searchInput }));
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const [expanded, setExpanded] = useState(null);

  return (
    <AppShell>
      <PageHeader
        title="Audit log."
        tint="Who did what, and when."
        description="Every sign-in, upload, review, export and settings change across the firm. Visible to admins only."
      />

      {!canAdmin ? (
        <EmptyState
          icon={<IconLock size={18} />}
          title="Admin access required"
          description="Audit logs are available to firm admins only."
        />
      ) : (
        <Card className="overflow-hidden">
          <Toolbar>
            <SearchField
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search by user, action, entity or details"
              label="Search audit log"
            />
            <Segmented
              ariaLabel="Filter by entity"
              layoutId="audit-entity-filter"
              size="sm"
              value={filters.entityType}
              onChange={(entityType) => setFilters((prev) => ({ ...prev, page: 1, entityType }))}
              options={[{ value: "", label: "All" }, ...ENTITY_TYPES.map((type) => ({ value: type, label: type.charAt(0).toUpperCase() + type.slice(1) }))]}
            />
          </Toolbar>

          {error ? (
            <div className="border-b border-ui-line p-4">
              <Alert tone="err">{error}</Alert>
            </div>
          ) : null}

          {loading ? (
            <TableScroll>
              <table className="ui-table">
                <tbody>
                  <TableRowsSkeleton rows={8} cols={5} />
                </tbody>
              </table>
            </TableScroll>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState compact title="No audit log entries" description="Operations and changes to firm data will appear here." />
            </div>
          ) : (
            <TableScroll>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry, index) => {
                    const actor = getActorDisplay(entry);
                    const key = entry.id || index;
                    const tone = actionTone(entry.action);
                    return (
                      <tr key={key} className="align-top">
                        <td className="whitespace-nowrap text-xs tabular-nums text-ui-fg-3">{formatDateTime(entry.createdAt || entry.created_at)}</td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            {actor.primary !== "-" && actor.primary !== "System" ? (
                              <Avatar name={actor.primary} size={24} />
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-ui-line bg-ui-subtle text-ui-fg-4">
                                <IconSpark size={11} />
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="truncate font-medium text-ui-fg">{actor.primary}</div>
                              {actor.secondary ? <div className="truncate text-xs text-ui-fg-3">{actor.secondary}</div> : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge tone={tone} dot>
                            {formatAction(entry.action)}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="capitalize text-ui-fg-2">{entry.entityType || entry.entity_type || "—"}</span>
                          <span className="ui-mono ml-2 text-[0.7rem] text-ui-fg-4">{shortId(entry.entityId || entry.entity_id)}</span>
                        </td>
                        <td className="max-w-[20rem]">
                          <MetaDetails
                            metadata={entry.metadata}
                            expanded={expanded === key}
                            onToggle={() => setExpanded((prev) => (prev === key ? null : key))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          )}

          {!loading && rows.length > 0 ? (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              noun="entry"
              onPage={(page) => setFilters((prev) => ({ ...prev, page }))}
            />
          ) : null}
        </Card>
      )}
    </AppShell>
  );
};

export default AuditLogPage;
