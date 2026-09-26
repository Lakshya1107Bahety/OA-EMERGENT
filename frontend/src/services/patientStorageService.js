/**
 * OA Sentinel - Local Patient & Assessment Storage Service
 * Provides offline-first persistence for clinical evaluations, sessions, and patient profiles.
 */

const STORAGE_KEYS = {
  PATIENTS: "oa_sentinel_patients",
  ASSESSMENTS: "oa_sentinel_assessments",
  ACTIVE_PATIENT: "oa_sentinel_active_patient_id",
  SETTINGS: "oa_sentinel_settings",
};

// Seed cohort inspired by the real 51-participant study for offline review
const SEED_PATIENTS = [
  {
    id: "OA-SUBJ-001",
    age: 38,
    sex: "Male",
    height_cm: 178,
    weight_kg: 82,
    bmi: 25.9,
    affected_side: "Right",
    pain_score: 4,
    pain_duration: "6-12 months",
    previous_oa: false,
    previous_injury: "Meniscus tear",
    activity_level: "Moderately Active",
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "OA-SUBJ-002",
    age: 62,
    sex: "Female",
    height_cm: 162,
    weight_kg: 74,
    bmi: 28.2,
    affected_side: "Bilateral",
    pain_score: 7,
    pain_duration: "> 3 years",
    previous_oa: true,
    previous_injury: "None",
    activity_level: "Sedentary",
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: "OA-SUBJ-003",
    age: 26,
    sex: "Male",
    height_cm: 182,
    weight_kg: 76,
    bmi: 22.9,
    affected_side: "None",
    pain_score: 0,
    pain_duration: "None",
    previous_oa: false,
    previous_injury: "None",
    activity_level: "High",
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
];

class PatientStorageService {
  constructor() {
    this.init();
  }

  init() {
    if (typeof window === "undefined") return;
    const existing = localStorage.getItem(STORAGE_KEYS.PATIENTS);
    if (!existing) {
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(SEED_PATIENTS));
    }
  }

  getPatients() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PATIENTS);
      return raw ? JSON.parse(raw) : SEED_PATIENTS;
    } catch {
      return SEED_PATIENTS;
    }
  }

  getPatient(id) {
    const list = this.getPatients();
    return list.find((p) => p.id === id) || null;
  }

  savePatient(patient) {
    const list = this.getPatients();
    const existingIdx = list.findIndex((p) => p.id === patient.id);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...patient };
    } else {
      list.unshift({
        ...patient,
        created_at: patient.created_at || new Date().toISOString(),
      });
    }
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(list));
    this.setActivePatientId(patient.id);
    return patient;
  }

  getActivePatientId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PATIENT) || (this.getPatients()[0]?.id ?? "");
  }

  setActivePatientId(id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PATIENT, id);
  }

  getAssessments() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  getAssessment(id) {
    const list = this.getAssessments();
    return list.find((a) => a.id === id) || null;
  }

  saveAssessment(assessment) {
    const list = this.getAssessments();
    const entry = {
      id: assessment.id || `eval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...assessment,
    };
    list.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(list.slice(0, 100)));
    return entry;
  }
}

export const patientStorageService = new PatientStorageService();
export default patientStorageService;
