import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../api/auth-api";
import { uploadApi } from "../api/upload-api";
import { parseApiError } from "../lib/utils";

const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "xlsx"];
const maxFileSizeMb = 50;

const uploadRequestSchema = z.object({
  file_name: z.string().min(1),
  file_type: z.string().min(1),
  file_size: z.number().int().positive().max(maxFileSizeMb * 1024 * 1024),
  doc_type: z.enum(["invoice", "bank_statement", "bill", "other"])
});

const fileExtension = (name = "") => name.split(".").pop()?.toLowerCase() || "";

const PublicUploadPage = () => {
  const { token } = useParams();

  const [clientInfo, setClientInfo] = useState(null);
  const [activeUploadToken, setActiveUploadToken] = useState(token);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState("");

  const [docType, setDocType] = useState("other");
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setTokenLoading(true);
      setTokenError("");
      try {
        const result = await authApi.validateMagicToken(token);
        if (active) {
          setClientInfo(result.client);
          setActiveUploadToken(token);
        }
      } catch (error) {
        if (active) {
          setTokenError(parseApiError(error, "Magic link is invalid or expired"));
        }
      } finally {
        if (active) {
          setTokenLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const addFiles = useCallback((files) => {
    setGlobalError("");
    const incoming = Array.from(files || []);
    if (incoming.length === 0) {
      return;
    }

    const validItems = [];
    for (const file of incoming) {
      const ext = fileExtension(file.name);
      if (!allowedExtensions.includes(ext)) {
        setGlobalError(`Unsupported file extension for ${file.name}`);
        continue;
      }
      if (file.size > maxFileSizeMb * 1024 * 1024) {
        setGlobalError(`File ${file.name} exceeds ${maxFileSizeMb}MB`);
        continue;
      }

      validItems.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        status: "pending",
        progress: 0,
        message: "Ready"
      });
    }

    setItems((prev) => [...prev, ...validItems]);
  }, []);

  const onDrop = (event) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };

  const onFileInputChange = (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  };

  const updateItem = (id, patch) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const processUploadQueue = async () => {
    if (uploading || items.length === 0) {
      return;
    }

    setUploading(true);
    setGlobalError("");
    let queueToken = activeUploadToken || token;

    for (const item of items) {
      if (item.status === "success") {
        continue;
      }

      try {
        updateItem(item.id, { status: "preparing", message: "Requesting upload URL...", progress: 0 });

        const payload = {
          file_name: item.file.name,
          file_type: item.file.type || "application/octet-stream",
          file_size: item.file.size,
          doc_type: docType
        };

        const validation = uploadRequestSchema.safeParse(payload);
        if (!validation.success) {
          throw new Error(validation.error.issues[0]?.message || "Invalid upload payload");
        }

        const initResult = await uploadApi.createPublicUpload(queueToken, validation.data);

        updateItem(item.id, { status: "uploading", message: "Uploading to secure storage..." });

        await uploadApi.uploadFileToSignedUrl(initResult.upload_url, item.file, (progress) => {
          updateItem(item.id, { progress });
        });

        updateItem(item.id, { status: "confirming", message: "Confirming and queueing OCR...", progress: 100 });

        const confirmResult = await uploadApi.confirmPublicUpload(queueToken, initResult.document_id);
        if (confirmResult?.token_rotation?.uploadToken) {
          queueToken = confirmResult.token_rotation.uploadToken;
          setActiveUploadToken(queueToken);
        }

        updateItem(item.id, { status: "success", message: "Upload completed", progress: 100 });
      } catch (error) {
        updateItem(item.id, {
          status: "error",
          message: parseApiError(error, "Upload failed")
        });
      }
    }

    setUploading(false);
  };

  const successCount = useMemo(
    () => items.filter((item) => item.status === "success").length,
    [items]
  );

  const pendingCount = useMemo(
    () => items.filter((item) => item.status !== "success").length,
    [items]
  );

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <div className="inline-flex rounded-full border border-[#d5c7a9] bg-sand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#5b6b80]">
          Client Upload Portal
        </div>
        <h1 className="mt-3 text-3xl font-extrabold text-ink-900">Document Submission</h1>
        <p className="mt-1 text-sm text-[#66778f]">
          Upload your documents securely. Files are processed automatically for your CA firm.
        </p>
      </header>

      {tokenLoading ? (
        <div className="panel px-4 py-3 text-sm font-semibold text-ink-700">Validating upload token...</div>
      ) : null}

      {tokenError ? (
        <div className="panel border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {tokenError}
        </div>
      ) : null}

      {!tokenLoading && !tokenError && clientInfo ? (
        <>
          <section className="panel mb-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#6a7b90]">Client</p>
                <p className="text-lg font-bold text-ink-900">{clientInfo.name}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#6a7b90]">Upload type</p>
                <select className="field mt-1" value={docType} onChange={(event) => setDocType(event.target.value)}>
                  <option value="invoice">Invoice</option>
                  <option value="bank_statement">Bank statement</option>
                  <option value="bill">Bill</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </section>

          <section
            className="panel cursor-pointer border-dashed p-6 text-center transition hover:bg-sand-50"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
          >
            <p className="text-lg font-bold text-ink-900">Drag and drop files here</p>
            <p className="mt-1 text-sm text-[#65768f]">PDF, JPG, PNG, XLSX up to {maxFileSizeMb}MB</p>
            <label className="btn-secondary mt-4 inline-flex cursor-pointer items-center gap-2">
              Choose files
              <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png,.xlsx" onChange={onFileInputChange} />
            </label>
          </section>

          {globalError ? (
            <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {globalError}
            </div>
          ) : null}

          <section className="panel mt-4 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-900">Upload queue</h2>
              <p className="text-sm text-[#67788f]">
                {successCount} successful / {items.length} total
              </p>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-[#6b7d93]">No files selected.</p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#e4d8c5] bg-sand-50 p-3">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink-900">{item.file.name}</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                          item.status === "success"
                            ? "bg-mint-500/15 text-mint-700"
                            : item.status === "error"
                              ? "bg-rose-500/15 text-rose-700"
                              : "bg-ink-900/10 text-ink-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#6c7d93]">{item.message}</p>
                    <div className="mt-2 h-2 rounded-full bg-[#eadfcf]">
                      <div
                        className="h-2 rounded-full bg-ink-800 transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="btn-primary mt-4 w-full"
              disabled={uploading || pendingCount === 0}
              onClick={processUploadQueue}
            >
              {uploading ? "Uploading files..." : "Start upload"}
            </button>

            {successCount > 0 && (
              <a
                className="mt-3 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                href={`/upload/${activeUploadToken || token}/status`}
              >
                View upload status &rarr;
              </a>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
};

export default PublicUploadPage;
