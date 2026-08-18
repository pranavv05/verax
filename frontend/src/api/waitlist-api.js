const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const waitlistApi = {
  async join({ email, firmName, contactName, phone }) {
    const response = await fetch(`${BASE_URL}/api/waitlist/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, firmName, contactName, phone })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || "Request failed");
      error.data = data;
      throw error;
    }
    return data;
  }
};
