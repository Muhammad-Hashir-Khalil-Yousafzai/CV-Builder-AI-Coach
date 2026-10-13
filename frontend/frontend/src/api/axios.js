import axios from "axios";
import { cacheClearSuffix } from "../lib/cache";
import { clearJobsCache } from "../utils/jobsCache";

// Point this at your Django backend. Vite reads .env vars prefixed VITE_.
const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const api = axios.create({ baseURL: BASE_URL });

// ---- attach the access token on every request ----
api.interceptors.request.use((config) => {
  const access = localStorage.getItem("access");
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

// ---- if a request comes back 401, try refreshing the token once, then retry ----
let isRefreshing = false;
let queue = [];

const processQueue = (error, token = null) => {
  queue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  queue = [];
};

api.interceptors.response.use(
  (response) => {
    // Any successful change to the CV makes cached copies stale. Clear them so no page
    // can show an old CV. (Suggestion-only endpoints don't change the CV, so they are skipped.)
    const method = (response.config?.method || "get").toLowerCase();
    const url = response.config?.url || "";
    if (method !== "get" && /\/profile\//.test(url) && !/(ats-score|skill-bullet|rewrite-bullet)/.test(url)) {
      cacheClearSuffix(":profile", ":dashboard", ":versions");
      clearJobsCache();
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Auth endpoints intentionally return 401 for bad credentials —
    // that's not an expired-session case, so don't try to refresh here.
    const isAuthEndpoint =
      originalRequest.url?.includes("/auth/login/") ||
      originalRequest.url?.includes("/auth/signup/") ||
      originalRequest.url?.includes("/auth/refresh/");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // another request already triggered a refresh - wait for it
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refresh = localStorage.getItem("refresh");
      if (!refresh) {
        isRefreshing = false;
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh });
        localStorage.setItem("access", data.access);
        api.defaults.headers.Authorization = `Bearer ${data.access}`;
        processQueue(null, data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;