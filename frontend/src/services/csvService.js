/**
 * OA Sentinel - Client-Side CSV Export Service
 * Generates and downloads real CSV files locally from the browser without server dependency.
 */

export function exportIMUtoCSV(readings, filename = null) {
  if (!readings || readings.length === 0) {
    throw new Error("No sensor data available to export.");
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fname = filename || `OA_Sentinel_IMU_${ts}.csv`;

  const headers = ["timestamp", "ax", "ay", "az", "gx", "gy", "gz"];
  const rows = readings.map((r) => [
    r.timestamp,
    typeof r.ax === "number" ? r.ax.toFixed(4) : r.ax,
    typeof r.ay === "number" ? r.ay.toFixed(4) : r.ay,
    typeof r.az === "number" ? r.az.toFixed(4) : r.az,
    typeof r.gx === "number" ? r.gx.toFixed(4) : r.gx,
    typeof r.gy === "number" ? r.gy.toFixed(4) : r.gy,
    typeof r.gz === "number" ? r.gz.toFixed(4) : r.gz,
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
  downloadBlob(csvContent, fname, "text/csv;charset=utf-8;");
  return { filename: fname, count: readings.length };
}

export function exportDatasettoCSV(records, filename = null) {
  if (!records || records.length === 0) {
    throw new Error("No dataset records available to export.");
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fname = filename || `OA_Sentinel_Dataset_${ts}.csv`;

  const headers = ["timestamp", "ax", "ay", "az", "gx", "gy", "gz", "label", "patient_id", "session_id"];
  const rows = records.map((r) => [
    r.timestamp,
    typeof r.ax === "number" ? r.ax.toFixed(4) : r.ax,
    typeof r.ay === "number" ? r.ay.toFixed(4) : r.ay,
    typeof r.az === "number" ? r.az.toFixed(4) : r.az,
    typeof r.gx === "number" ? r.gx.toFixed(4) : r.gx,
    typeof r.gy === "number" ? r.gy.toFixed(4) : r.gy,
    typeof r.gz === "number" ? r.gz.toFixed(4) : r.gz,
    r.label || "normal",
    r.patient_id || "ANONYMOUS",
    r.session_id || "DEFAULT",
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
  downloadBlob(csvContent, fname, "text/csv;charset=utf-8;");
  return { filename: fname, count: records.length };
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default {
  exportIMUtoCSV,
  exportDatasettoCSV,
};
