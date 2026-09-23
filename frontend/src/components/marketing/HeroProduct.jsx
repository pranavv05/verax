import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { EASE } from "../public/motion";
import { VeraxMark } from "../brand/VeraxLogo";

/**
 * The hero's product shot — a high-fidelity rendition of the review screen,
 * built the way Stripe and Mercury present product: dense, specific, and
 * quietly alive rather than a sparse wireframe.
 *
 * It runs one short loop while on screen: the highlight on the invoice walks
 * field by field in sync with the focused input on the right, then a cursor
 * glides to "Approve & export", clicks, the status flips to Approved and an
 * "Exported to Tally" toast slides in. Then it resets. Under reduced motion it
 * renders the finished state, still.
 *
 * Same document as the rest of the page: ACME Trading Co., INV-2026-0417,
 * ₹49,560.00, GSTIN 27AABCA1234A1ZJ (checksum-valid). Everything is set in
 * Inter with tabular figures — real finance software doesn't render amounts
 * in a typewriter face.
 */

/* ── Icons (one 16px stroke vocabulary) ─────────────────────────────────── */

const I = ({ d, className = "", size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`flex-none ${className}`}
  >
    {d}
  </svg>
);

const ICON = {
  home: <path d="M2.5 7 8 2.5 13.5 7v6.5h-3.5v-4H6v4H2.5z" />,
  inbox: (
    <>
      <path d="M2 9.5h3.5l1 1.5h3l1-1.5H14" />
      <path d="M3.5 3h9L14 9.5V13H2V9.5z" />
    </>
  ),
  review: (
    <>
      <rect x="3" y="2" width="10" height="12" rx="1.5" />
      <path d="m5.8 8.2 1.5 1.5 3-3.2" />
    </>
  ),
  clients: (
    <>
      <circle cx="6" cy="5.5" r="2.2" />
      <path d="M2 13c.4-2.2 2-3.4 4-3.4s3.6 1.2 4 3.4M10.5 3.6a2 2 0 0 1 0 3.9M12 9.8c1.2.4 1.9 1.5 2 3.2" />
    </>
  ),
  recon: <path d="M2.5 5h8M2.5 11h8M10.5 3l2.5 2-2.5 2M10.5 9l2.5 2-2.5 2" />,
  exports: <path d="M8 2.5v8M4.8 7.5 8 10.7l3.2-3.2M3 13.5h10" />,
  settings: (
    <>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.2" />
      <path d="m10.2 10.2 3.3 3.3" />
    </>
  ),
  bell: (
    <>
      <path d="M4 11V7.2a4 4 0 0 1 8 0V11l1 1.2H3z" />
      <path d="M6.6 13.8a1.5 1.5 0 0 0 2.8 0" />
    </>
  ),
  chevronDown: <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />,
  chevronUp: <path d="m4.5 9.5 3.5-3.5 3.5 3.5" />,
  chevronRight: <path d="m6.5 4.5 3.5 3.5-3.5 3.5" />,
  minus: <path d="M4 8h8" />,
  plus: <path d="M8 4v8M4 8h8" />,
  rotate: <path d="M12.5 8a4.5 4.5 0 1 1-1.4-3.3M12.5 2.8v2.4h-2.4" />,
  download: <path d="M8 2.5v7.5M5 7l3 3 3-3M3 13h10" />,
  check: <path d="m3.5 8.3 2.8 2.8 6.2-6.4" />,
  warn: (
    <>
      <path d="M8 2.5 14 13H2z" />
      <path d="M8 6.5v3M8 11.3v.2" />
    </>
  ),
  shield: (
    <>
      <path d="M8 1.8 13 3.8v3.7c0 3.1-2.2 5.2-5 6.3-2.8-1.1-5-3.2-5-6.3V3.8z" />
      <path d="m5.8 8 1.5 1.5 3-3.1" />
    </>
  ),
  file: (
    <>
      <path d="M4 1.8h5.5L12.5 5v9.2H4z" />
      <path d="M9.5 1.8V5h3" />
    </>
  )
};

/* ── The loop ───────────────────────────────────────────────────────────── */

// Fields walked in order. The highlight on the invoice is positioned by
// measuring the element tagged `data-hl="<key>"`, so it stays exact at any size.
const FIELDS = [
  { key: "supplier" },
  { key: "gstin" },
  { key: "number" },
  { key: "date" },
  { key: "taxable" },
  { key: "total" }
];

