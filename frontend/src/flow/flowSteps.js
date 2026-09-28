// Step order and completion rules for the Screening Flow. The order is fixed.

/** @typedef {import("./types").StepId} StepId */
/** @typedef {import("./types").AssessmentDraft} AssessmentDraft */

export const STEPS = [
  { id: "details", label: "Details", title: "Patient Details" },
  { id: "camera", label: "Camera", title: "Live Camera Analysis" },
  { id: "imu", label: "IMU", title: "IMU Capture" },
  { id: "multimodal", label: "Multimodal", title: "Multimodal Analysis" },
  { id: "results", label: "Results", title: "OA Risk Results" },
];

export const STEP_IDS = STEPS.map((s) => s.id);
export const DEFAULT_TRIALS = 5;

export const stepIndex = (id) => STEP_IDS.indexOf(id);
export const stepPath = (draftId, id) => `/app/assess/${draftId}/${id}`;

/** A step is done when it was completed and nothing upstream changed since. */
export function isDone(draft, id) {
  return !!draft?.completed?.[id] && !draft?.stale?.[id];
}

/** First step that is not done; the furthest the user may go. */
export function firstOpenStep(draft) {
  return STEP_IDS.find((id) => !isDone(draft, id)) || "results";
}

/** A step can be opened only if every step before it is done. */
export function canOpen(draft, id) {
  return STEP_IDS.slice(0, stepIndex(id)).every((prev) => isDone(draft, prev));
}

/** Steps whose results depend on a step's data become stale when it changes. */
export const DEPENDENTS = {
  details: ["multimodal", "results"],
  camera: ["multimodal", "results"], // IMU trials stay; only their pairing is recomputed
  imu: ["multimodal", "results"],
  multimodal: ["results"],
  results: [],
};
