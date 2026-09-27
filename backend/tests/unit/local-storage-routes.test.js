jest.mock("../../src/config/env", () => ({
  ...jest.requireActual("../../src/config/env"),
  LOCAL_STORAGE: true
}));

const fs = require("fs/promises");
const path = require("path");
const express = require("express");
const request = require("supertest");
const {
  LOCAL_STORAGE_ROOT,
  resolveLocalStoragePath,
  createDownloadUrl,
  createUploadUrl,
  verifyLocalStorageSignature
} = require("../../src/services/s3.service");
const localUploadRoutes = require("../../src/routes/local-upload.routes");

const app = express();
app.use("/api", localUploadRoutes);
app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));

const KEY = `unit-test-${process.pid}/statement.pdf`;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

// The API issues absolute localhost URLs; supertest wants the path + query.
const pathOf = (url) => {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
};

afterAll(async () => {
  await fs.rm(path.join(LOCAL_STORAGE_ROOT, `unit-test-${process.pid}`), { recursive: true, force: true });
});

describe("resolveLocalStoragePath", () => {
  test.each([
    "../secrets.env",
    "a/../../escape.txt",
    "../local-storage-backup/file.pdf",
    `..${path.sep}x`
  ])("rejects %s", (key) => {
    expect(() => resolveLocalStoragePath(key)).toThrow("Invalid local storage path");
  });

  test("rejects the storage root itself", () => {
    expect(() => resolveLocalStoragePath("")).toThrow("Invalid local storage path");
  });

  test("accepts a normal key inside the root", () => {
    expect(resolveLocalStoragePath("firm/doc.pdf")).toBe(path.join(LOCAL_STORAGE_ROOT, "firm", "doc.pdf"));
  });
});

describe("signed local-storage URLs", () => {
  test("an issued upload URL and download URL work end to end", async () => {
    const { url: uploadUrl } = await createUploadUrl({ key: KEY, contentType: "application/pdf" });
    const put = await request(app).put(pathOf(uploadUrl)).set("Content-Type", "application/pdf").send(PDF);
    expect(put.status).toBe(200);

    const { url: downloadUrl } = await createDownloadUrl({ key: KEY, expiresIn: 60 });
    const get = await request(app).get(pathOf(downloadUrl));
    expect(get.status).toBe(200);
  });

  test("a file can't be read without a signature", async () => {
    const res = await request(app).get(`/api/local-files/${encodeURIComponent(KEY)}`);
    expect(res.status).toBe(403);
  });

  test("a file can't be written without a signature", async () => {
    const res = await request(app)
      .put(`/api/local-upload/${encodeURIComponent(KEY)}`)
      .set("Content-Type", "application/pdf")
      .send(PDF);
    expect(res.status).toBe(403);
  });

  test("a signature for one file doesn't open another", async () => {
    const { url } = await createDownloadUrl({ key: KEY, expiresIn: 60 });
    const other = pathOf(url).replace(encodeURIComponent(KEY), encodeURIComponent(`unit-test-${process.pid}/other.pdf`));
    expect((await request(app).get(other)).status).toBe(403);
  });

  test("a download signature can't be used to upload", async () => {
    const { url } = await createDownloadUrl({ key: KEY, expiresIn: 60 });
    const uploadPath = pathOf(url).replace("/api/local-files/", "/api/local-upload/");
    const res = await request(app).put(uploadPath).set("Content-Type", "application/pdf").send(PDF);
    expect(res.status).toBe(403);
  });

  test("an expired link is refused", async () => {
    const { url } = await createDownloadUrl({ key: KEY, expiresIn: 60 });
    const { searchParams } = new URL(url);
    expect(
      verifyLocalStorageSignature({
        action: "download",
        key: KEY,
        expires: searchParams.get("expires"),
        signature: searchParams.get("signature"),
        now: Date.now() + 61 * 1000
      })
    ).toBe(false);
  });

  test("a tampered expiry is refused", async () => {
    const { url } = await createDownloadUrl({ key: KEY, expiresIn: 60 });
    const tampered = pathOf(url).replace(/expires=(\d+)/, (_, value) => `expires=${Number(value) + 86400}`);
    expect((await request(app).get(tampered)).status).toBe(403);
  });
});
