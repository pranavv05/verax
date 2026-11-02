import { useEffect, useState } from "react";
import { Alert, Badge, Card, CardHeader, FormField } from "../app/primitives";
import { complianceApi } from "../../api/compliance-api";
import { parseApiError } from "../../lib/utils";

/**
 * Connect a client's GSTIN for live GSTR-2B pulls via the GSP.
 *
 * Flow (CA-triggered, client reads the OTP):
 *   1. CA enters the client's GST-portal username (saved on the client).
 *   2. "Send OTP" -> GSTN sends an OTP to the client's registered mobile/email.
 *   3. CA enters the OTP the client relays back -> "Verify" opens a 6h session.
 * Shows connection status and a disconnect action. On a successful connect it
 * calls onConnected() so the parent can re-run reconciliation against live data.
 *
 * Admin-only actions are gated by `canAdmin`; non-admins see status only.
 */
const GstConnectCard = ({ clientId, canAdmin, onConnected }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [gstUsername, setGstUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState("idle"); // idle | otp_sent
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const s = await complianceApi.getGstSession({ clientId });
      setStatus(s);
      if (s.gstUsername) setGstUsername(s.gstUsername);
      if (s.status === "pending") setStage("otp_sent");
    } catch (statusError) {
      setError(parseApiError(statusError, "Unable to load GST connection status"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setStage("idle");
    setOtp("");
    setNote("");
    setError("");
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const onSendOtp = async () => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await complianceApi.requestGstOtp({ clientId, gstUsername: gstUsername.trim() || undefined });
      setStage("otp_sent");
      setNote("OTP sent to the client's registered mobile/email. Ask them to read it back to you.");
    } catch (sendError) {
      setError(parseApiError(sendError, "Could not send the OTP"));
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    setBusy(true);
    setError("");
    try {
      await complianceApi.verifyGstOtp({ clientId, otp: otp.trim() });
      setOtp("");
      setStage("idle");
      setNote("GST connected. Live GSTR-2B will be used for reconciliation.");
      await loadStatus();
      if (typeof onConnected === "function") onConnected();
    } catch (verifyError) {
      setError(parseApiError(verifyError, "OTP verification failed"));
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    setError("");
    try {
      await complianceApi.disconnectGstSession({ clientId });
      setStage("idle");
      setNote("GST disconnected.");
      await loadStatus();
    } catch (disconnectError) {
      setError(parseApiError(disconnectError, "Could not disconnect"));
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.connected;
  const statusBadge = connected ? (
    <Badge tone="ok">Connected</Badge>
  ) : status?.status === "expired" ? (
    <Badge tone="warn">Expired</Badge>
  ) : status?.status === "pending" ? (
    <Badge tone="warn">OTP sent</Badge>
  ) : (
    <Badge tone="neutral">Not connected</Badge>
  );

  return (
    <Card>
      <CardHeader
        title="GST connection"
        description="Connect the client's GSTIN to pull GSTR-2B automatically."
        action={statusBadge}
      />
      <div className="flex flex-col gap-4 px-5 py-5">
        {!status?.gstin ? (
          <Alert tone="warn">Set the client's GSTIN first to connect GST.</Alert>
        ) : connected ? (
          <div className="flex flex-col gap-3">
            <p className="text-ui-fg-2">
              Live GSTR-2B is connected for <span className="font-medium text-ui-fg">{status.gstin}</span>.
              Reconciliation pulls fresh data automatically.
            </p>
            {canAdmin ? (
              <button type="button" className="btn-secondary btn-sm self-start" disabled={busy} onClick={onDisconnect}>
                Disconnect
              </button>
            ) : null}
          </div>
        ) : !canAdmin ? (
          <p className="text-ui-fg-3">An admin can connect this client's GST for live reconciliation.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <FormField label="Client's GST portal username" htmlFor="gst-username">
              <input
                id="gst-username"
                className="field"
                placeholder="usually the client's registered email"
                value={gstUsername}
                onChange={(event) => setGstUsername(event.target.value)}
                disabled={busy}
              />
            </FormField>
            <p className="text-xs text-ui-fg-3">
              The client must first enable API access in their GST portal (View Profile &rarr; Manage API Access).
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <button type="button" className="btn-secondary" disabled={busy} onClick={onSendOtp}>
                {stage === "otp_sent" ? "Resend OTP" : "Send OTP"}
              </button>
              {stage === "otp_sent" ? (
                <>
                  <FormField label="OTP from client" htmlFor="gst-otp" className="w-40">
                    <input
                      id="gst-otp"
                      className="field"
                      inputMode="numeric"
                      placeholder="6-digit OTP"
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                      disabled={busy}
                    />
                  </FormField>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy || otp.trim().length < 4}
                    onClick={onVerify}
                  >
                    {busy ? "Verifying…" : "Verify & connect"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}

        {note ? <Alert tone="ok">{note}</Alert> : null}
        {error ? <Alert tone="err">{error}</Alert> : null}
        {loading ? <p className="text-xs text-ui-fg-3">Checking connection…</p> : null}
      </div>
    </Card>
  );
};

export default GstConnectCard;