const STEP_MS = 1100;

const useHeroLoop = (active, reduced) => {
  // phase: 0..FIELDS.length-1 = walking fields · "cursor" · "approved"
  const [phase, setPhase] = useState(reduced ? "approved" : 0);

  useEffect(() => {
    if (reduced || !active) return undefined;
    let cancelled = false;
    const timers = [];
    const at = (ms, fn) => timers.push(window.setTimeout(() => !cancelled && fn(), ms));

    const run = () => {
      setPhase(0);
      FIELDS.forEach((_, index) => at(index * STEP_MS, () => setPhase(index)));
      const walkEnd = FIELDS.length * STEP_MS;
      at(walkEnd, () => setPhase("cursor"));
      at(walkEnd + 1400, () => setPhase("approved"));
      at(walkEnd + 5200, run);
    };
    run();

    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [active, reduced]);

  return phase;
};

/* ── Pieces ─────────────────────────────────────────────────────────────── */

const Kbd = ({ children, dark = false }) => (
  <span
    className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] px-1 text-[10px] font-medium ${
      dark ? "bg-white/15 text-white/80" : "border border-carbon-900/10 bg-white text-carbon-400"
    }`}
  >
    {children}
  </span>
);

const NAV = [
  { icon: "home", label: "Home" },
  { icon: "inbox", label: "Inbox", count: 14 },
  { icon: "review", label: "Review", count: 3, active: true },
  { icon: "clients", label: "Clients" },
  { icon: "recon", label: "Reconciliation" },
  { icon: "exports", label: "Exports" }
];

const CLIENTS = [
  { name: "ACME Trading Co.", color: "#6657D9" },
  { name: "Kumar & Sons", color: "#14B8A6" },
  { name: "Patel Hardware", color: "#F59E0B" },
  { name: "Shree Balaji Pkg.", color: "#4D8DFF" }
];

const Sidebar = () => (
  <aside className="hidden w-[212px] flex-none flex-col border-r border-[#ECEBEF] bg-[#FAFAFB] lg:flex">
    <div className="flex items-center gap-2.5 px-3.5 py-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-carbon-950">
        <VeraxMark size={15} tone="light" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-carbon-900">Sharma &amp; Associates</span>
        <span className="block text-[11px] text-carbon-400">March 2026 close</span>
      </span>
      <I d={ICON.chevronDown} size={13} className="text-carbon-400" />
    </div>

    <nav className="mt-1 space-y-px px-2">
      {NAV.map((item) => (
        <div
          key={item.label}
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[12.5px] ${
            item.active
              ? "bg-white font-medium text-carbon-900 shadow-[0_1px_2px_rgba(14,16,19,0.06),0_0_0_1px_rgba(14,16,19,0.05)]"
              : "text-carbon-500"
          }`}
        >
          <I d={ICON[item.icon]} className={item.active ? "text-brand-600" : "text-carbon-400"} />
          <span className="flex-1">{item.label}</span>
          {item.count ? (
            <span
              className={`rounded-full px-1.5 text-[10.5px] font-medium tabular-nums ${
                item.active ? "bg-brand-500/10 text-brand-700" : "text-carbon-400"
              }`}
            >
              {item.count}
            </span>
          ) : null}
        </div>
      ))}
    </nav>

    <p className="mt-6 px-5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-carbon-400">Clients</p>
    <div className="mt-1.5 space-y-px px-2">
      {CLIENTS.map((client) => (
        <div key={client.name} className="flex items-center gap-2.5 rounded-md px-2.5 py-[6px] text-[12.5px] text-carbon-600">
          <span className="h-2 w-2 rounded-[3px]" style={{ background: client.color }} />
          <span className="truncate">{client.name}</span>
        </div>
      ))}
    </div>

    <div className="mt-auto p-3">
      <div className="rounded-lg border border-[#ECEBEF] bg-white p-3">
        <div className="flex items-center justify-between text-[11.5px]">
          <span className="font-medium text-carbon-800">March close</span>
          <span className="tabular-nums text-carbon-400">72%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EFEEF3]">
          <span className="block h-full w-[72%] rounded-full bg-gradient-to-r from-brand-500 to-sky-500" />
        </div>
        <p className="mt-2 text-[11px] text-carbon-400">207 ready · 9 to review</p>
      </div>
      <div className="mt-2 flex items-center gap-2.5 px-1.5 py-1.5 text-[12.5px] text-carbon-500">
        <I d={ICON.settings} className="text-carbon-400" />
        Settings
      </div>
    </div>
  </aside>
);

