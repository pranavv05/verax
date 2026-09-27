import { useState } from "react";
import Modal from "./Modal";
import { TableScroll } from "./TableKit";
import { Alert } from "./primitives";
import { IconExport } from "./icons";

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * "What will land in Tally" — the voucher preview shown before any export is
 * generated. Shared by the Export page and the client bulk export.
 */
const ExportPreviewModal = ({ open, preview, clientName, error, confirming, onCancel, onConfirm }) => {
  const [showWarnings, setShowWarnings] = useState(false);
  const vouchers = preview?.vouchers || [];

  return (
    <Modal
      open={open && Boolean(preview)}
      onClose={onCancel}
      busy={confirming}
      size="xl"
      title={`Export preview${clientName ? ` · ${clientName}` : ""}`}
      description={`${preview?.documentCount || 0} documents become ${vouchers.length} vouchers in TallyPrime.`}
      footer={
        <>
          <button type="button" className="btn-secondary" disabled={confirming} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={confirming} onClick={onConfirm}>
            <IconExport size={14} />
            {confirming ? "Exporting…" : preview?.hasWarnings ? "Export anyway" : "Export and download"}
          </button>
        </>
      }
    >
      {preview ? (
        <div className="space-y-4">
          {preview.hasWarnings ? (
            <Alert
              tone="warn"
              title={`${preview.warnings.length} line items have no Tally item mapping`}
              action={
                <button type="button" className="link-action shrink-0 text-xs" onClick={() => setShowWarnings((prev) => !prev)}>
                  {showWarnings ? "Hide" : "Show"}
                </button>
              }
            >
              They will export under their original names. Review mappings first for the cleanest books.
              {showWarnings ? (
                <div className="mt-3 max-h-40 overflow-auto rounded-lg border border-ui-line bg-ui-surface">
                  <table className="ui-table text-xs">
                    <thead>
                      <tr>
                        <th>Invoice no.</th>
                        <th>Item name</th>
                        <th>Issue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.warnings.map((warning, index) => (
                        <tr key={`${warning.documentId}-${warning.itemName}-${index}`}>
                          <td className="ui-mono">{warning.invoiceNumber || "—"}</td>
                          <td>{warning.itemName}</td>
                          <td>Unresolved mapping</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Alert>
          ) : null}

          {error ? <Alert tone="err">{error}</Alert> : null}

          <div className="overflow-hidden rounded-xl border border-ui-line">
            <TableScroll>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Voucher type</th>
                    <th>Date</th>
                    <th>Party</th>
                    <th className="text-right">Lines</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">GST</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.slice(0, 20).map((voucher, index) => (
                    <tr key={`${voucher.voucherType}-${voucher.voucherDate}-${index}`}>
                      <td className="font-medium text-ui-fg">{voucher.voucherType}</td>
                      <td className="whitespace-nowrap tabular-nums">{voucher.voucherDate || "—"}</td>
                      <td>{voucher.partyName || "—"}</td>
                      <td className="text-right tabular-nums">{voucher.lineItemCount || 0}</td>
                      <td className="whitespace-nowrap text-right font-medium tabular-nums text-ui-fg">{formatCurrency(voucher.totalAmount)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(voucher.gstAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
          {vouchers.length > 20 ? <p className="text-[0.8125rem] text-ui-fg-3">…and {vouchers.length - 20} more vouchers</p> : null}
        </div>
      ) : null}
    </Modal>
  );
};

export default ExportPreviewModal;
