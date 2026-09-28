import React from "react";
import { CheckCircle2, XCircle, Trash2, Footprints } from "lucide-react";

/** Trial counter + per-trial thumbnails. */
export default function TrialStrip({ trials, required, onRemove, label = "Trial" }) {
  const usable = trials.filter((t) => t.accepted !== false).length;
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800" aria-live="polite" data-testid="trial-counter">
        {usable} of {required} usable {label.toLowerCase()}s recorded
      </p>
      <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {trials.map((t) => (
          <li key={`${t.index}-${t.startedAt}`} className={`relative overflow-hidden rounded-xl border bg-white shadow-sm
            ${t.accepted === false ? "border-red-200" : "border-emerald-900/10"}`} data-testid={`trial-${t.index}`}>
            <div className="aspect-video bg-slate-100 flex items-center justify-center">
              {t.thumbnail
                ? <img src={t.thumbnail} alt={`${label} ${t.index} snapshot`} className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
                : <Footprints className="h-6 w-6 text-slate-400" aria-hidden="true" />}
            </div>
            <div className="p-2 text-xs">
              <p className="flex items-center gap-1 font-semibold text-slate-800">
                {t.accepted === false
                  ? <XCircle className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                  : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />}
                {label} {t.index}{t.isDemo ? " · demo" : ""}
              </p>
              <p className="text-slate-500">{t.detail}</p>
            </div>
            {onRemove && (
              <button type="button" onClick={() => onRemove(t)}
                className="absolute top-1.5 right-1.5 rounded-lg bg-white/90 p-1.5 text-slate-600 shadow hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`Remove ${label.toLowerCase()} ${t.index}`}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
        {Array.from({ length: Math.max(0, required - usable) }, (_, i) => (
          <li key={`empty-${i}`} aria-hidden="true"
            className="aspect-video rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">
            Pending
          </li>
        ))}
      </ul>
    </div>
  );
}
