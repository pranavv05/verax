import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi } from "vitest";

// A failed processing attempt puts the document back to "uploaded" with
// processingError set; after the last automatic retry, processingAttempts
// reaches 3. The Review page must surface the reason instead of the generic
// "refresh in a few moments" banner.
let doc;
vi.mock("../../src/api/documents-api", () => ({
  documentsApi: { getById: vi.fn(async () => doc) }
}));
vi.mock("../../src/api/extractions-api", () => ({
  extractionsApi: {
    getByDocumentId: vi.fn(async () => ({ extraction: null, message: "Document has not been processed yet." }))
  }
}));
vi.mock("../../src/api/document-versions-api", () => ({
  documentVersionsApi: { list: vi.fn(async () => ({ versions: [] })) }
}));
vi.mock("../../src/api/compliance-api", () => ({ complianceApi: {} }));
vi.mock("../../src/api/notifications-api", () => ({
  notificationsApi: { list: vi.fn(async () => ({ notifications: [], unreadCount: 0 })) }
}));
let user;
vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user, logout: vi.fn() })
}));

import ReviewPage from "../../src/pages/ReviewPage";

const renderReviewPage = () =>
  render(
    <MemoryRouter initialEntries={["/review/doc-1"]}>
      <Routes>
        <Route path="/review/:doc_id" element={<ReviewPage />} />
      </Routes>
    </MemoryRouter>
  );

const baseDoc = { id: "doc-1", fileName: "invoice.pdf", docType: "invoice", download_url: null };

beforeEach(() => {
  user = { name: "Admin", role: "admin", firmName: "Firm" };
});

describe("ReviewPage processing failure banner", () => {
  test("shows the reason and Reprocess guidance once every retry has failed", async () => {
    doc = { ...baseDoc, status: "uploaded", processingError: "AI extraction failed: Error code: 429", processingAttempts: 3 };
    renderReviewPage();

    expect(await screen.findByText("Processing failed after all automatic retries.")).toBeInTheDocument();
    expect(screen.getByText("Reason: AI extraction failed: Error code: 429")).toBeInTheDocument();
    expect(screen.getByText("Use Reprocess to try again.")).toBeInTheDocument();
    expect(screen.queryByText(/Refresh the page in a few moments/)).not.toBeInTheDocument();
  });

  test("tells staff to ask an admin, since Reprocess is admin-only", async () => {
    user = { name: "Staff", role: "staff", firmName: "Firm" };
    doc = { ...baseDoc, status: "uploaded", processingError: "AI extraction failed", processingAttempts: 3 };
    renderReviewPage();

    expect(await screen.findByText("Ask a firm admin to reprocess this document.")).toBeInTheDocument();
  });

  test("shows a retrying notice while automatic retries remain", async () => {
    doc = { ...baseDoc, status: "uploaded", processingError: "AI service request timed out", processingAttempts: 1 };
    renderReviewPage();

    expect(await screen.findByText(/retrying automatically/)).toBeInTheDocument();
    expect(screen.queryByText("Processing failed after all automatic retries.")).not.toBeInTheDocument();
  });

  test("a fresh upload with no error keeps the existing banner", async () => {
    doc = { ...baseDoc, status: "uploaded", processingError: null, processingAttempts: 0 };
    renderReviewPage();

    expect(await screen.findByText(/Refresh the page in a few moments/)).toBeInTheDocument();
    expect(screen.queryByText(/^Reason:/)).not.toBeInTheDocument();
  });
});
