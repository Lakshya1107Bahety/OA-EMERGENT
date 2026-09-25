import { api } from "@/lib/api";

// External OA Sentinel API URL (configured via env). Requests are proxied through
// our backend to avoid the external API's missing CORS headers.
export const OA_API_URL = process.env.REACT_APP_OA_API_URL || "";

export async function checkHealth() {
  const { data } = await api.get("/oa/health");
  return data; // { connected, status_code, upstream, url }
}

export async function analyze({ patient, camera_results, patient_id }) {
  const { data } = await api.post("/oa/analyze", { patient, camera_results, patient_id });
  return data; // { success, result }
}

// Average consecutive rows in chunks of `size`. Numeric columns are averaged;
// non-numeric columns take the value from the first row of each chunk.
export function averageEvery(rows, size = 20) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const out = [];
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const keys = Object.keys(chunk[0] || {});
    const agg = {};
    for (const k of keys) {
      const nums = chunk.map((r) => r[k]).filter((v) => typeof v === "number" && !Number.isNaN(v));
      if (nums.length === chunk.length && nums.length > 0) {
        agg[k] = +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4);
      } else {
        agg[k] = chunk[0][k];
      }
    }
    out.push(agg);
  }
  return out;
}

// Read the last live sensor session (BLE/simulator) cached by the Screening page.
export function loadLastSession() {
  try {
    return JSON.parse(localStorage.getItem("jc_last_session") || "[]");
  } catch {
    return [];
  }
}

// Flexible getter: returns the first present key from candidates.
export function pick(obj, candidates) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of candidates) {
    for (const actual of Object.keys(obj)) {
      if (actual.toLowerCase() === key.toLowerCase()) return obj[actual];
    }
  }
  return undefined;
}
