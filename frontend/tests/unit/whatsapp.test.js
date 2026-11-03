import { describe, expect, test } from "vitest";
import { buildWhatsAppShareUrl, toWhatsAppPhone } from "../../src/lib/whatsapp";

describe("toWhatsAppPhone", () => {
  test("a plain 10-digit Indian mobile number gets +91 prepended", () => {
    // This is the real shape of every client's phone number: client-import's
    // validatePhone rejects anything that isn't exactly 10 digits, so wa.me
    // (which requires the full international number) would otherwise open
    // the wrong chat for every single client.
    expect(toWhatsAppPhone("9876543210")).toBe("919876543210");
  });

  test("strips spaces and dashes before counting digits", () => {
    expect(toWhatsAppPhone("98765-43210")).toBe("919876543210");
    expect(toWhatsAppPhone("98765 43210")).toBe("919876543210");
  });

  test("an 11-digit number with a leading trunk 0 has the 0 replaced with 91", () => {
    expect(toWhatsAppPhone("09876543210")).toBe("919876543210");
  });

  test("a number already carrying +91 (12 digits) is left as-is", () => {
    expect(toWhatsAppPhone("+919876543210")).toBe("919876543210");
  });

  test("empty/missing phone yields an empty string, not '91'", () => {
    expect(toWhatsAppPhone("")).toBe("");
    expect(toWhatsAppPhone(null)).toBe("");
    expect(toWhatsAppPhone(undefined)).toBe("");
  });
});

describe("buildWhatsAppShareUrl", () => {
  test("includes the country-coded number and an encoded message", () => {
    const url = buildWhatsAppShareUrl({ phone: "9876543210", message: "Hi there" });
    expect(url).toBe("https://wa.me/919876543210?text=Hi%20there");
  });

  test("falls back to the bare contact-picker link with no phone", () => {
    const url = buildWhatsAppShareUrl({ phone: "", message: "Hi there" });
    expect(url).toBe("https://wa.me/?text=Hi%20there");
  });

  test("a message containing special characters is safely encoded, not injected raw", () => {
    const url = buildWhatsAppShareUrl({
      phone: "9876543210",
      message: "Upload here: https://verax.example/u/abc?x=1&y=2"
    });
    expect(url).toBe(
      "https://wa.me/919876543210?text=Upload%20here%3A%20https%3A%2F%2Fverax.example%2Fu%2Fabc%3Fx%3D1%26y%3D2"
    );
  });
});
