import axios from "axios";
import { api } from "@/lib/api";

export const OA_API_URL = process.env.REACT_APP_OA_API_URL || "http://127.0.0.1:5000";

export async function checkHealth() {
  try {
    const { data } = await api.get("/oa/health");
    return data;
  } catch (err) {
    try {
      const direct = await axios.get(`${OA_API_URL}/health`, { timeout: 3500 });
      return { connected: true, status_code: direct.status, upstream: true, url: OA_API_URL };
    } catch (e2) {
      return { connected: false, detail: "Could not reach server" };
    }
  }
}

export async function analyze({ patient, camera_results, patient_id }) {
  try {
    const { data } = await api.post("/oa/analyze", { patient, camera_results, patient_id });
    return data;
  } catch (err) {
    const direct = await axios.post(`${OA_API_URL}/analyze`, { patient, camera_results, patient_id }, { timeout: 15000 });
    return { success: true, result: direct.data };
  }
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

// The 10 biomechanical feature fields the Isolation Forest model needs.
// DO NOT include biomechanical_prediction / biomechanical_score here —
// the Flask screen_trials() will only run the trained model if those columns
// are ABSENT from the incoming DataFrame. Sending them as 0 prevents model inference.
export const BIOMECH_NUMERIC_FIELDS = [
  "right_knee_rom_deg", "left_knee_rom_deg", "right_hip_rom_deg", "left_hip_rom_deg",
  "step_duration_sec", "stride_duration_sec", "cadence_steps_min",
  "knee_rom_asymmetry_pct", "step_time_asymmetry_pct", "trunk_lean_deg",
];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Normalize each trial row to only the 10 Isolation Forest feature fields.
// biomechanical_prediction and biomechanical_score are intentionally excluded
// so the Flask screen_trials() runs the trained model to compute them fresh.
export function normalizeCameraResults(rows, participantId) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row, i) => {
    const out = { participant_id: String(row.participant_id ?? participantId ?? `P${i + 1}`) };
    for (const f of BIOMECH_NUMERIC_FIELDS) {
      const v = num(row[f]);
      // Only include the field if it has a real value (avoid 0-padding missing camera fields)
      if (v !== 0 || row[f] !== undefined) out[f] = v;
    }
    return out;
  });
}
