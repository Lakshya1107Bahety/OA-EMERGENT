import React from "react";

const STYLE = {
  Low: "bg-emerald-50 text-emerald-700",
  Moderate: "bg-amber-50 text-amber-700",
  High: "bg-orange-50 text-orange-700",
  Severe: "bg-red-50 text-red-600",
};

export default function RiskBadge({ level, testid }) {
  if (!level) return <span className="text-xs text-muted-foreground">Not screened</span>;
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${STYLE[level] || "bg-slate-100 text-slate-600"}`}
    >
      {level}
    </span>
  );
}

export const RISK_COLOR = {
  Low: "#10B981",
  Moderate: "#F59E0B",
  High: "#F97316",
  Severe: "#EF4444",
};
