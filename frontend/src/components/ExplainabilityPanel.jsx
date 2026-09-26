import React from "react";
import { HelpCircle, ArrowUpRight, ArrowDownRight, Info, ShieldAlert } from "lucide-react";

export default function ExplainabilityPanel({ contributions = [] }) {
  const displayContributions = contributions.length > 0 ? contributions : [
    { feature: "Gait ROM asymmetry", patient_value: 28.4, reference_mean: 18.2, impact: 14.2, direction: "↑", label: "↑ contribution", unit: "%" },
    { feature: "Knee flexion ROM", patient_value: 46.5, reference_mean: 55.4, impact: 11.5, direction: "↑", label: "↑ contribution", unit: "°" },
    { feature: "Angular velocity variation", patient_value: 36.8, reference_mean: 24.5, impact: 8.3, direction: "↑", label: "↑ contribution", unit: "(°/s)²" },
    { feature: "Self-Reported Pain (VAS)", patient_value: 5.0, reference_mean: 0.0, impact: 13.5, direction: "↑", label: "↑ contribution", unit: "/10" },
    { feature: "Acceleration smoothness", patient_value: 86.2, reference_mean: 85.0, impact: -4.1, direction: "↓", label: "↓ contribution", unit: "%" },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-slate-900 dark:text-white text-base">
              Why did the model produce this result?
            </h3>
            <p className="text-xs text-slate-500">
              SHAP-Style Feature Contribution Analysis (Relative to 51-Subject Healthy Cohort)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-medium">
            Labelled: Model feature contribution
          </span>
        </div>
      </div>

      {/* Feature Contributions List */}
      <div className="space-y-3">
        {displayContributions.map((item, idx) => {
          const isIncrease = item.direction === "↑" || item.impact > 0;
          const absImpact = Math.min(100, Math.abs(item.impact) * 4);

          return (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {item.feature}
                  </span>
                  <span className="font-mono text-slate-500 text-[11px]">
                    (Measured: {item.patient_value}{item.unit || ""} vs Healthy Mean: {item.reference_mean}{item.unit || ""})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-md ${
                      isIncrease
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}
                  >
                    {isIncrease ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {isIncrease ? "↑ contribution" : "↓ contribution"}
                  </span>
                </div>
              </div>

              {/* Impact Bar */}
              <div className="flex items-center gap-3">
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isIncrease ? "bg-rose-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.max(12, absImpact)}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] font-bold text-slate-500 w-12 text-right">
                  {isIncrease ? `+${item.impact}` : `${item.impact}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Disclaimers & Model Explainability Notice */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/40 text-xs text-slate-500 space-y-1">
        <p className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
          <Info className="w-3.5 h-3.5 text-indigo-500" />
          Model feature contribution note:
        </p>
        <p className="text-[11px] leading-relaxed">
          Feature contribution represents the statistical divergence of the subject's kinematics from the normative 51-participant distribution. 
          Arrows denote whether a deviation increases (↑) or moderates (↓) the prototype risk indicator. This reflects statistical model weights and <strong>not clinical causality</strong>.
        </p>
      </div>
    </div>
  );
}
