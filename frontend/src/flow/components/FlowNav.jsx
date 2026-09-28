import React from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Back / Next bar, fixed to the bottom of the screen on phones. */
export default function FlowNav({ onBack, onNext, nextLabel = "Next", nextDisabled = false, busy = false, hint }) {
  if (!onBack && !onNext) return null;
  return (
    <div className="sticky bottom-0 z-10 -mx-4 lg:mx-0 mt-6 border-t border-emerald-900/10 bg-white/95 backdrop-blur px-4 py-3 lg:rounded-2xl lg:border lg:shadow-sm">
      <div className="flex items-center gap-3">
        {onBack ? (
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onBack} data-testid="flow-back">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Back
          </Button>
        ) : <span />}
        {hint && <p className="flex-1 text-xs text-slate-500 text-right" aria-live="polite">{hint}</p>}
        {!hint && <span className="flex-1" />}
        {onNext && (
          <Button type="button" className="h-11 rounded-xl px-6" onClick={onNext} disabled={nextDisabled || busy} data-testid="flow-next">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {nextLabel}
            {!busy && <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />}
          </Button>
        )}
      </div>
    </div>
  );
}
