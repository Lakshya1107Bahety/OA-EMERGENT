import React from "react";
import { Camera, RadioTower, CheckCircle2, AlertTriangle } from "lucide-react";
import { AGREE_WITHIN_PCT } from "../plausibility";

/** Camera vs IMU cadence: two independent measurements side by side. */
export default function CadenceCheck({ check }) {
  if (!check || check.status === "none") return null;
  const agree = check.status === "agree";
  const disagree = check.status === "disagree";
  const Value = ({ icon: Icon, label, v }) => (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
      <span className="text-xs text-slate-500">{label}</span>
      <span className="font-mono text-lg font-bold text-slate-900">{v ?? "—"}</span>
    </div>
  );
  return (
    <section aria-labelledby="cadence-check" data-testid="cadence-check"
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border bg-white p-4 shadow-sm ${
        agree ? "border-emerald-200" : disagree ? "border-amber-300" : "border-slate-200"}`}>
      <h3 id="cadence-check" className="text-sm font-semibold text-slate-800">Cadence <span className="font-normal text-slate-500">steps/min</span></h3>
      <Value icon={Camera} label="Camera" v={check.camera} />
      <Value icon={RadioTower} label="IMU" v={check.imu} />
      {agree && (
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Sensors agree · {check.diffPct}% apart
        </span>
      )}
      {disagree && (
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Sensors disagree · {check.diffPct}% apart (limit {AGREE_WITHIN_PCT}%): repeat recordings
        </span>
      )}
      {check.status === "single" && (
        <span className="ml-auto text-sm text-slate-500">
          {check.camera == null ? "Camera cadence not available" : "IMU: no steady walking rhythm"}
        </span>
      )}
    </section>
  );
}
