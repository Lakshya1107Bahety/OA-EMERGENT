import React from "react";
import { Activity, Loader2, WifiOff, AlertTriangle } from "lucide-react";
import { GAIT_REF, GAIT_LABEL, GAIT_UNIT, gaitZ } from "../gaitReference";

const BAND = {
  Low: "border-emerald-300 bg-emerald-50 text-emerald-900",
  Moderate: "border-amber-300 bg-amber-50 text-amber-900",
  High: "border-red-300 bg-red-50 text-red-900",
};

/**
 * Live analysis for the camera step: the latest trial's ten measurements
 * against the reference cohort, plus the gait deviation of all usable trials
 * so far from the backend model (preliminary; step 4 gives the final one).
 */
export default function CameraTrialAnalysis({ trial, preview, usableCount }) {
  if (!trial) return null;
  const f = trial.features;

  return (
    <section aria-labelledby="trial-analysis" className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm space-y-4"
      data-testid="camera-trial-analysis">
      <div className="flex flex-wrap items-center gap-2">
        <Activity className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        <h2 id="trial-analysis" className="font-heading text-lg font-semibold text-slate-900 mr-auto">
          Trial {trial.index} analysis
        </h2>
        <span className="font-mono text-xs text-slate-500">
          {trial.durationSec}s · {trial.framesCaptured} frames · {10 - trial.missingFeatures}/10 measured
          {trial.accepted ? "" : " · not usable"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th scope="col" className="py-2 pr-3 font-medium">Measurement</th>
              <th scope="col" className="py-2 pr-3 font-medium text-right">This trial</th>
              <th scope="col" className="py-2 pr-3 font-medium text-right">Reference (mean ± SD)</th>
              <th scope="col" className="py-2 font-medium">Compared with reference</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(GAIT_REF).map((k) => {
              const v = f[k];
              const rej = (trial.rejectedFeatures || []).find((r) => r.key === k);
              const z = gaitZ(k, v);
              const [m, sd] = GAIT_REF[k];
              const unit = GAIT_UNIT[k];
              const status = rej ? `Implausible (${rej.value}; walking range ${rej.range[0]}–${rej.range[1]}): not used`
                : z == null ? "Not measured" : Math.abs(z) < 1 ? "Typical" : `${z > 0 ? "Above" : "Below"} typical (z ${z > 0 ? "+" : ""}${z})`;
              const cls = rej ? "text-red-700" : z == null ? "text-slate-400" : Math.abs(z) >= 2 ? "text-red-700 font-semibold" : Math.abs(z) >= 1 ? "text-amber-700" : "text-emerald-700";
              return (
                <tr key={k} className="border-b border-slate-100">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal text-slate-700">{GAIT_LABEL[k]}</th>
                  <td className="py-1.5 pr-3 text-right font-mono text-slate-900">{v == null ? "—" : `${+v.toFixed(unit === " s" ? 2 : 1)}${unit}`}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-slate-500">{m} ± {sd}{unit}</td>
                  <td className={`py-1.5 ${cls}`}>{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div aria-live="polite">
        {preview.status === "loading" && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-hidden="true" />
            Scoring {usableCount} usable trial(s) with the gait model…
          </p>
        )}
        {preview.status === "offline" && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <WifiOff className="h-4 w-4" aria-hidden="true" /> No connection to the server: the gait score will be calculated in step 4.
          </p>
        )}
        {preview.status === "error" && (
          <p className="flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Couldn't score the trials: {preview.error}
          </p>
        )}
        {preview.status === "ok" && preview.result && (() => {
          const r = preview.result;
          const score = typeof r.deviation_score === "number" ? r.deviation_score : null;
          const band = score == null ? null : r.risk_level;
          return (
            <div className={`flex flex-wrap items-center gap-4 rounded-xl border p-4 ${BAND[band] || "border-slate-200 bg-slate-50 text-slate-800"}`}
              data-testid="camera-preview-score">
              <div className="mr-auto">
                <p className="text-xs font-medium opacity-80">
                  Gait deviation so far · {usableCount} usable trial(s){r.is_demo ? " · DEMO" : ""}
                </p>
                <p className="font-heading text-2xl font-bold">{band || "Not determined"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-80">Score (0–100)</p>
                <p className="font-mono text-3xl font-bold">{score == null ? "—" : score.toFixed(1)}</p>
              </div>
              <p className="basis-full text-xs opacity-80">
                Preliminary. Share of the 3,003 reference trials that look more typical than this gait; not an OA probability.
                The final result uses all trials and the IMU in step 4.
              </p>
            </div>
          );
        })()}
      </div>
    </section>
  );
}
