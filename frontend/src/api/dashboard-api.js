import { request } from "../lib/api-client";
import { exportsApi } from "./exports-api";

export const dashboardApi = {
  async getOverview() {
    const [overviewResult, activityResult] = await Promise.allSettled([
      request("/api/dashboard/overview"),
      exportsApi.history({ page: 1, limit: 6 })
    ]);

    const overview = overviewResult.status === "fulfilled" ? overviewResult.value : {};
    const activity = activityResult.status === "fulfilled" ? activityResult.value?.data || [] : [];

    return {
      totalClients: overview.totalClients ?? 0,
      pendingDocs: overview.awaitingReview ?? 0,
      reviewedDocs: overview.approvedToday ?? 0,
      exportedThisMonth: overview.exportsThisMonth ?? 0,
      activity
    };
  },

  // Review queue, pipeline, per-client progress, 14-day trend and the work
  // activity feed for the dashboard home.
  getInsights() {
    return request("/api/dashboard/insights");
  }
};
