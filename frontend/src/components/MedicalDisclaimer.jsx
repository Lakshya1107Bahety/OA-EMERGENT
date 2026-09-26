import React from "react";
import { AlertCircle, ShieldAlert } from "lucide-react";

export default function MedicalDisclaimer({ compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
        <span>
          <strong>Research Prototype:</strong> AI-assisted screening assessment only — does not replace clinical diagnosis.
        </span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-amber-50/50 to-orange-50/90 p-4 shadow-sm text-slate-800">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-500/10 p-2 text-amber-700">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="space-y-1 text-xs sm:text-sm">
          <p className="font-semibold text-amber-950 flex items-center gap-2">
            Clinical Safety & Prototype Disclaimer
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-bold tracking-wide uppercase">
              Screening Prototype
            </span>
          </p>
          <p className="text-amber-900/90 leading-relaxed">
            <strong>OA Sentinel provides an AI-assisted screening/risk assessment and does not replace clinical diagnosis.</strong>{" "}
            OA Sentinel is a research and prototype screening system. It does not diagnose osteoarthritis, replace a physician, or provide medical treatment recommendations.
          </p>
        </div>
      </div>
    </div>
  );
}
