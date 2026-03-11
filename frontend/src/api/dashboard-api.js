import { clientsApi } from "./clients-api";
import { documentsApi } from "./documents-api";
import { exportsApi } from "./exports-api";

export const dashboardApi = {
  async getOverview() {
    const [clientsResult, docsResult, exportsResult] = await Promise.allSettled([
      clientsApi.list({ page: 1, limit: 1 }),
      documentsApi.list({ page: 1, limit: 20, status: "uploaded" }),
      exportsApi.history({ page: 1, limit: 20 })
    ]);

    const totalClients =
      clientsResult.status === "fulfilled" ? clientsResult.value?.pagination?.total || 0 : 0;

    const pendingDocs =
      docsResult.status === "fulfilled"
        ? docsResult.value?.pagination?.total || docsResult.value?.data?.length || 0
        : 0;

    const exportRows =
      exportsResult.status === "fulfilled" ? exportsResult.value?.data || [] : [];

    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    const exportedThisMonth = exportRows.filter((row) => {
      if (!row.exportedAt) {
        return false;
      }
      const exportedDate = new Date(row.exportedAt);
      return (
        exportedDate.getUTCMonth() === currentMonth &&
        exportedDate.getUTCFullYear() === currentYear &&
        row.status !== "failed"
      );
    }).length;

    return {
      totalClients,
      pendingDocs,
      exportedThisMonth,
      activity: exportRows.slice(0, 6)
    };
  }
};
