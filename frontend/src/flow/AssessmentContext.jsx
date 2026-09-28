// Single store for one patient assessment. Every step reads from and writes to
// this draft, and every change is autosaved to IndexedDB.
import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef } from "react";
import { loadDraft, saveDraft } from "./draftStore";
import { DEPENDENTS } from "./flowSteps";

/** @typedef {import("./types").AssessmentDraft} AssessmentDraft */
/** @typedef {import("./types").StepId} StepId */

const Ctx = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case "loaded":
      return { status: action.draft ? "ready" : "missing", draft: action.draft };
    case "update": {
      const { stepId, patch, complete, invalidate } = action;
      const d = state.draft;
      const next = { ...d, ...patch, updatedAt: new Date().toISOString() };
      const stale = { ...d.stale };
      if (invalidate) for (const dep of DEPENDENTS[stepId]) if (d.completed[dep]) stale[dep] = true;
      const completed = { ...d.completed };
      if (complete) {
        completed[stepId] = true;
        delete stale[stepId];
      }
      next.stale = stale;
      next.completed = completed;
      return { ...state, draft: next };
    }
    default:
      return state;
  }
}

export function AssessmentProvider({ draftId, children }) {
  const [state, dispatch] = useReducer(reducer, { status: "loading", draft: null });
  const loadedId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadDraft(draftId).then((draft) => {
      if (!cancelled) {
        loadedId.current = draftId;
        dispatch({ type: "loaded", draft });
      }
    });
    return () => { cancelled = true; };
  }, [draftId]);

  // Autosave (skips the initial load itself).
  useEffect(() => {
    if (state.draft && loadedId.current === state.draft.draftId) saveDraft(state.draft);
  }, [state.draft]);

  /**
   * Update the draft.
   * @param {StepId} stepId  step that owns the data
   * @param {Partial<AssessmentDraft>} patch
   * @param {{complete?: boolean, invalidate?: boolean}} [opts]
   *   complete: mark the step done; invalidate: downstream results must be redone
   */
  const update = useCallback((stepId, patch, opts = {}) => {
    dispatch({ type: "update", stepId, patch, complete: !!opts.complete, invalidate: opts.invalidate !== false });
  }, []);

  return <Ctx.Provider value={{ ...state, update }}>{children}</Ctx.Provider>;
}

/** @returns {{status: string, draft: AssessmentDraft, update: Function}} */
export function useAssessment() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAssessment must be used inside AssessmentProvider");
  return v;
}
