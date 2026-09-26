import React from "react";
import { Clock, CheckCircle2, AlertTriangle, ArrowRightLeft, Layers, ShieldCheck } from "lucide-react";

export default function SyncTimeline({ matchedPairs = [], summary = {} }) {
  const quality = summary.overall_quality || "Waiting for Streams";
  const avgError = summary.avg_error_ms ?? 0;
  const totalSamples = summary.total_samples ?? matchedPairs.length;

  const getQualityBadge = (q) => {
    switch (q) {
      case "Excellent":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300";
      case "Good":
        return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300";
      default:
        return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300";
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
      {/* Header and Quality Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-slate-900 dark:text-white text-base">
              Temporal Synchronization Engine
            </h3>
            <p className="text-xs text-slate-500">
              Aligning Camera Frames (MediaPipe) + IMU Vectors (ESP32 MPU6050)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-500 block">Avg Sync Latency Error</span>
            <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
              {avgError ? `Δt = ${avgError} ms` : "0 ms"}
            </span>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-bold border tracking-wide uppercase ${getQualityBadge(quality)}`}>
            {quality}
          </span>
        </div>
      </div>

      {/* Synchronization Quality Card Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-center">
          <span className="text-xs text-slate-500">Excellent (≤ 20ms)</span>
          <p className="font-mono text-base font-bold text-emerald-600 mt-0.5">
            {summary.excellent_pct != null ? `${summary.excellent_pct}%` : "0%"}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-center">
          <span className="text-xs text-slate-500">Good (20 - 50ms)</span>
          <p className="font-mono text-base font-bold text-blue-600 mt-0.5">
            {summary.good_pct != null ? `${summary.good_pct}%` : "0%"}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-center">
          <span className="text-xs text-slate-500">Warning (&gt; 50ms)</span>
          <p className="font-mono text-base font-bold text-amber-600 mt-0.5">
            {summary.warning_pct != null ? `${summary.warning_pct}%` : "0%"}
          </p>
        </div>
      </div>

      {/* Synchronized Timeline Stream Table */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
          Matched Samples Buffer ({totalSamples} samples synchronized)
        </span>

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto font-mono text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 sticky top-0">
              <tr>
                <th className="py-2 px-3">Camera Timestamp</th>
                <th className="py-2 px-3">IMU Timestamp</th>
                <th className="py-2 px-3">Difference (Δt)</th>
                <th className="py-2 px-3">Sync Quality</th>
                <th className="py-2 px-3">Matched Sample Vector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {matchedPairs.length > 0 ? (
                matchedPairs.slice(-10).reverse().map((pair) => (
                  <tr key={pair.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-3 text-emerald-600 font-semibold">{pair.camera_time} ms</td>
                    <td className="py-2 px-3 text-blue-600 font-semibold">{pair.imu_time} ms</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        pair.diff_ms <= 20 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        pair.diff_ms <= 50 ? "bg-blue-50 text-blue-700 border border-blue-200" :
                        "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {pair.diff_ms} ms
                      </span>
                    </td>
                    <td className="py-2 px-3 font-sans font-semibold">
                      {pair.quality === "Excellent" ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Excellent
                        </span>
                      ) : pair.quality === "Good" ? (
                        <span className="text-blue-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Good
                        </span>
                      ) : (
                        <span className="text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Warning
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-500 truncate max-w-xs text-[11px]">
                      [AX:{pair.imu.ax?.toFixed(2)} AY:{pair.imu.ay?.toFixed(2)} | Knee:{pair.frame?.right_knee_angle ?? "—"}°]
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 font-sans">
                    Start webcam and connect OA_IMU simultaneously to observe real-time temporal synchronization.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
