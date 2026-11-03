import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../app/Modal";
import { Alert, Card, CardHeader, FormField } from "../app/primitives";
import { firmsApi } from "../../api/firms-api";
import { API_BASE_URL } from "../../lib/api-client";
import { useAuth } from "../../contexts/AuthContext";
import { parseApiError } from "../../lib/utils";

/**
 * Admin-only: take all of the firm's data out of Verax, or erase it. Both are
 * what a firm leaving the product (or exercising DPDP rights on behalf of its
 * clients) needs.
 */
const FirmDataSection = ({ firmName }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState("");
  const [exportError, setExportError] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const onExport = async () => {
    setExporting(true);
    setExportError("");
    setExportNote("");
    try {
      const { path } = await firmsApi.requestExportLink();
      // A signed link the browser downloads straight to disk — an export can be
      // gigabytes, too big to buffer in the page.
      const a = document.createElement("a");
      a.href = `${API_BASE_URL}${path}`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setExportNote("Your export has started downloading. Large firms can take a few minutes.");
    } catch (error) {
      setExportError(parseApiError(error, "Unable to start the export"));
    } finally {
      setExporting(false);
    }
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setConfirmName("");
    setPassword("");
    setDeleteError("");
  };

  const nameMatches = confirmName.trim() === (firmName || "").trim() && confirmName.trim() !== "";

  const onDelete = async (event) => {
    event.preventDefault();
    if (!nameMatches || !password) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await firmsApi.deleteFirm({ confirmFirmName: confirmName, password });
      await logout().catch(() => {});
      navigate("/", { replace: true });
    } catch (error) {
      setDeleteError(parseApiError(error, "Unable to delete the firm"));
      setDeleting(false);
    }
  };

  return (
    <Card as="section" id="data" className="scroll-mt-24">
      <CardHeader
        title="Your data"
        description="Take everything with you, or remove it from Verax for good."
      />
      <div className="space-y-6 px-5 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[0.875rem] font-medium text-ui-fg">Export all data</p>
            <p className="mt-1 text-[0.8125rem] text-ui-fg-3">
              A ZIP of every client, document, extraction, review, Tally file and audit record, plus every original
              file your clients uploaded. Passwords and login tokens are left out.
            </p>
          </div>
          <button type="button" className="btn-secondary shrink-0" disabled={exporting} onClick={onExport}>
            {exporting ? "Preparing…" : "Export data"}
          </button>
        </div>
        {exportNote ? <Alert tone="ok">{exportNote}</Alert> : null}
        {exportError ? <Alert tone="err">{exportError}</Alert> : null}

        <div className="flex flex-col gap-3 border-t border-ui-line pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[0.875rem] font-medium text-ui-err">Delete this firm</p>
            <p className="mt-1 text-[0.8125rem] text-ui-fg-3">
              Permanently erases the firm, every team member&apos;s account, every client and all of their documents.
              This can&apos;t be undone — export your data first if you may need it.
            </p>
          </div>
          <button type="button" className="btn-danger shrink-0" onClick={() => setDeleteOpen(true)}>
            Delete firm…
          </button>
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={closeDelete}
        busy={deleting}
        tone="err"
        title="Delete this firm permanently?"
        description="Everything is erased immediately and can't be recovered. Your team and your clients lose access."
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={deleting} onClick={closeDelete}>
              Cancel
            </button>
            <button
              type="submit"
              form="delete-firm-form"
              className="btn-danger"
              disabled={deleting || !nameMatches || !password}
            >
              {deleting ? "Deleting…" : "Delete everything"}
            </button>
          </>
        }
      >
        <form id="delete-firm-form" className="space-y-4" onSubmit={onDelete}>
          <FormField label={`Type "${firmName}" to confirm`} htmlFor="delete-firm-name">
            <input
              id="delete-firm-name"
              className="field"
              autoComplete="off"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
          </FormField>
          <FormField label="Your password" htmlFor="delete-firm-password">
            <input
              id="delete-firm-password"
              className="field"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          {deleteError ? <Alert tone="err">{deleteError}</Alert> : null}
        </form>
      </Modal>
    </Card>
  );
};

export default FirmDataSection;
