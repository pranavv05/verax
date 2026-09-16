// Detects a file's real type from its leading bytes, independent of any
// client-supplied Content-Type header or file extension (both of which an
// attacker can set arbitrarily, e.g. renaming payload.exe to invoice.pdf).
const SIGNATURES = [
  { type: "pdf", check: (buf) => buf.length >= 4 && buf.toString("latin1", 0, 4) === "%PDF" },
  {
    type: "jpeg",
    check: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  },
  {
    type: "png",
    check: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
  },
  {
    type: "webp",
    check: (buf) =>
      buf.length >= 12 &&
      buf.toString("latin1", 0, 4) === "RIFF" &&
      buf.toString("latin1", 8, 12) === "WEBP"
  },
  {
    // .xlsx (and other Office Open XML formats) are ZIP archives.
    type: "xlsx",
    check: (buf) =>
      buf.length >= 4 &&
      buf[0] === 0x50 &&
      buf[1] === 0x4b &&
      (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
      (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
  },
  {
    // legacy .xls is an OLE Compound File.
    type: "xls",
    check: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0xd0 &&
      buf[1] === 0xcf &&
      buf[2] === 0x11 &&
      buf[3] === 0xe0 &&
      buf[4] === 0xa1 &&
      buf[5] === 0xb1 &&
      buf[6] === 0x1a &&
      buf[7] === 0xe1
  }
];

// Extensions/MIME types that resolve to more than one on-disk signature.
const COMPATIBLE_SIGNATURES = {
  ".pdf": ["pdf"],
  ".jpg": ["jpeg"],
  ".jpeg": ["jpeg"],
  ".png": ["png"],
  ".webp": ["webp"],
  ".xlsx": ["xlsx"],
  ".xls": ["xls", "xlsx"]
};

const detectFileSignature = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }
  const match = SIGNATURES.find(({ check }) => check(buffer));
  return match ? match.type : null;
};

// Returns true only when the file's actual byte signature matches one of the
// signatures expected for the given (already extension-validated) extension.
const matchesExpectedSignature = (buffer, extension) => {
  const expected = COMPATIBLE_SIGNATURES[extension.toLowerCase()];
  if (!expected) {
    return false;
  }
  const detected = detectFileSignature(buffer);
  return detected !== null && expected.includes(detected);
};

module.exports = {
  detectFileSignature,
  matchesExpectedSignature
};
