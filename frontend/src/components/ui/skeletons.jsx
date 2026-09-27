/**
 * Page-specific skeleton screens using react-loading-skeleton.
 * Import individual exports — each matches the layout of its page.
 */
import Skeleton from "react-loading-skeleton";

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export const DashboardSkeleton = () => (
  <div className="space-y-5">
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="panel p-5">
          <Skeleton width="45%" height={12} borderRadius={6} />
          <Skeleton width="30%" height={30} borderRadius={8} className="mt-3" />
          <Skeleton width="70%" height={10} borderRadius={6} className="mt-3" />
        </div>
      ))}
    </section>

    <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <div className="panel">
        <div className="border-b border-ui-line px-5 py-4">
          <Skeleton width={120} height={14} borderRadius={6} />
          <Skeleton width="60%" height={11} borderRadius={6} className="mt-2" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-ui-line px-5 py-3.5 last:border-b-0">
            <Skeleton circle width={8} height={8} />
            <div className="flex-1">
              <Skeleton width="35%" height={12} borderRadius={6} />
              <Skeleton width="50%" height={10} borderRadius={6} className="mt-1.5" />
            </div>
            <Skeleton width={90} height={12} borderRadius={6} />
          </div>
        ))}
      </div>
      <div className="grid gap-5">
        <div className="panel p-5">
          <Skeleton width={90} height={14} borderRadius={6} />
          <Skeleton height={8} borderRadius={8} className="mt-6" />
          <div className="mt-5 grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={34} borderRadius={6} />
            ))}
          </div>
        </div>
        <div className="panel p-5">
          <Skeleton width={110} height={14} borderRadius={6} />
          <Skeleton height={130} borderRadius={8} className="mt-5" />
        </div>
      </div>
    </section>
  </div>
);

// ---------------------------------------------------------------------------
// Generic table rows — used by Clients, Team, Audit Log
// ---------------------------------------------------------------------------
export const TableRowsSkeleton = ({ rows = 6, cols = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} className="border-t border-ui-line">
        {Array.from({ length: cols }).map((_, j) => (
          <td key={j} className="px-3 py-3.5">
            <Skeleton
              height={14}
              width={j === 0 ? "80%" : j === cols - 1 ? "60%" : "70%"}
              borderRadius={6}
            />
          </td>
        ))}
      </tr>
    ))}
  </>
);

// ---------------------------------------------------------------------------
// Client detail — stat cards + profile + actions
// ---------------------------------------------------------------------------
export const ClientDetailSkeleton = () => (
  <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-ui-line bg-ui-surface p-5">
          <Skeleton width="55%" height={11} borderRadius={6} />
          <Skeleton width="38%" height={34} borderRadius={8} className="mt-3" />
        </div>
      ))}
    </section>

    <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton width={130} height={18} borderRadius={6} />
          <Skeleton width={64} height={22} borderRadius={20} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton width={60} height={10} borderRadius={4} />
              <Skeleton width="80%" height={14} borderRadius={6} className="mt-1" />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Skeleton width={80} height={10} borderRadius={4} />
            <Skeleton width="100%" height={13} borderRadius={6} className="mt-1" />
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <Skeleton width={80} height={18} borderRadius={6} />
        <div className="mt-4 space-y-3">
          <Skeleton height={38} borderRadius={10} />
          <Skeleton height={38} borderRadius={10} />
          <Skeleton height={38} borderRadius={10} />
        </div>
      </div>
    </section>
  </>
);

// ---------------------------------------------------------------------------
// Client documents — document inbox table
// ---------------------------------------------------------------------------
export const ClientDocumentsSkeleton = ({ rows = 5 }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full border-separate border-spacing-0">
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i} className="border-t border-ui-line">
            <td className="px-3 py-3.5"><Skeleton width="80%" height={14} borderRadius={6} /></td>
            <td className="px-3 py-3.5"><Skeleton width={64} height={22} borderRadius={20} /></td>
            <td className="px-3 py-3.5"><Skeleton width={72} height={22} borderRadius={20} /></td>
            <td className="px-3 py-3.5"><Skeleton width={110} height={12} borderRadius={6} /></td>
            <td className="px-3 py-3.5 text-right"><Skeleton width={80} height={28} borderRadius={8} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ---------------------------------------------------------------------------
// Settings — 2-column form layout
// ---------------------------------------------------------------------------
export const SettingsSkeleton = () => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
    {/* Firm settings */}
    <div className="panel p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <Skeleton width={140} height={20} borderRadius={6} />
          <Skeleton width={220} height={12} borderRadius={6} className="mt-1.5" />
        </div>
        <Skeleton width={80} height={24} borderRadius={20} />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i}>
            <Skeleton width={80} height={11} borderRadius={4} />
            <Skeleton height={40} borderRadius={10} className="mt-1" />
          </div>
        ))}
        <Skeleton height={64} borderRadius={12} />
        <Skeleton height={42} borderRadius={10} />
      </div>
    </div>

    {/* My profile */}
    <div className="panel p-6">
      <Skeleton width={110} height={20} borderRadius={6} />
      <Skeleton width={200} height={12} borderRadius={6} className="mt-1.5 mb-5" />
      <Skeleton height={64} borderRadius={12} className="mb-4" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-4">
          <Skeleton width={80} height={11} borderRadius={4} />
          <Skeleton height={40} borderRadius={10} className="mt-1" />
        </div>
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Export page — generate form + history table
// ---------------------------------------------------------------------------
export const ExportSkeleton = () => (
  <>
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="panel p-5">
        <Skeleton width={140} height={20} borderRadius={6} />
        <div className="mt-4 space-y-3">
          <div>
            <Skeleton width={50} height={11} borderRadius={4} />
            <Skeleton height={40} borderRadius={10} className="mt-1" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i}>
                <Skeleton width={60} height={11} borderRadius={4} />
                <Skeleton height={40} borderRadius={10} className="mt-1" />
              </div>
            ))}
          </div>
          <Skeleton height={110} borderRadius={12} />
          <Skeleton height={42} borderRadius={10} />
        </div>
      </div>
      <div className="panel p-5">
        <Skeleton width={120} height={20} borderRadius={6} />
        <Skeleton width="90%" height={14} borderRadius={6} className="mt-3" />
      </div>
    </section>

    <div className="panel mt-6 p-5">
      <Skeleton width={130} height={20} borderRadius={6} className="mb-4" />
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-t border-ui-line">
                {[100, 80, 40, 70, 90, 60].map((w, j) => (
                  <td key={j} className="px-3 py-3.5">
                    <Skeleton width={w} height={14} borderRadius={6} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </>
);

// ---------------------------------------------------------------------------
// Review page — document viewer + extraction form
// ---------------------------------------------------------------------------
export const ReviewSkeleton = () => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
    <div className="panel p-5">
      <Skeleton width={160} height={20} borderRadius={6} className="mb-4" />
      <Skeleton height={480} borderRadius={12} />
    </div>
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton width={160} height={20} borderRadius={6} />
        <Skeleton width={90} height={28} borderRadius={8} />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-2 gap-3">
            <div>
              <Skeleton width="70%" height={11} borderRadius={4} />
              <Skeleton height={36} borderRadius={8} className="mt-1" />
            </div>
            <div>
              <Skeleton width="70%" height={11} borderRadius={4} />
              <Skeleton height={36} borderRadius={8} className="mt-1" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton height={42} borderRadius={10} className="mt-5" />
    </div>
  </div>
);