const TopBar = () => (
  <div className="flex h-12 items-center gap-3 border-b border-[#ECEBEF] bg-white px-4">
    <div className="flex h-8 w-full max-w-[340px] items-center gap-2 rounded-lg border border-[#ECEBEF] bg-[#FAFAFB] px-2.5 text-[12.5px] text-carbon-400">
      <I d={ICON.search} size={14} />
      <span className="flex-1 truncate">Search documents, clients, GSTINs…</span>
      <Kbd>⌘K</Kbd>
    </div>
    <div className="ml-auto flex items-center gap-3">
      <span className="relative text-carbon-500">
        <I d={ICON.bell} size={16} />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-white bg-brand-500" />
      </span>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-rose-400 text-[11px] font-semibold text-white">
        PS
      </span>
    </div>
  </div>
);

/** The page itself — typeset like paper, not like the app. */
const InvoicePage = ({ highlight }) => {
  const pageRef = useRef(null);
  const [box, setBox] = useState(null);
  const key = highlight !== null ? FIELDS[highlight]?.key : null;

  useLayoutEffect(() => {
    const page = pageRef.current;
    const target = key && page ? page.querySelector(`[data-hl="${key}"]`) : null;
    if (!target) {
      setBox(null);
      return;
    }
    const p = page.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    // Rects include any parent transform scale; normalise back to layout px.
    const scale = p.width / page.offsetWidth || 1;
    const pad = 3;
    setBox({
      top: (t.top - p.top) / scale - pad,
      left: (t.left - p.left) / scale - pad,
      width: t.width / scale + pad * 2,
      height: t.height / scale + pad * 2
    });
  }, [key]);

  return (
    <div
      ref={pageRef}
      className="relative mx-auto aspect-[1/1.3] w-full max-w-[360px] rounded-[3px] bg-white px-[7%] py-[7%] text-[#1d1f24] shadow-[0_1px_2px_rgba(14,16,19,0.08),0_12px_32px_-12px_rgba(14,16,19,0.28)]"
      style={{ fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif" }}
    >
      {/* Live capture highlight */}
      <AnimatePresence>
        {box ? (
          <motion.span
            key="hl"
            aria-hidden="true"
            className="pointer-events-none absolute z-10 rounded-[3px] border border-brand-500 bg-brand-500/[0.12] shadow-[0_0_0_3px_rgba(102,87,217,0.12)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, top: box.top, left: box.left, width: box.width, height: box.height }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
          />
        ) : null}
      </AnimatePresence>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-[3px] bg-[#1d4ed8] text-[8px] font-bold text-white">
              AT
            </span>
            <p data-hl="supplier" className="text-[11px] font-bold">ACME Trading Co.</p>
          </div>
          <p className="mt-1.5 text-[6.5px] leading-[1.5] text-[#6b6f78]">
            Plot 14, MIDC Bhosari, Pune 411026
            <br />
            Maharashtra · +91 20 2712 0000
          </p>
          <p className="mt-1.5 text-[7px]">
            <span data-hl="gstin">GSTIN: <span className="font-bold">27AABCA1234A1ZJ</span></span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold tracking-[0.12em] text-[#1d4ed8]">TAX INVOICE</p>
          <p className="mt-1.5 text-[7px]">
            <span data-hl="number">
              No. <span className="font-bold">INV-2026-0417</span>
            </span>
          </p>
          <p className="mt-1 text-[7px]">
            <span data-hl="date">
              Date <span className="font-bold">17-03-2026</span>
            </span>
          </p>
        </div>
      </div>

      <div className="mt-[6%] grid grid-cols-2 gap-3 rounded-[2px] bg-[#f4f5f7] p-2 text-[6.5px] leading-[1.5]">
        <div>
          <p className="font-bold text-[#6b6f78]">BILL TO</p>
          <p className="font-bold">Mehta Packaging Pvt. Ltd.</p>
          <p className="text-[#6b6f78]">Andheri East, Mumbai 400069</p>
        </div>
        <div>
          <p className="font-bold text-[#6b6f78]">PLACE OF SUPPLY</p>
          <p>Maharashtra (27)</p>
          <p className="text-[#6b6f78]">Terms: Net 30</p>
        </div>
      </div>

      <table className="mt-[5%] w-full text-[6.5px]">
        <thead>
          <tr className="bg-[#1d4ed8] text-left text-white">
            <th className="px-1 py-[3px] font-bold">#</th>
            <th className="px-1 py-[3px] font-bold">Description</th>
            <th className="px-1 py-[3px] text-right font-bold">HSN</th>
            <th className="px-1 py-[3px] text-right font-bold">Qty</th>
            <th className="px-1 py-[3px] text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["1", "Industrial Packaging Rolls", "3920", "80", "20,000.00"],
            ["2", "Corrugated Cartons — Size B", "4819", "150", "15,000.00"],
            ["3", "BOPP Adhesive Tape", "3919", "14", "7,000.00"]
          ].map((row) => (
            <tr key={row[0]} className="border-b border-[#e6e7ea]">
              {row.map((cell, index) => (
                <td key={index} className={`px-1 py-[4px] ${index >= 2 ? "text-right" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-[5%] w-[52%] space-y-[3px] text-[6.8px]">
        {[
          ["Taxable value", "42,000.00"],
          ["CGST @ 9%", "3,780.00"],
          ["SGST @ 9%", "3,780.00"]
        ].map(([label, value]) => (
          <div key={label} data-hl={label === "Taxable value" ? "taxable" : undefined} className="flex justify-between">
            <span className="text-[#6b6f78]">{label}</span>
            <span>{value}</span>
          </div>
        ))}
        <div data-hl="total" className="flex justify-between border-t border-[#1d1f24] pt-[3px] text-[8.5px] font-bold">
          <span>Total</span>
          <span>₹ 49,560.00</span>
        </div>
      </div>

      <p className="mt-[5%] text-[6px] italic text-[#6b6f78]">Rupees Forty-Nine Thousand Five Hundred Sixty Only</p>

      <div className="absolute bottom-[7%] left-[7%] right-[7%] flex items-end justify-between text-[6px] text-[#6b6f78]">
        <p className="leading-[1.5]">
          HDFC Bank · A/c 50200012345678
          <br />
          IFSC HDFC0000123
        </p>
        <div className="text-right">
          <p className="font-['Brush_Script_MT',cursive] text-[13px] leading-none text-[#1d4ed8]">R. Kulkarni</p>
          <p className="mt-0.5 border-t border-[#c9cbd1] pt-0.5">Authorised signatory</p>
        </div>
      </div>
    </div>
  );
};

const Viewer = ({ highlight }) => (
  <div className="hidden min-w-0 flex-1 flex-col bg-[#F3F3F6] md:flex">
    <div className="flex h-10 items-center justify-between border-b border-[#ECEBEF] bg-white/70 px-3 text-[11.5px] text-carbon-500">
      <span className="flex items-center gap-1.5">
        <I d={ICON.file} size={13} className="text-carbon-400" />
        <span className="font-medium text-carbon-700">acme-inv-0417.pdf</span>
        <span className="text-carbon-400">· 1 page</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-carbon-900/5">
          <I d={ICON.minus} size={13} />
        </span>
        <span className="w-10 text-center tabular-nums">100%</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-md">
          <I d={ICON.plus} size={13} />
        </span>
        <span className="mx-1 h-4 w-px bg-[#E4E3E8]" />
        <span className="flex h-6 w-6 items-center justify-center rounded-md">
          <I d={ICON.rotate} size={13} />
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-md">
          <I d={ICON.download} size={13} />
        </span>
      </span>
    </div>
    <div className="flex flex-1 items-start justify-center overflow-hidden px-6 pt-6">
      <InvoicePage highlight={highlight} />
    </div>
  </div>
);

const Input = ({ label, value, focused, confidence, adornment, wide = false, strong = false, numeric = false }) => (
  <label className={`block ${wide ? "col-span-2" : ""}`}>
    <span className="flex items-center justify-between text-[11px] font-medium text-carbon-500">
      {label}
      {confidence ? (
        <span className="flex items-center gap-1 text-[10.5px] font-normal tabular-nums text-carbon-400">
          <span
            className={`h-1.5 w-1.5 rounded-full ${confidence >= 0.9 ? "bg-verify-500" : "bg-amber-500"}`}
          />
          {confidence.toFixed(2)}
        </span>
      ) : null}
    </span>
    <span
      className={`mt-1 flex h-8 items-center gap-2 rounded-md border bg-white px-2.5 text-[12.5px] transition-all duration-300 ${
        numeric ? "tabular-nums" : ""
      } ${
        focused
          ? "border-brand-500 shadow-[0_0_0_3px_rgba(102,87,217,0.15)]"
          : "border-[#E4E3E8] shadow-[0_1px_1px_rgba(14,16,19,0.03)]"
      } ${strong ? "font-semibold text-carbon-900" : "text-carbon-800"}`}
    >
      <span className="min-w-0 flex-1 truncate">{value}</span>
      {adornment}
    </span>
  </label>
);

const FieldsPanel = ({ focus, approved }) => (
  <div className="flex w-full flex-col md:w-[340px] md:flex-none md:border-l md:border-[#ECEBEF]">
    <div className="flex-1 space-y-5 overflow-hidden px-4 py-4">
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-carbon-400">Supplier</p>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2.5">
          <Input wide label="Supplier name" value="ACME Trading Co." confidence={0.98} focused={focus === "supplier"} />
          <Input
            wide
            label="GSTIN"
            value="27AABCA1234A1ZJ"
            confidence={0.99}
            focused={focus === "gstin"}
            adornment={
              <span className="inline-flex items-center gap-1 rounded-full bg-verify-500/10 px-1.5 py-px text-[10.5px] font-medium text-verify-700">
                <I d={ICON.shield} size={11} /> Verified
              </span>
            }
          />
        </div>
      </section>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-carbon-400">Invoice</p>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2.5">
          <Input label="Number" value="INV-2026-0417" confidence={0.97} focused={focus === "number"} />
          <Input label="Date" value="17 Mar 2026" confidence={0.96} focused={focus === "date"} />
        </div>
      </section>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-carbon-400">Amounts · ₹</p>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2.5">
          <Input numeric label="Taxable" value="42,000.00" confidence={0.95} focused={focus === "taxable"} />
          <Input numeric label="CGST + SGST" value="7,560.00" confidence={0.95} />
          <Input
            wide
            strong
            numeric
            label="Total"
            value="49,560.00"
            confidence={0.97}
            focused={focus === "total"}
            adornment={<span className="text-[10.5px] font-normal text-carbon-400">= 42,000 + 7,560</span>}
          />
        </div>
      </section>

      <section className="rounded-lg border border-amber-500/25 bg-amber-50/70 p-3">
        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-800">
          <I d={ICON.warn} size={13} /> Confirm stock item
        </p>
        <p className="mt-1.5 text-[11.5px] text-carbon-500">
          “Industrial Packaging Rolls” <span className="text-carbon-400">→</span>{" "}
          <span className="font-medium text-carbon-900">Packaging Rolls 40 GSM</span>
        </p>
        <p className="mt-1 text-[10.5px] text-carbon-400">Suggested from your Tally stock items · 92% match</p>
      </section>
    </div>

    <div className="flex items-center justify-between border-t border-[#ECEBEF] bg-[#FAFAFB] px-4 py-2.5 text-[11px]">
      <span className="flex items-center gap-1.5 text-carbon-500">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-verify-500 text-white">
          <I d={ICON.check} size={10} />
        </span>
        4 of 4 checks passed
      </span>
      <span className="text-carbon-400">{approved ? "Approved · v2" : "Autosaved · v2"}</span>
    </div>
  </div>
);

const Header = ({ approved, pressing }) => (
  <div className="border-b border-[#ECEBEF] bg-white px-4 pt-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[11.5px] text-carbon-400">
          Review <I d={ICON.chevronRight} size={11} /> ACME Trading Co.
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="text-[16px] font-semibold tracking-[-0.01em] text-carbon-900">INV-2026-0417</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={approved ? "approved" : "ready"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: EASE }}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                approved ? "bg-verify-500/12 text-verify-700" : "bg-brand-500/10 text-brand-700"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${approved ? "bg-verify-500" : "bg-brand-500"}`} />
              {approved ? "Approved" : "Ready for approval"}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden items-center overflow-hidden rounded-md border border-[#E4E3E8] text-carbon-500 sm:flex">
          <span className="flex h-7 w-7 items-center justify-center border-r border-[#E4E3E8]">
            <I d={ICON.chevronUp} size={13} />
          </span>
          <span className="flex h-7 w-7 items-center justify-center">
            <I d={ICON.chevronDown} size={13} />
          </span>
        </span>
        <span className="hidden h-7 items-center rounded-md border border-[#E4E3E8] px-2.5 text-[12px] font-medium text-carbon-700 sm:inline-flex">
          Reject
        </span>
        <motion.span
          animate={{ scale: pressing ? 0.95 : 1 }}
          transition={{ duration: 0.15 }}
          className={`inline-flex h-7 items-center gap-2 rounded-md px-3 text-[12px] font-medium text-white shadow-[0_1px_2px_rgba(14,16,19,0.2),inset_0_1px_0_rgba(255,255,255,0.12)] transition-colors duration-300 ${
            approved ? "bg-verify-600" : "bg-carbon-900"
          }`}
        >
          {approved ? (
            <>
              <I d={ICON.check} size={13} /> Approved
            </>
          ) : (
            <>
              Approve &amp; export <Kbd dark>⌘↵</Kbd>
            </>
          )}
        </motion.span>
      </div>
    </div>

    <div className="mt-3 flex gap-5 text-[12px]">
      {[
        ["Fields", null, true],
        ["Line items", "3"],
        ["Checks", "4"],
        ["History", null]
      ].map(([label, count, active]) => (
        <span
          key={label}
          className={`flex items-center gap-1.5 border-b-2 pb-2 ${
            active ? "border-carbon-900 font-medium text-carbon-900" : "border-transparent text-carbon-400"
          }`}
        >
          {label}
          {count ? <span className="rounded bg-[#F0EFF3] px-1 text-[10.5px] tabular-nums text-carbon-500">{count}</span> : null}
        </span>
      ))}
    </div>
  </div>
);

/** A macOS-style pointer that glides to the approve button and clicks. */
const Cursor = ({ phase }) => {
  const show = phase === "cursor" || phase === "approved";
  return (
    <AnimatePresence>
      {show ? (
        <motion.svg
          key="cursor"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="pointer-events-none absolute z-30 drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
          initial={{ opacity: 0, top: "62%", right: "22%" }}
          animate={{ opacity: phase === "approved" ? 0 : 1, top: "10.5%", right: "3.6%" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.45, 0, 0.2, 1], opacity: { duration: 0.4, delay: phase === "approved" ? 1.2 : 0 } }}
        >
          <path d="M3 2.5v13.2l3.6-3.4 2.3 5.2 2.3-1-2.3-5.1h5z" fill="#0E1013" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
        </motion.svg>
      ) : null}
    </AnimatePresence>
  );
};

/* ── The product window ─────────────────────────────────────────────────── */

const HeroProduct = () => {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.35 });
  const phase = useHeroLoop(inView, reduced);

  const walking = typeof phase === "number";
  const focus = walking ? FIELDS[phase].key : null;
  const approved = phase === "approved";
  const [pressing, setPressing] = useState(false);

  useEffect(() => {
    if (!approved || reduced) return undefined;
    setPressing(true);
    const timer = window.setTimeout(() => setPressing(false), 160);
    return () => window.clearTimeout(timer);
  }, [approved, reduced]);

  return (
    <div ref={ref} className="relative">
      {/* Glass bezel — the frame Mercury and Linear put around product shots */}
      <div className="rounded-[20px] border border-white/70 bg-white/40 p-2 shadow-[0_60px_120px_-50px_rgba(38,30,110,0.55),0_0_0_1px_rgba(14,16,19,0.04)] backdrop-blur-xl">
        <div className="relative overflow-hidden rounded-[14px] border border-[#E6E5EA] bg-white">
          <div className="flex md:h-[600px]">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <Header approved={approved} pressing={pressing} />
              <div className="flex min-h-0 flex-1">
                <Viewer highlight={walking ? phase : null} />
                <FieldsPanel focus={focus} approved={approved} />
              </div>
            </div>
          </div>

          <Cursor phase={phase} />

          {/* Toast */}
          <AnimatePresence>
            {approved ? (
              <motion.div
                key="toast"
                initial={reduced ? false : { opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.4, ease: EASE, delay: reduced ? 0 : 0.35 }}
                className="absolute bottom-16 right-4 z-20 flex w-[290px] items-start gap-3 rounded-xl bg-carbon-950 p-3.5 text-white shadow-[0_20px_40px_-12px_rgba(14,16,19,0.6)]"
              >
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-verify-500">
                  <I d={ICON.check} size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium">Exported to Tally</span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-carbon-400">
                    tally-export-mar-2026.xml · balanced
                  </span>
                </span>
                <span className="text-[11.5px] font-medium text-brand-300">Download</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default HeroProduct;
