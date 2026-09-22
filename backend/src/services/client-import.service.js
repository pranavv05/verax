const ExcelJS = require("exceljs");
const ApiError = require("../utils/api-error");
const { validateGstin } = require("./compliance.service");
const { createClient } = require("./clients.service");

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;
const ALLOWED_EXTENSIONS = new Set(["csv", "xlsx"]);
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const TEMPLATE_HEADERS = ["client_name", "gstin", "email", "phone", "status"];
const TEMPLATE_EXAMPLE_ROW = [
  "Example Client",
  "29AABCS1429B1Z1",
  "client@example.com",
  "9876543210",
  "active"
];

const HEADER_ALIASES = {
  client_name: "client_name",
  clientname: "client_name",
  name: "client_name",
  gstin: "gstin",
  email: "email",
  phone: "phone",
  status: "status"
};

const buildTemplateCsv = () => {
  const rows = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE_ROW];
  return rows.map((row) => row.join(",")).join("\r\n") + "\r\n";
};

/**
 * Minimal RFC4180-ish CSV parser: handles quoted fields, escaped quotes ("")
 * and commas/newlines inside quotes. No external dependency needed for the
 * template's shape (plain fields, occasional quoting).
 */
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  // Trailing field/row (file may not end with a newline)
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
};

// Stringifies one ExcelJS cell value the same way XLSX's sheet_to_json
// {raw: false} option did: numbers/dates/booleans become their display
// string, null/undefined become "". A rich-text cell ({richText: [...]})
// or a formula cell ({formula, result}) is flattened to its plain text/
// result rather than the raw object, since every downstream consumer here
// (validateRow) expects a plain string.
const stringifyCellValue = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("result" in value) return stringifyCellValue(value.result);
    if ("text" in value) return String(value.text);
    return "";
  }
  return String(value);
};

const parseFileToRows = async (file) => {
  const extension = (file.originalname.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw ApiError.badRequest("Only CSV and XLSX files are supported");
  }

  let matrix;
  if (extension === "csv") {
    const text = file.buffer.toString("utf8");
    matrix = parseCsv(text);
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const worksheet = workbook.worksheets[0];
    matrix = [];
    if (worksheet) {
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        // row.values is 1-indexed ([0] is always undefined) — drop it so
        // column indices line up with the 0-indexed header/data rows the
        // rest of this file expects.
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        matrix.push(values.map(stringifyCellValue));
      });
    }
  }

  // Drop fully blank rows (all cells empty/whitespace) — including a trailing
  // blank line at the end of a CSV file.
  matrix = matrix.filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));

  return matrix;
};

const normalizeHeaderRow = (headerRow) => {
  const columnIndexByField = {};
  headerRow.forEach((rawHeader, index) => {
    const key = String(rawHeader ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    const field = HEADER_ALIASES[key];
    if (field && !(field in columnIndexByField)) {
      columnIndexByField[field] = index;
    }
  });
  return columnIndexByField;
};

const cellValue = (row, columnIndexByField, field) => {
  const index = columnIndexByField[field];
  if (index === undefined) return "";
  return String(row[index] ?? "").trim();
};

const validatePhone = (rawPhone) => {
  const stripped = rawPhone.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(stripped)) {
    return { valid: false };
  }
  return { valid: true, value: stripped };
};

const validateRow = (row, columnIndexByField, seenGstins) => {
  const issues = [];
  let severity = "valid"; // 'valid' | 'warning' | 'error'

  const clientName = cellValue(row, columnIndexByField, "client_name");
  const rawGstin = cellValue(row, columnIndexByField, "gstin").toUpperCase();
  const rawEmail = cellValue(row, columnIndexByField, "email");
  const rawPhone = cellValue(row, columnIndexByField, "phone");
  const rawStatus = cellValue(row, columnIndexByField, "status").toLowerCase();

  // client_name
  if (!clientName) {
    issues.push("Client name is required");
    severity = "error";
  } else if (clientName.length < 2) {
    issues.push("Client name must be at least 2 characters");
    severity = "error";
  } else if (clientName.length > 255) {
    issues.push("Client name must be at most 255 characters");
    severity = "error";
  }

  // gstin
  // validateGstin() returns severity "error" for structural problems (wrong
  // length, bad state code, bad PAN pattern) and severity "warning" for a
  // checksum mismatch / non-'Z' 14th char. Only structural problems block
  // the import row — a checksum-only mismatch is common with fabricated or
  // slightly-mistyped GSTINs and is treated as passing here, same as the
  // GSTIN checksum warning already treated as non-blocking on the Review page.
  let gstin = null;
  if (rawGstin) {
    if (rawGstin.length !== 15) {
      issues.push("Invalid GSTIN format");
      severity = "error";
    } else {
      const result = validateGstin(rawGstin);
      if (!result.valid && result.severity === "error") {
        issues.push("Invalid GSTIN format");
        severity = "error";
      } else {
        gstin = rawGstin;
        if (seenGstins.has(gstin)) {
          issues.push("Duplicate GSTIN in this file");
          severity = "error";
        }
      }
    }
  }

  // email
  let email = null;
  if (rawEmail) {
    if (!EMAIL_REGEX.test(rawEmail)) {
      issues.push("Invalid email format");
      severity = "error";
    } else {
      email = rawEmail;
    }
  }

  // phone
  let phone = null;
  if (rawPhone) {
    const phoneResult = validatePhone(rawPhone);
    if (!phoneResult.valid) {
      issues.push("Phone must be exactly 10 digits");
      severity = "error";
    } else {
      phone = phoneResult.value;
    }
  }

  // status
  let status = "active";
  if (rawStatus) {
    if (rawStatus !== "active" && rawStatus !== "inactive") {
      issues.push("Status must be 'active' or 'inactive'");
      severity = "error";
    } else {
      status = rawStatus;
    }
  }

  if (severity !== "error") {
    if (!email) issues.push("Email missing — client reminders won't work");
    if (!phone) issues.push("Phone missing — WhatsApp won't work");
    if (!email || !phone) severity = "warning";
  }

  if (gstin && severity !== "error") {
    seenGstins.add(gstin);
  }

  return {
    status: severity,
    data: {
      clientName: clientName || null,
      gstin,
      email,
      phone,
      status
    },
    issues
  };
};

