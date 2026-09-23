// Lightweight CSV parsing + sensor-column mean computation for the dataset tab.

const COLUMN_ALIASES = {
  acc_x: ["acc_x", "accx", "ax", "accel_x", "accelerometer_x"],
  acc_y: ["acc_y", "accy", "ay", "accel_y", "accelerometer_y"],
  acc_z: ["acc_z", "accz", "az", "accel_z", "accelerometer_z"],
  gyro_x: ["gyro_x", "gyrox", "gx", "gyr_x", "gyroscope_x"],
  gyro_y: ["gyro_y", "gyroy", "gy", "gyr_y", "gyroscope_y"],
  gyro_z: ["gyro_z", "gyroz", "gz", "gyr_z", "gyroscope_z"],
};

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      const raw = (cells[i] ?? "").trim();
      const num = Number(raw);
      obj[h] = raw !== "" && !Number.isNaN(num) ? num : raw;
    });
    return obj;
  });
  return { headers, rows };
}

// Map a header to its canonical sensor axis (or null).
function canonical(header) {
  const h = header.toLowerCase().replace(/\s|-/g, "_");
  for (const [canon, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(h)) return canon;
  }
  return null;
}

// Returns { acc_x: mean, ... } for recognised sensor columns.
export function computeSensorMeans(headers, rows) {
  const sums = {};
  const counts = {};
  for (const h of headers) {
    const c = canonical(h);
    if (!c) continue;
    for (const row of rows) {
      const v = row[h];
      if (typeof v === "number" && !Number.isNaN(v)) {
        sums[c] = (sums[c] || 0) + v;
        counts[c] = (counts[c] || 0) + 1;
      }
    }
  }
  const means = {};
  for (const c of Object.keys(sums)) {
    means[c] = +(sums[c] / counts[c]).toFixed(4);
  }
  return means;
}

export const DATASET_MEANS_KEY = "jc_dataset_means";

export function saveDatasetMeans(means, filename, rowCount) {
  localStorage.setItem(DATASET_MEANS_KEY, JSON.stringify({ means, filename, rowCount, at: new Date().toISOString() }));
}

export function loadDatasetMeans() {
  try {
    return JSON.parse(localStorage.getItem(DATASET_MEANS_KEY) || "null");
  } catch {
    return null;
  }
}
