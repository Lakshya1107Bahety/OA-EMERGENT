import React from "react";
import { ShieldCheck, ShieldAlert, FlaskConical } from "lucide-react";

/** Tells the clinician whether a number is backed by reference data. */
export default function CalibrationBadge({ calibrated, demo = false, notScored = false }) {
  if (notScored) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-700">
        Listed, not scored
      </span>
    );
  }
  const status = calibrated ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
      <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Calibrated
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
      <ShieldAlert className="h-3 w-3" aria-hidden="true" /> Uncalibrated
    </span>
  );
  if (!demo) return status;
  // Demo/simulated data: show both, so the calibration status is never hidden.
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-800">
        <FlaskConical className="h-3 w-3" aria-hidden="true" /> Demo data
      </span>
      {status}
    </span>
  );
}