const previewClientImport = async (file) => {
  if (!file) {
    throw ApiError.badRequest("No file uploaded");
  }
  if (file.size === 0) {
    throw ApiError.badRequest("The file is empty");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw ApiError.badRequest("File exceeds 5MB limit");
  }

  let matrix;
  try {
    matrix = await parseFileToRows(file);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.badRequest("Could not read this file — it may be corrupted or not a valid CSV/XLSX file");
  }
  if (matrix.length === 0) {
    throw ApiError.badRequest("The file is empty");
  }

  const [headerRow, ...dataRows] = matrix;
  const columnIndexByField = normalizeHeaderRow(headerRow);

  if (columnIndexByField.client_name === undefined) {
    throw ApiError.badRequest(
      "Required column 'client_name' is missing. Please download the template."
    );
  }

  if (dataRows.length === 0) {
    throw ApiError.badRequest("No client data found in file");
  }
  if (dataRows.length > MAX_ROWS) {
    throw ApiError.badRequest(`File exceeds maximum of ${MAX_ROWS} rows`);
  }

  const seenGstins = new Set();
  const rows = dataRows.map((row, i) => {
    const result = validateRow(row, columnIndexByField, seenGstins);
    return {
      rowNumber: i + 2, // +1 for header row, +1 for 1-based numbering
      ...result
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { valid: 0, warning: 0, error: 0 }
  );

  return {
    total: rows.length,
    valid: summary.valid,
    warnings: summary.warning,
    errors: summary.error,
    rows
  };
};

const confirmClientImport = async (db, { firmId, actorUserId, rows }) => {
  const existingResult = await db.query(
    `SELECT name, gstin FROM clients WHERE firm_id = $1 AND deleted_at IS NULL`,
    [firmId]
  );
  const existingGstins = new Set(
    existingResult.rows.filter((r) => r.gstin).map((r) => r.gstin.toUpperCase())
  );
  const existingNamesWithoutGstin = new Set(
    existingResult.rows.filter((r) => !r.gstin).map((r) => r.name.trim().toLowerCase())
  );

  let imported = 0;
  let skipped = 0;
  const skippedReasons = [];

  for (const row of rows) {
    const data = row?.data || {};
    const clientName = String(data.clientName || "").trim();
    const gstin = data.gstin ? String(data.gstin).toUpperCase() : null;

    if (!clientName) {
      skipped += 1;
      skippedReasons.push("Row missing client name");
      continue;
    }

    if (gstin && existingGstins.has(gstin)) {
      skipped += 1;
      skippedReasons.push(`GSTIN ${gstin} already exists`);
      continue;
    }

    if (!gstin && existingNamesWithoutGstin.has(clientName.toLowerCase())) {
      skipped += 1;
      skippedReasons.push(`Client name '${clientName}' already exists`);
      continue;
    }

    await createClient(db, {
      firmId,
      actorUserId,
      payload: {
        name: clientName,
        gstin: gstin || null,
        email: data.email || null,
        phone: data.phone || null,
        status: data.status === "inactive" ? "inactive" : "active"
      }
    });

    imported += 1;
    if (gstin) existingGstins.add(gstin);
    else existingNamesWithoutGstin.add(clientName.toLowerCase());
  }

  await db.query(
    `
      INSERT INTO audit_logs (
        firm_id,
        user_id,
        action,
        entity_type,
        entity_id,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      firmId,
      actorUserId ?? null,
      "clients_bulk_imported",
      "client",
      null,
      JSON.stringify({ imported, skipped, skippedReasons })
    ]
  );

  return { imported, skipped, skippedReasons, errors: [] };
};

module.exports = {
  MAX_FILE_SIZE_BYTES,
  MAX_ROWS,
  buildTemplateCsv,
  previewClientImport,
  confirmClientImport
};
