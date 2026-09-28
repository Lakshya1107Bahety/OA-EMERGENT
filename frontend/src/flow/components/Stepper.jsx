import React from "react";
import { Check, AlertCircle } from "lucide-react";
import { STEPS, canOpen, isDone } from "../flowSteps";

/**
 * Persistent progress stepper: Details -> Camera -> IMU -> Multimodal -> Results.
 * Completed steps can be revisited; steps ahead of the first incomplete one are locked.
 */
export default function Stepper({ draft, current, onGo }) {
  return (
    <nav aria-label="Assessment progress">
      <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto jc-scrollbar pb-1" data-testid="flow-stepper">
        {STEPS.map((s, i) => {
          const done = isDone(draft, s.id);
          const stale = !!draft.stale?.[s.id];
          const active = s.id === current;
          const open = canOpen(draft, s.id);
          const tone = active
            ? "bg-primary text-white border-primary"
            : done
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : stale
                ? "bg-amber-50 text-amber-800 border-amber-300"
                : "bg-white text-slate-500 border-slate-200";
          return (
            <li key={s.id} className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onGo(s.id)}
                disabled={!open || active}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${i + 1} of ${STEPS.length}: ${s.title}${done ? ", completed" : stale ? ", needs to be redone" : !open ? ", locked" : ""}`}
                data-testid={`stepper-${s.id}`}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors min-h-[40px]
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                  disabled:cursor-default ${!open && !active ? "opacity-60" : ""} ${tone}`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
                  ${active ? "bg-white/20" : done ? "bg-emerald-600 text-white" : stale ? "bg-amber-500 text-white" : "bg-slate-100"}`}>
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : stale ? <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span className={active ? "" : "hidden sm:inline"}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span aria-hidden="true" className="h-px w-3 sm:w-6 bg-slate-300" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
