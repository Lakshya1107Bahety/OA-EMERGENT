// Uploads a queued assessment once the connection is back:
// patient (if not yet on the server) -> screening -> sign-off.
import { realApi } from "./api/realApi";
import { loadDraft, saveDraft } from "./draftStore";

export async function syncAssessment({ draftId }) {
  const draft = await loadDraft(draftId);
  if (!draft) return; // deleted locally: nothing left to send
  // Each stage is saved as soon as it succeeds, so a retry never repeats it
  // (no duplicate patients or screenings).
  if (!draft.patient.serverId) {
    draft.patient = { ...draft.patient, serverId: await realApi.createPatient(draft.patient), sync: "synced" };
    await saveDraft(draft);
  }
  if (!draft.report.screeningId) {
    const saved = await realApi.saveScreening(draft, draft.report);
    draft.report = { ...draft.report, screeningId: saved.id };
    draft.multimodal = { ...draft.multimodal, raw: saved.result, status: "done" };
    await saveDraft(draft);
  }
  if (draft.report.signOff && !draft.report.signOffSynced) {
    await realApi.signOff(draft.report.screeningId, draft.report);
    draft.report = { ...draft.report, signOffSynced: true };
  }
  draft.report = { ...draft.report, sync: "synced" };
  await saveDraft(draft);
}
