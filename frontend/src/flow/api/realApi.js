import { api, formatApiError } from "@/lib/api";
import { toPatientPayload, screeningPayload } from "./payloads";

/** True when the request never reached the server (offline / unreachable). */
export const isNetworkError = (err) => !!err && !err.response;

export const errorText = (err) =>
  isNetworkError(err) ? "No connection to the server." : formatApiError(err?.response?.data?.detail);

export const realApi = {
  mode: "real",

  async createPatient(patient) {
    const { data } = await api.post("/patients", toPatientPayload(patient));
    return data.id;
  },

  async updatePatient(serverId, patient) {
    await api.put(`/patients/${serverId}`, toPatientPayload(patient));
    return serverId;
  },

  async analyze(draft) {
    const { data } = await api.post("/assessments/analyze", screeningPayload(draft), { timeout: 60000 });
    return data.result;
  },

  async saveScreening(draft, report) {
    const { data } = await api.post("/screenings", screeningPayload(draft, {
      clinician_notes: report.clinicianNotes || null,
      recommended_action: report.recommendedAction,
    }), { timeout: 60000 });
    return data;
  },

  async signOff(screeningId, report) {
    const { data } = await api.post(`/screenings/${screeningId}/review`, {
      notes: report.clinicianNotes || "Reviewed.",
      confirmed_risk_level: report.band,
      status: "reviewed",
    });
    return data;
  },
};
