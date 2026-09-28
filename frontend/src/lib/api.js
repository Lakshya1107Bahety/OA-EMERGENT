import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 15000 });

// ---- Backend wake-up ------------------------------------------------------
// The backend runs on Render's free plan, which sleeps after ~15 minutes idle
// and needs 30-60 s to start again. Before sending a request to a backend that
// has not answered recently, wait for /health first. Requests are never
// re-sent, so a slow POST cannot be saved twice.
const WAKE_TIMEOUT_MS = 75000;
const ASSUME_AWAKE_MS = 10 * 60 * 1000;

let lastOkAt = 0;
let wakePromise = null;
let status = "unknown"; // unknown | waking | ready | down
const listeners = new Set();

function setStatus(s) {
  if (s === status) return;
  status = s;
  listeners.forEach((fn) => fn(s));
}

export function getBackendStatus() {
  return status;
}

export function onBackendStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function wakeBackend() {
  if (Date.now() - lastOkAt < ASSUME_AWAKE_MS) return Promise.resolve(true);
  if (!wakePromise) {
    // Only show "waking up" if the first answer takes longer than 1.5 s.
    const slow = setTimeout(() => setStatus("waking"), 1500);
    wakePromise = axios
      .get(`${BACKEND_URL}/health`, { timeout: WAKE_TIMEOUT_MS })
      .then(() => {
        lastOkAt = Date.now();
        setStatus("ready");
        return true;
      })
      .catch(() => {
        setStatus("down");
        return false;
      })
      .finally(() => {
        clearTimeout(slow);
        wakePromise = null;
      });
  }
  return wakePromise;
}

api.interceptors.request.use(async (config) => {
  await wakeBackend(); // if it stays down, the request fails normally below
  const token = localStorage.getItem("jc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    lastOkAt = Date.now();
    setStatus("ready");
    return response;
  },
  (error) => {
    if (error.response) {
      lastOkAt = Date.now(); // the server answered, even if with an error
      setStatus("ready");
    }
    return Promise.reject(error);
  }
);

export function wsSensorUrl(sessionId) {
  const base = BACKEND_URL.replace(/^http/, "ws");
  return `${base}/api/ws/sensor/${sessionId}`;
}

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
