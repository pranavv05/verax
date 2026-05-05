let accessToken = null;
let currentUser = null;

export const tokenStore = {
  getAccessToken() {
    return accessToken;
  },
  setAccessToken(token) {
    accessToken = token || null;
  },
  clearAccessToken() {
    accessToken = null;
  }
};

export const userStore = {
  getUser() {
    return currentUser;
  },
  setUser(user) {
    currentUser = user || null;
  },
  clearUser() {
    currentUser = null;
  }
};
