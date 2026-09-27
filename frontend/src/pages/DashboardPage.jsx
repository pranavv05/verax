import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { DashboardSkeleton } from "../components/ui/skeletons";
import StatusBadge from "../components/ui/StatusBadge";
import TrendChart from "../components/app/TrendChart";
import {
  ActionLink,
  Alert,
  Card,
  CardFooter,
  CardHeader,
  Dot,
  PageHeader,
  Progress,
  StatTile
} from "../components/app/primitives";
import {
  IconArrowRight,
  IconCheck,
  IconCheckCircle,
  IconChevronRight,
  IconClock,
  IconExport,
  IconFile,
  IconLink,
  IconPlus,
  IconSpark,
  IconUpload,
  IconUsers,
  IconXCircle
} from "../components/app/icons";
import { useAuth } from "../contexts/AuthContext";
import { dashboardApi } from "../api/dashboard-api";
import { cn, formatDateTime, parseApiError } from "../lib/utils";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const monthName = () => new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date());

const timeAgo = (value) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const EMPTY_INSIGHTS = {
  pipeline: { queued: 0, processing: 0, awaitingReview: 0, readyToExport: 0, exported: 0, failed: 0 },
  reviewQueue: [],
  clientProgress: { clients: [], activeClients: 0, clientsWithUploads: 0, clientsWithoutUploads: 0 },
  trend: [],
  activity: []
};

// ---------------------------------------------------------------------------
// Activity feed copy: one plain sentence per work event.
// ---------------------------------------------------------------------------

