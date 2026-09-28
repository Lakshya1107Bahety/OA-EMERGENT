import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { createDraft, saveDraft } from "./draftStore";
import { stepPath } from "./flowSteps";

/** Creates an empty draft, then opens its first step. */
export default function NewAssessment() {
  const [draftId, setDraftId] = useState(null);
  useEffect(() => {
    const d = createDraft();
    saveDraft(d).then(() => setDraftId(d.draftId));
  }, []);
  if (draftId) return <Navigate to={stepPath(draftId, "details")} replace />;
  return (
    <div className="flex h-64 items-center justify-center gap-2 text-slate-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Starting a new assessment…
    </div>
  );
}
