// IndexedDB persistence for Screening Flow drafts, so a reload or a dropped
// connection in the field never loses captured data.
import { openDB } from "idb";
import { DEFAULT_TRIALS } from "./flowSteps";

const DB_NAME = "oa-screening-flow";
const STORE = "drafts";

function db() {
  return openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "draftId" });
    },
  });
}

const newId = () =>
  (window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** @returns {import("./types").AssessmentDraft} */
export function createDraft() {
  const now = new Date().toISOString();
  return {
    draftId: newId(),
    createdAt: now,
    updatedAt: now,
    completed: { details: false, camera: false, imu: false, multimodal: false, results: false },
    stale: {},
    trialsRequired: DEFAULT_TRIALS,
    cameraTrials: [],
  };
}

export async function saveDraft(draft) {
  try {
    await (await db()).put(STORE, draft);
  } catch {
    // Private windows can block IndexedDB; the flow still works in memory.
  }
}

export async function loadDraft(draftId) {
  try {
    return (await (await db()).get(STORE, draftId)) || null;
  } catch {
    return null;
  }
}

export async function deleteDraft(draftId) {
  try {
    await (await db()).delete(STORE, draftId);
  } catch {}
}

/** Unfinished drafts, newest first (for "Resume" on the dashboard). */
export async function listOpenDrafts() {
  try {
    const all = await (await db()).getAll(STORE);
    return all
      .filter((d) => !d.report?.screeningId)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  } catch {
    return [];
  }
}

export { newId };
