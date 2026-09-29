import React from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { AGREE_WITHIN_PCT, CADENCE_RANGE } from "../plausibility";

/** Camera vs IMU cadence: two independent measurements, compared side by side. */
export default function CadenceCheck({ check }) {
  if (!check || check.status === "none") return null;
  const v = (x) => (x == null ? "—" : `${x}`);
  const tone = check.status === "agree" ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : check.status === "disagree" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-800";
  const Icon = check.status === "agree" ? CheckCircle2 : check.status === "disagree" ? AlertTriangle : Info;
  const msg = check.status === "agree" ? `Sensors agree (${check.diffPct}% apart, limit ${AGREE_WITHIN_PCT}%).`
    : check.status === "disagree" ? `Sensors disagree (${check.diffPct}% apart, limit ${AGREE_WITHIN_PCT}%): repeat both recordings.`
    : check.camera == null ? "Camera cadence not available." : "IMU cadence not available (no steady walking rhythm in the IMU recording).";
  return (
    <section aria-labelledby="cadence-check" className={`rounded-2xl border p-4 text-sm ${tone}`} data-testid="cadence-check">
      <h3 id="cadence-check" className="flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4" aria-hidden="true" /> Cadence check: camera vs IMU
      </h3>
      <p className="mt-1 font-mono">
        Camera {v(check.camera)} · IMU {v(check.imu)} steps/min
      </p>
      <p className="mt-1">{msg}</p>
      <p className="mt-1 text-xs opacity-75">
        Each sensor measures cadence on its own; values are compared, never copied or averaged into the score.
        Values outside {CADENCE_RANGE[0]}–{CADENCE_RANGE[1]} steps/min are rejected as measurement errors.
      </p>
    </section>
  );
}
