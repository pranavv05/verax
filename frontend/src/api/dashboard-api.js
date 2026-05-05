import { clientsApi } from "./clients-api";
import { documentsApi } from "./documents-api";
import { exportsApi } from "./exports-api";

export const dashboardApi = {
  async getOverview() {
    const [clientsResult, reviewRequiredDocsResult, pendingDocsResult, reviewedDocsResult, exportsResult] =
      await Promise.allSettled([
        clientsApi.list({ page: 1, limit: 1 }),
        documentsApi.list({ page: 1, limit: 1, status: "review_required" }),
        documentsApi.list({ page: 1, limit: 1, status: "extracted" }),
        documentsApi.list({ page: 1, limit: 1, status: "reviewed" }),
        exportsApi.history({ page: 1, limit: 20 })
      ]);

    const totalClients =
      clientsResult.status === "fulfilled"
        ? clientsResult.value?.pagination?.total ?? clientsResult.value?.data?.length ?? 0
        : 0;

    const reviewRequiredDocs =
      reviewRequiredDocsResult.status === "fulfilled"
        ? reviewRequiredDocsResult.value?.pagination?.total ?? reviewRequiredDocsResult.value?.data?.length ?? 0
        : 0;

    const extractedDocs =
      pendingDocsResult.status === "fulfilled"
        ? pendingDocsResult.value?.pagination?.total ?? pendingDocsResult.value?.data?.length ?? 0
        : 0;
    const pendingDocs = extractedDocs + reviewRequiredDocs;

    const reviewedDocs =
      reviewedDocsResult.status === "fulfilled"
        ? reviewedDocsResult.value?.pagination?.total ?? reviewedDocsResult.value?.data?.length ?? 0
        : 0;

    const exportRows =
      exportsResult.status === "fulfilled" ? exportsResult.value?.data || [] : [];

    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    const exportedThisMonth = exportRows.filter((row) => {
      if (!row.exportedAt && !row.createdAt) return false;
      const d = new Date(row.exportedAt || row.createdAt);
      return (
        d.getUTCMonth() === currentMonth &&
        d.getUTCFullYear() === currentYear &&
        row.status !== "failed"
      );
    }).length;

    return {
      totalClients,
      pendingDocs,
      reviewedDocs,
      exportedThisMonth,
      activity: exportRows.slice(0, 6)
    };
  }
};
