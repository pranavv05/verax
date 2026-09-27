import { useMemo, useState } from "react";
import { cn } from "../../lib/utils";

/**
 * Daily grouped columns for two series ("received" and "approved").
 *
 * Built in HTML rather than SVG so it reflows to any card width without
 * scaling its text. Specs follow the dataviz rules: columns capped at 14px
 * with a 2px surface gap, 4px rounded tops square at the baseline, hairline
 * solid gridlines, a legend (two series), a per-day hover tooltip whose hit
 * target is the whole day band, and a screen-reader table of the same data.
 * Colours are the validated `ui-chart-1/2` pair; text stays in ink tokens.
 */

const niceMax = (value) => {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow * 4 >= value) || 10;
  return step * pow * 4;
};

const dayLabel = (iso, opts) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...opts }).format(new Date(`${iso}T00:00:00Z`));

const SERIES = [
  { key: "received", label: "Received", swatch: "bg-ui-chart-1" },
  { key: "approved", label: "Approved", swatch: "bg-ui-chart-2" }
];

const TrendChart = ({ data = [], height = 180, caption = "Documents received and approved per day" }) => {
  const [active, setActive] = useState(null);

  const max = useMemo(
    () => niceMax(Math.max(0, ...data.map((d) => Math.max(d.received, d.approved)))),
    [data]
  );
  const ticks = [max, max / 2, 0];
  const totals = useMemo(
    () => data.reduce((acc, d) => ({ received: acc.received + d.received, approved: acc.approved + d.approved }), { received: 0, approved: 0 }),
    [data]
  );

  return (
    <figure className="m-0">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {SERIES.map((series) => (
          <div key={series.key} className="flex items-center gap-2 text-xs text-ui-fg-3">
            <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-[3px]", series.swatch)} />
            {series.label}
            <span className="font-medium tabular-nums text-ui-fg">{totals[series.key]}</span>
          </div>
        ))}
      </div>

      <div className="relative flex gap-3" aria-hidden="true">
        {/* Y axis */}
        <div className="flex w-6 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-ui-fg-4" style={{ height }}>
          {ticks.map((tick) => (
            <span key={tick} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height }}>
            {ticks.map((tick) => (
              <span key={tick} className="h-px w-full bg-ui-line" />
            ))}
          </div>

          {/* Columns */}
          <div className="relative flex items-end" style={{ height }} onMouseLeave={() => setActive(null)}>
            {data.map((day, index) => (
              <div
                key={day.date}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
                onMouseEnter={() => setActive(index)}
              >
                <span
                  className={cn(
                    "absolute inset-x-0.5 inset-y-0 rounded-md transition-colors",
                    active === index ? "bg-ui-fg/[0.04]" : "bg-transparent"
                  )}
                />
                <div className="relative flex h-full w-full max-w-[30px] items-end justify-center gap-[2px] px-[12%]">
                  {SERIES.map((series) => {
                    const value = day[series.key];
                    const pct = max > 0 ? (value / max) * 100 : 0;
                    return (
                      <span
                        key={series.key}
                        className={cn(
                          "block min-w-0 max-w-[14px] flex-1 rounded-t-[4px] transition-[height,opacity] duration-500 ease-out",
                          series.swatch,
                          active !== null && active !== index ? "opacity-45" : "opacity-100"
                        )}
                        style={{ height: value > 0 ? `max(${pct}%, 3px)` : 0 }}
                      />
                    );
                  })}
                </div>

                {active === index ? (
                  <div
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-2 w-36 rounded-lg border border-ui-line bg-ui-raised px-3 py-2 shadow-ui-pop",
                      index < 2 ? "left-0" : index > data.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"
                    )}
                  >
                    <p className="text-[11px] font-medium text-ui-fg-3">
                      {dayLabel(day.date, { weekday: "short", day: "numeric", month: "short" })}
                    </p>
                    {SERIES.map((series) => (
                      <p key={series.key} className="mt-1 flex items-center justify-between gap-3 text-xs text-ui-fg-2">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-[2px]", series.swatch)} />
                          {series.label}
                        </span>
                        <span className="font-semibold tabular-nums text-ui-fg">{day[series.key]}</span>
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* X axis: first, middle and last day, or the hovered one. */}
          <div className="relative mt-2 h-4 text-[11px] tabular-nums text-ui-fg-4">
            {data.map((day, index) => {
              const edge = index === 0 ? "start" : index === data.length - 1 ? "end" : null;
              const landmark = edge || index === Math.floor(data.length / 2);
              const visible = active === null ? landmark : active === index;
              if (!visible) return null;
              const style =
                edge === "start"
                  ? { left: 0 }
                  : edge === "end"
                    ? { right: 0 }
                    : { left: `${((index + 0.5) / data.length) * 100}%`, transform: "translateX(-50%)" };
              return (
                <span
                  key={day.date}
                  className={cn("absolute top-0 whitespace-nowrap", active === index && "font-medium text-ui-fg-2")}
                  style={style}
                >
                  {dayLabel(day.date, { day: "numeric", month: "short" })}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Received</th>
            <th scope="col">Approved</th>
          </tr>
        </thead>
        <tbody>
          {data.map((day) => (
            <tr key={day.date}>
              <th scope="row">{dayLabel(day.date, { day: "numeric", month: "long" })}</th>
              <td>{day.received}</td>
              <td>{day.approved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

export default TrendChart;
