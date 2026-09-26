// Uploads go straight from the browser to storage via a presigned URL, so the
// size/type declared at /upload time is only a claim. Confirm must check the
// object that actually arrived — its real size and leading bytes — and must
// not create a document (or queue OCR) for anything else.
jest.mock("../../src/services/s3.service", () => ({
  createUploadUrl: jest.fn(),
  createDownloadUrl: jest.fn(),
  inspectStoredObject: jest.fn(),
  deleteObject: jest.fn()
}));

const env = require("../../src/config/env");
const { inspectStoredObject, deleteObject } = require("../../src/services/s3.service");
const { confirmUploadForFirm } = require("../../src/services/documents.service");
const { assertStoredUploadIsValid } = require("../../src/utils/upload-validation");

const PDF_HEAD = Buffer.from("%PDF-1.7\n");
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXE_HEAD = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
const MAX_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;

describe("assertStoredUploadIsValid", () => {
  test("accepts a real PDF within the size limit", () => {
    expect(() => assertStoredUploadIsValid({ fileName: "invoice.pdf", size: 2048, head: PDF_HEAD })).not.toThrow();
  });

  test("accepts a file exactly at the size limit", () => {
    expect(() => assertStoredUploadIsValid({ fileName: "scan.png", size: MAX_BYTES, head: PNG_HEAD })).not.toThrow();
  });

  test("rejects a file over the size limit, whatever size was declared", () => {
    expect(() => assertStoredUploadIsValid({ fileName: "invoice.pdf", size: MAX_BYTES + 1, head: PDF_HEAD })).toThrow(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  test("rejects an empty object", () => {
    expect(() => assertStoredUploadIsValid({ fileName: "invoice.pdf", size: 0, head: Buffer.alloc(0) })).toThrow(
      "Uploaded file is empty"
    );
  });

  test("rejects an executable renamed to .pdf", () => {
    expect(() => assertStoredUploadIsValid({ fileName: "invoice.pdf", size: 4096, head: EXE_HEAD })).toThrow(
      expect.objectContaining({ statusCode: 422, error: "INVALID_FILE_TYPE" })
    );
  });

  test("rejects a real PDF stored under an image name", () => {
    expect(() => assertStoredUploadIsValid({ fileName: "scan.png", size: 4096, head: PDF_HEAD })).toThrow(
      expect.objectContaining({ statusCode: 422 })
    );
  });
});

describe("confirmUploadForFirm stored-object checks", () => {
  const session = {
    id: "11111111-1111-4111-8111-111111111111",
    firm_id: "firm-1",
    client_id: "client-1",
    file_name: "invoice.pdf",
    s3_key: "firm-1/client-1/11111111/invoice.pdf",
    doc_type: "invoice",
    upload_expires_at: new Date(Date.now() + 60 * 1000),
    confirmed_at: null
  };

  const makeDb = () => ({
    query: jest.fn(async (sql) => {
      if (/FROM document_upload_sessions/.test(sql)) {
        return { rowCount: 1, rows: [session] };
      }
      if (/INSERT INTO documents/.test(sql)) {
        return {
          rowCount: 1,
          rows: [{ ...session, status: "uploaded", uploaded_at: new Date() }]
        };
      }
      return { rowCount: 1, rows: [] };
    })
  });

  const insertedDocument = (db) => db.query.mock.calls.some(([sql]) => /INSERT INTO documents/.test(sql));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("creates the document when the stored object is a valid file", async () => {
    inspectStoredObject.mockResolvedValue({ size: 2048, head: PDF_HEAD });
    const db = makeDb();

    const result = await confirmUploadForFirm(db, { firmId: "firm-1", userId: "user-1", documentId: session.id });

    expect(inspectStoredObject).toHaveBeenCalledWith({ key: session.s3_key });
    expect(insertedDocument(db)).toBe(true);
    expect(deleteObject).not.toHaveBeenCalled();
    expect(result.queuePayload.s3Key).toBe(session.s3_key);
  });

  test("rejects a disguised file, deletes it, and creates no document", async () => {
    inspectStoredObject.mockResolvedValue({ size: 4096, head: EXE_HEAD });
    const db = makeDb();

    await expect(
      confirmUploadForFirm(db, { firmId: "firm-1", userId: "user-1", documentId: session.id })
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(deleteObject).toHaveBeenCalledWith({ key: session.s3_key });
    expect(insertedDocument(db)).toBe(false);
  });

  test("rejects an oversized upload even though a small size was declared", async () => {
    inspectStoredObject.mockResolvedValue({ size: MAX_BYTES * 3, head: PDF_HEAD });
    const db = makeDb();

    await expect(
      confirmUploadForFirm(db, { firmId: "firm-1", userId: "user-1", documentId: session.id })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(deleteObject).toHaveBeenCalledWith({ key: session.s3_key });
    expect(insertedDocument(db)).toBe(false);
  });

  test("still returns the validation error if deleting the rejected object fails", async () => {
    inspectStoredObject.mockResolvedValue({ size: 4096, head: EXE_HEAD });
    deleteObject.mockRejectedValue(new Error("S3 unavailable"));
    const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);

    await expect(
      confirmUploadForFirm(makeDb(), { firmId: "firm-1", userId: "user-1", documentId: session.id })
    ).rejects.toMatchObject({ statusCode: 422 });

    stderr.mockRestore();
  });

  test("propagates a missing-object error without creating a document", async () => {
    const notFound = Object.assign(new Error("Uploaded file was not found in object storage"), { statusCode: 400 });
    inspectStoredObject.mockRejectedValue(notFound);
    const db = makeDb();

    await expect(
      confirmUploadForFirm(db, { firmId: "firm-1", userId: "user-1", documentId: session.id })
    ).rejects.toThrow("Uploaded file was not found in object storage");

    expect(insertedDocument(db)).toBe(false);
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