const describeActivity = (entry) => {
  const who = entry.userName || "Someone";
  const file = entry.fileName ? <span className="ui-mono text-ui-fg">{entry.fileName}</span> : "a document";
  const client = entry.clientName ? <span className="font-medium text-ui-fg">{entry.clientName}</span> : null;

  switch (entry.action) {
    case "document_upload_confirmed":
      return {
        icon: IconUpload,
        tone: "neutral",
        text: entry.userName ? (
          <>
            {who} uploaded a document{client ? <> for {client}</> : null}
          </>
        ) : (
          <>{client || "A client"} uploaded a document</>
        )
      };
    case "document_processed":
      return { icon: IconSpark, tone: "accent", text: <>Verax read {file}{client ? <> from {client}</> : null}</> };
    case "document_processing_failed":
      return { icon: IconXCircle, tone: "err", text: <>Couldn't read {file}{client ? <> from {client}</> : null}</> };
    case "extraction_approved":
      return { icon: IconCheckCircle, tone: "ok", text: <>{who} approved {file}</> };
    case "tally_export_generated":
      return {
        icon: IconExport,
        tone: "ok",
        text: (
          <>
            {who} exported {entry.documentCount ?? "some"} document{entry.documentCount === 1 ? "" : "s"} to Tally
            {client ? <> for {client}</> : null}
          </>
        )
      };
    case "bulk_export_generated":
      return { icon: IconExport, tone: "ok", text: <>{who} ran a bulk Tally export</> };
    case "client_created":
      return { icon: IconPlus, tone: "neutral", text: <>{who} added {client || "a client"}</> };
    case "client_request_docs":
      return { icon: IconLink, tone: "neutral", text: <>{who} requested documents from {client || "a client"}</> };
    default:
      return { icon: IconFile, tone: "neutral", text: entry.action.replace(/_/g, " ") };
  }
};

const activityLink = (entry) => {
  if (entry.entityType === "document" && entry.fileName && entry.entityId) return `/documents/${entry.entityId}/review`;
  if (entry.action.includes("export")) return "/export";
  if (entry.clientId) return `/clients/${entry.clientId}`;
  return null;
};

const ACTIVITY_TONE = {
  neutral: "text-ui-fg-3 bg-ui-subtle border-ui-line",
  accent: "text-ui-accent-text bg-ui-accent/[0.08] border-ui-accent/20",
  ok: "text-ui-ok bg-ui-ok/[0.08] border-ui-ok/20",
  err: "text-ui-err bg-ui-err/[0.07] border-ui-err/20"
};

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

const confidenceTone = (confidence) => {
  if (confidence === null || confidence === undefined) return "neutral";
  if (confidence < 0.6) return "err";
  if (confidence < 0.85) return "warn";
  return "ok";
};

const ReviewQueue = ({ items, total }) => (
  <Card className="flex flex-col">
    <CardHeader
      title="Review queue"
      description="Documents Verax could not clear on its own. Flagged first, then least confident."
      action={total > 0 ? <span className="text-xs font-medium tabular-nums text-ui-fg-3">{total} waiting</span> : null}
    />
    {items.length === 0 ? (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ui-ok/20 bg-ui-ok/[0.08] text-ui-ok">
          <IconCheck size={18} />
        </span>
        <p className="text-[0.9375rem] font-semibold text-ui-fg">Nothing needs a person</p>
        <p className="max-w-xs text-[0.8125rem] text-ui-fg-3">
          Every document that came in has been reviewed. New uploads land here only when a check fails.
        </p>
      </div>
    ) : (
      <ul className="flex-1 divide-y divide-ui-line">
        {items.map((item) => {
          const tone = item.status === "review_required" ? "warn" : confidenceTone(item.confidence);
          return (
            <li key={item.documentId}>
              <Link
                to={`/documents/${item.documentId}/review`}
                className="group flex items-center gap-4 px-5 py-3 outline-none transition-colors hover:bg-ui-subtle focus-visible:bg-ui-subtle"
              >
                <Dot tone={tone} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium text-ui-fg">{item.clientName}</p>
                  <p className="ui-mono truncate text-[0.72rem] text-ui-fg-3">{item.fileName}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-xs text-ui-fg-2">
                    {item.status === "review_required"
                      ? "Flagged by a check"
                      : item.confidence === null
                        ? "No confidence score"
                        : `Confidence ${item.confidence.toFixed(2)}`}
                  </p>
                  <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-ui-fg-4">
                    <IconClock size={11} />
                    waiting {timeAgo(item.uploadedAt).replace(" ago", "")}
                  </p>
                </div>
                <IconChevronRight size={15} className="text-ui-fg-4 transition-transform group-hover:translate-x-0.5 group-hover:text-ui-fg-2" />
              </Link>
            </li>
          );
        })}
      </ul>
    )}
    {items.length > 0 ? (
      <CardFooter>
        <span>{total > items.length ? `+ ${total - items.length} more in client inboxes` : "That's everything"}</span>
        <Link to={`/documents/${items[0].documentId}/review`} className="btn-primary btn-sm">
          Start reviewing
          <IconArrowRight size={13} />
        </Link>
      </CardFooter>
    ) : null}
  </Card>
);

const PIPELINE_STAGES = [
  { key: "queued", label: "Queued", tone: "bg-ui-fg-4" },
  { key: "processing", label: "Reading", tone: "bg-ui-info" },
  { key: "awaitingReview", label: "Review", tone: "bg-ui-warn" },
  { key: "readyToExport", label: "Ready", tone: "bg-ui-accent" },
  { key: "exported", label: "In Tally", tone: "bg-ui-ok" }
];

const Pipeline = ({ pipeline }) => {
  const total = PIPELINE_STAGES.reduce((sum, stage) => sum + (pipeline[stage.key] || 0), 0);
  return (
    <Card>
      <CardHeader title="Pipeline" description="Where every document in the firm is right now." />
      <div className="px-5 py-5">
        <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-ui-inset" aria-hidden="true">
          {total > 0
            ? PIPELINE_STAGES.map((stage) =>
                pipeline[stage.key] > 0 ? (
                  <span
                    key={stage.key}
                    className={cn("h-full transition-[flex-grow] duration-700", stage.tone)}
                    style={{ flexGrow: pipeline[stage.key] }}
                  />
                ) : null
              )
            : null}
        </div>

        <ol className="mt-5 grid grid-cols-5 gap-2">
          {PIPELINE_STAGES.map((stage) => (
            <li key={stage.key}>
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", stage.tone)} />
                <span className="truncate text-[11px] font-medium text-ui-fg-3">{stage.label}</span>
              </div>
              <p className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-ui-fg">{pipeline[stage.key] || 0}</p>
            </li>
          ))}
        </ol>

        {pipeline.failed > 0 ? (
          <Alert tone="err" className="mt-5" title={`${pipeline.failed} document${pipeline.failed === 1 ? "" : "s"} couldn't be read`}>
            Open the client's inbox to retry or replace the file.
          </Alert>
        ) : null}
      </div>
    </Card>
  );
};

const ClientProgress = ({ progress }) => {
  const { clients, activeClients, clientsWithUploads, clientsWithoutUploads } = progress;
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={`${monthName()} by client`}
        description="Approved out of received this month."
        action={<ActionLink to="/clients">All clients</ActionLink>}
      />
      {clients.length === 0 ? (
        <p className="flex-1 px-5 py-10 text-center text-[0.8125rem] text-ui-fg-3">
          No documents have come in this month yet.
        </p>
      ) : (
        <ul className="flex-1 space-y-4 px-5 py-5">
          {clients.map((client) => (
            <li key={client.clientId}>
              <Link to={`/clients/${client.clientId}`} className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ui-accent">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="truncate text-[0.8125rem] font-medium text-ui-fg group-hover:text-ui-accent-text">
                    {client.clientName}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-ui-fg-3">
                    {client.approved}/{client.received}
                    {client.awaitingReview > 0 ? (
                      <span className="ml-2 text-ui-warn">{client.awaitingReview} to review</span>
                    ) : null}
                  </span>
                </div>
                <Progress value={client.approved} max={client.received} label={`${client.clientName} progress`} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CardFooter>
        <span>
          <span className="font-medium text-ui-fg-2">{clientsWithUploads}</span> of {activeClients} active clients have sent
          documents
        </span>
        {clientsWithoutUploads > 0 ? <ActionLink to="/clients">Chase {clientsWithoutUploads}</ActionLink> : null}
      </CardFooter>
    </Card>
  );
};

const ActivityFeed = ({ entries }) => (
  <Card className="flex flex-col">
    <CardHeader title="Recent activity" description="Uploads, reviews and exports across the firm." />
    {entries.length === 0 ? (
      <p className="flex-1 px-5 py-10 text-center text-[0.8125rem] text-ui-fg-3">Work will show up here as it happens.</p>
    ) : (
      <ol className="relative flex-1 px-5 py-4">
        <span aria-hidden="true" className="absolute bottom-6 left-[2.15rem] top-6 w-px bg-ui-line" />
        {entries.map((entry) => {
          const { icon: Icon, tone, text } = describeActivity(entry);
          const to = activityLink(entry);
          const Row = to ? Link : "div";
          return (
            <li key={entry.id}>
              <Row
                {...(to ? { to } : {})}
                className={cn(
                  "relative flex items-start gap-3 rounded-lg px-1.5 py-2",
                  to && "outline-none transition-colors hover:bg-ui-subtle focus-visible:bg-ui-subtle"
                )}
              >
                <span className={cn("relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", ACTIVITY_TONE[tone])}>
                  <Icon size={13} />
                </span>
                <p className="min-w-0 flex-1 pt-1 text-[0.8125rem] leading-relaxed text-ui-fg-2">{text}</p>
                <time dateTime={entry.createdAt} title={formatDateTime(entry.createdAt)} className="shrink-0 pt-1 text-[11px] tabular-nums text-ui-fg-4">
                  {timeAgo(entry.createdAt)}
                </time>
              </Row>
            </li>
          );
        })}
      </ol>
    )}
  </Card>
);

const RecentExports = ({ exports }) => (
  <Card className="flex flex-col">
    <CardHeader title="Recent exports" action={<ActionLink to="/export">Export centre</ActionLink>} />
    {exports.length === 0 ? (
      <p className="flex-1 px-5 py-10 text-center text-[0.8125rem] text-ui-fg-3">
        Tally XML files you generate will be listed here.
      </p>
    ) : (
      <ul className="flex-1 divide-y divide-ui-line">
        {exports.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ui-line bg-ui-subtle text-ui-fg-3">
              <IconFile size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-medium text-ui-fg">
                {item.exportType === "bulk" ? "Bulk export" : "Tally export"}
                <span className="font-normal text-ui-fg-3">
                  {" · "}
                  {item.documentCount} document{item.documentCount === 1 ? "" : "s"}
                </span>
              </p>
              <p className="text-xs text-ui-fg-3">{formatDateTime(item.exportedAt || item.createdAt)}</p>
            </div>
            <StatusBadge status={item.status} />
          </li>
        ))}
      </ul>
    )}
  </Card>
);

/** First-run: three steps from an empty firm to a first Tally file. */
const GettingStarted = ({ hasClients }) => {
  const steps = [
    {
      done: hasClients,
      title: "Add your first client",
      body: "Name, GSTIN and email. Import a spreadsheet if you have many.",
      to: "/clients",
      cta: hasClients ? "View clients" : "Add a client",
      icon: IconUsers
    },
    {
      done: false,
      title: "Send an upload link",
      body: "Clients drop invoices and statements from any phone. No login needed.",
      to: "/clients",
      cta: "Request documents",
      icon: IconLink
    },
    {
      done: false,
      title: "Review and export",
      body: "Verax reads and checks every page; you approve the exceptions and download Tally XML.",
      to: "/export",
      cta: "Open export",
      icon: IconExport
    }
  ];

  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(40% 80% at 0% 0%, rgb(102 87 217 / 0.08), transparent 70%), radial-gradient(40% 80% at 100% 0%, rgb(20 184 166 / 0.07), transparent 70%)"
        }}
      />
      <div className="relative px-6 pb-2 pt-6">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-ui-fg">
          From paperwork to Tally. <span className="font-normal text-ui-fg-3">Three steps to your first export.</span>
        </h2>
      </div>
      <ol className="relative grid gap-px p-6 pt-4 md:grid-cols-3 md:gap-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex flex-col rounded-xl border border-ui-line bg-ui-surface/80 p-4">
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-ui-line bg-ui-subtle text-ui-fg-3">
                  <Icon size={15} />
                </span>
                {step.done ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-ui-ok">
                    <IconCheck size={13} /> Done
                  </span>
                ) : (
                  <span className="text-xs font-medium tabular-nums text-ui-fg-4">Step {index + 1}</span>
                )}
              </div>
              <p className="mt-4 text-[0.9375rem] font-semibold tracking-[-0.01em] text-ui-fg">{step.title}</p>
              <p className="mt-1 flex-1 text-[0.8125rem] leading-relaxed text-ui-fg-3">{step.body}</p>
              <ActionLink to={step.to} className="mt-4">
                {step.cta}
              </ActionLink>
            </li>
          );
        })}
      </ol>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const DashboardPage = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState({
    totalClients: 0,
    pendingDocs: 0,
    reviewedDocs: 0,
    exportedThisMonth: 0,
    activity: []
  });
  const [insights, setInsights] = useState(EMPTY_INSIGHTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      const [overviewResult, insightsResult] = await Promise.allSettled([
        dashboardApi.getOverview(),
        dashboardApi.getInsights()
      ]);
      if (!active) return;
      if (overviewResult.status === "fulfilled") setOverview(overviewResult.value);
      if (insightsResult.status === "fulfilled") setInsights({ ...EMPTY_INSIGHTS, ...insightsResult.value });
      if (overviewResult.status === "rejected" || insightsResult.status === "rejected") {
        const reason = overviewResult.reason || insightsResult.reason;
        setError(parseApiError(reason, "Part of the dashboard couldn't be loaded"));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const { pipeline, reviewQueue, clientProgress, trend, activity } = insights;
  const totalDocuments = useMemo(
    () => Object.values(pipeline).reduce((sum, n) => sum + (Number(n) || 0), 0),
    [pipeline]
  );
  const firstName = (user?.name || "").split(" ")[0];
  const isNewFirm = !loading && totalDocuments === 0;

  return (
    <AppShell>
      <PageHeader
        kicker={`${getGreeting()}${firstName ? `, ${firstName}` : ""}`}
        title="Overview."
        tint={`${monthName()} close, at a glance.`}
        actions={
          <>
            <Link to="/clients" className="btn-secondary">
              <IconLink size={14} />
              Request documents
            </Link>
            <Link to="/export" className="btn-primary">
              <IconExport size={14} />
              Export to Tally
            </Link>
          </>
        }
      />

      {error ? (
        <Alert tone="err" className="mb-6">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-5">
          <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Awaiting review"
              value={overview.pendingDocs}
              tone={overview.pendingDocs > 0 ? "warn" : "neutral"}
              hint={overview.pendingDocs > 0 ? "Need a person before export" : "Nothing waiting on you"}
              icon={<IconClock size={15} />}
              to={reviewQueue[0] ? `/documents/${reviewQueue[0].documentId}/review` : undefined}
            />
            <StatTile
              label="Approved today"
              value={overview.reviewedDocs}
              tone={overview.reviewedDocs > 0 ? "ok" : "neutral"}
              hint={`${pipeline.readyToExport} ready to export`}
              icon={<IconCheckCircle size={15} />}
            />
            <StatTile
              label={`Exports in ${monthName()}`}
              value={overview.exportedThisMonth}
              hint="Tally XML files generated"
              icon={<IconExport size={15} />}
              to="/export"
            />
            <StatTile
              label="Clients"
              value={overview.totalClients}
              hint={
                clientProgress.clientsWithoutUploads > 0
                  ? `${clientProgress.clientsWithoutUploads} haven't sent anything this month`
                  : "Every active client has sent documents"
              }
              icon={<IconUsers size={15} />}
              to="/clients"
            />
          </section>

          {isNewFirm ? <GettingStarted hasClients={overview.totalClients > 0} /> : null}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <ReviewQueue items={reviewQueue} total={pipeline.awaitingReview} />
            <div className="grid grid-cols-1 gap-5">
              <Pipeline pipeline={pipeline} />
              <Card>
                <CardHeader title="Last 14 days" description="Documents received and approved per day." />
                <div className="px-5 pb-5 pt-5">
                  <TrendChart data={trend} height={132} />
                </div>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <ClientProgress progress={clientProgress} />
            <ActivityFeed entries={activity} />
            <RecentExports exports={overview.activity} />
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default DashboardPage;
