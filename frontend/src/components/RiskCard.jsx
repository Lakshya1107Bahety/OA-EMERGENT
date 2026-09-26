import React from "react";
import { ShieldAlert, Activity, CheckCircle2, TrendingUp, AlertTriangle } from "lucide-react";

export default function RiskCard({ result }) {
  if (!result) return null;

  const score = result.screening_score ?? 62;
  const category = result.risk_category || "MODERATE PROTOTYPE RISK";
  const subScores = result.sub_scores || {
    gait_abnormality: 54,
    knee_movement: 68,
    movement_symmetry: 62,
    pain_indicators: 45,
    imu_movement_pattern: 58,
    functional_mobility: 64,
  };

  const getCategoryTheme = (cat) => {
    if (cat.includes("LOW")) {
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100",
        badge: "bg-emerald-600 text-white",
        ring: "#10b981",
        label: "Low Relative Risk",
      };
    }
    if (cat.includes("HIGH")) {
      return {
        bg: "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100",
        badge: "bg-rose-600 text-white",
        ring: "#ef4444",
        label: "High Relative Risk",
      };
    }
    return {
      bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100",
      badge: "bg-amber-600 text-white",
      ring: "#f59e0b",
      label: "Moderate Relative Risk",
    };
  };

  const theme = getCategoryTheme(category);

  return (
    <div className={`rounded-3xl border ${theme.bg} p-6 shadow-sm space-y-6 transition-all`}>
      {/* Top Banner & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
            OA Sentinel Screening Profile
          </span>
          <h2 className="font-heading text-2xl font-bold mt-0.5">
            Biomechanical Assessment Report
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm ${theme.badge}`}>
            {category}
          </span>
        </div>
      </div>

      {/* Main Score Centerpiece */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Score Dial */}
        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-sm text-center">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
            Overall Prototype Score
          </span>
          <div className="my-2 flex items-baseline justify-center">
            <span className="font-heading text-6xl font-black text-slate-900 dark:text-white">
              {score}
            </span>
            <span className="font-mono text-xl text-slate-400 font-semibold ml-1">
              / 100
            </span>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mt-1">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${score}%`,
                backgroundColor: theme.ring,
              }}
            />
          </div>

          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            Normative bands: p90 ({result.threshold_p90 || 88.08}) • p97.5 ({result.threshold_p97_5 || 96.37})
          </p>
        </div>

        {/* Clinical Domain Sub-scores */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm space-y-3.5">
          <h4 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
            Sub-Domain Screening Metrics
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
            {/* Gait Abnormality */}
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-300">Gait Abnormality</span>
                <span className="font-mono font-bold">{subScores.gait_abnormality} %</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${subScores.gait_abnormality}%` }} />
              </div>
            </div>

            {/* Knee Movement */}
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-300">Knee Movement / ROM Loss</span>
                <span className="font-mono font-bold">{subScores.knee_movement} %</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${subScores.knee_movement}%` }} />
              </div>
            </div>

            {/* Movement Symmetry */}
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-300">Movement Asymmetry</span>
                <span className="font-mono font-bold">{subScores.movement_symmetry} %</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full" style={{ width: `${subScores.movement_symmetry}%` }} />
              </div>
            </div>

            {/* Pain Indicators */}
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-300">Pain Indicators (VAS)</span>
                <span className="font-mono font-bold">{subScores.pain_indicators} %</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full rounded-full" style={{ width: `${subScores.pain_indicators}%` }} />
              </div>
            </div>

            {/* IMU Kinematic Pattern */}
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-300">IMU Kinematic Pattern</span>
                <span className="font-mono font-bold">{subScores.imu_movement_pattern} %</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${subScores.imu_movement_pattern}%` }} />
              </div>
            </div>

            {/* Functional Mobility */}
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-300">Functional Mobility Deficit</span>
                <span className="font-mono font-bold">{subScores.functional_mobility} %</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-teal-500 h-full rounded-full" style={{ width: `${subScores.functional_mobility}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Disclaimer Box */}
      <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-black/5 dark:border-white/10 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong>Important Clinical Notice:</strong> This score is an AI prototype screening indicator and is not a clinical diagnosis. It reflects statistical divergence from a 51-participant normative baseline cohort and must be confirmed by an orthopedic specialist.
        </div>
      </div>
    </div>
  );
}
