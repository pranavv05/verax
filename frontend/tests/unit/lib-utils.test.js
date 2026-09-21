import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDate, formatDateTime, parseApiError, cn, triggerFileDownload } from "../../src/lib/utils";

describe("formatDate", () => {
  test("returns '-' for falsy input", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
    expect(formatDate("")).toBe("-");
  });

  test("returns '-' for an unparseable date string", () => {
    expect(formatDate("not-a-date")).toBe("-");
  });

  test("formats a valid ISO date in en-IN day/month/year form", () => {
    const result = formatDate("2024-11-12T00:00:00.000Z");
    expect(result).toMatch(/12/);
    expect(result).toMatch(/2024/);
  });
});

describe("formatDateTime", () => {
  test("returns '-' for falsy or unparseable input", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime("garbage")).toBe("-");
  });

  test("includes both date and time components for a valid input", () => {
    const result = formatDateTime("2024-11-12T10:30:00.000Z");
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/:/); // hour:minute separator
  });
});

describe("parseApiError", () => {
  test("returns the fallback when error is falsy", () => {
    expect(parseApiError(null, "default message")).toBe("default message");
    expect(parseApiError(undefined)).toBe("Something went wrong");
  });

  test("returns the error directly when it is a string", () => {
    expect(parseApiError("Invalid GSTIN")).toBe("Invalid GSTIN");
  });

  test("returns error.message when present", () => {
    expect(parseApiError(new Error("Network failure"))).toBe("Network failure");
  });

  test("falls back when error has no message", () => {
    expect(parseApiError({}, "fallback text")).toBe("fallback text");
  });
});

describe("cn", () => {
  test("joins truthy class name parts with a space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  test("filters out falsy parts (false, null, undefined, empty string)", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  test("returns an empty string when nothing is truthy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });
});

describe("triggerFileDownload", () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  test("does nothing when no url is given", async () => {
    global.fetch = vi.fn();
    await triggerFileDownload(null, "file.pdf");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("throws a clear error when the fetch response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(triggerFileDownload("https://example.com/file.pdf", "file.pdf")).rejects.toThrow(
      /403/
    );
  });

  test("fetches the URL, creates a blob link, clicks it, and revokes the object URL", async () => {
    const mockBlob = new Blob(["file bytes"]);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => mockBlob });

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = originalCreateElement(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });

    await triggerFileDownload("https://example.com/export.xml", "export.xml");

    expect(global.fetch).toHaveBeenCalledWith("https://example.com/export.xml");
    expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
