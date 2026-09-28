// In-browser stand-in for the backend so the whole flow runs without a server
// or hardware (REACT_APP_MOCK_API=true). Every result is marked DEMO. The gait
// score here is a simple z-score stand-in, NOT the calibrated model.
import { cameraResults, imuTrials } from "./payloads";

// Reference cohort mean / SD per gait measurement (from oa_healthy_reference.json).
const REF = {
  right_knee_rom_deg: [67.74, 22.44], left_knee_rom_deg: [62.34, 18.85],
  right_hip_rom_deg: [70.6, 22.11], left_hip_rom_deg: [77.26, 26.49],
  step_duration_sec: [0.5, 0.12], stride_duration_sec: [1.0, 0.24],
  cadence_steps_min: [126.57, 30.19], knee_rom_asymmetry_pct: [21.05, 22.82],
  step_time_asymmetry_pct: [21.83, 19.65], trunk_lean_deg: [4.86, 4.05],
};
const LABEL = {
  right_knee_rom_deg: "Right knee range of motion", left_knee_rom_deg: "Left knee range of motion",
  right_hip_rom_deg: "Right hip range of motion", left_hip_rom_deg: "Left hip range of motion",
  step_duration_sec: "Step duration", stride_duration_sec: "Stride duration", cadence_steps_min: "Cadence",
  knee_rom_asymmetry_pct: "Knee ROM asymmetry", step_time_asymmetry_pct: "Step time asymmetry",
  trunk_lean_deg: "Trunk lean",
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const store = { patients: 0, screenings: [] };

function mockResult(draft) {
  const trials = cameraResults(draft);
  const deviations = Object.keys(REF).map((k) => {
    const vals = trials.map((t) => t[k]).filter((v) => v != null);
    if (!vals.length) return null;
    const value = vals.reduce((a, b) => a + b, 0) / vals.length;
    const [m, sd] = REF[k];
    const z = (value - m) / sd;
    return { feature: LABEL[k], key: k, patient_value: +value.toFixed(2), reference_mean: m, z_score: +z.toFixed(2), direction: z > 0 ? "above" : "below" };
  }).filter(Boolean).sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));

  const meanAbsZ = deviations.length ? deviations.reduce((a, d) => a + Math.abs(d.z_score), 0) / deviations.length : null;
  const deviation = meanAbsZ == null ? null : +Math.min(99.9, 20 + meanAbsZ * 45).toFixed(1);
  const tier = deviation == null ? null : deviation > 97.5 ? "High" : deviation > 90 ? "Moderate" : "Low";
  const imuSamples = imuTrials(draft).reduce((n, t) => n + t.length, 0);
  const p = draft.patient;

  const clinical = [];
  if (p.age >= 50) clinical.push({ factor: "Age 50 or over", value: `${p.age} years` });
  if (p.bmi >= 30) clinical.push({ factor: "Obesity (BMI 30 or over)", value: `BMI ${p.bmi}` });
  else if (p.bmi >= 25) clinical.push({ factor: "Overweight (BMI 25-30)", value: `BMI ${p.bmi}` });
  if (p.priorInjuryOrSurgery) clinical.push({ factor: "Previous knee injury", value: p.priorInjuryOrSurgery });
  if (p.painScore >= 4) clinical.push({ factor: "Knee pain (VAS 4 or more)", value: `${p.painScore}/10` });
  if (p.sex === "female") clinical.push({ factor: "Female sex (higher knee OA prevalence)", value: "Female" });
  if (p.familyHistoryOA) clinical.push({ factor: "Family history of OA", value: "Yes" });

  return {
    engine_version: "demo",
    is_demo: true,
    score_type: deviation != null ? "gait_deviation_percentile" : null,
    deviation_score: deviation,
    imu_score: null,
    risk_level: tier || "Not determined",
    calibrated: false,
    risk_basis: "DEMO result from the in-browser mock, not the calibrated model.",
    gait: {
      available: deviation != null, trials_analyzed: trials.length, trials_flagged_atypical: 0,
      features_imputed: trials.length * 10 - trials.reduce((n, t) => n + Object.keys(t).length - 1, 0),
      feature_deviations: deviations,
      reference: { participants: 49, trials: 3003, moderate_above_percentile: 90, high_above_percentile: 97.5 },
    },
    feature_deviations: deviations,
    movement_symmetry: null,
    imu: { calibrated: false, sample_count: imuSamples, irregularity_index: null, irregularity_tier: null,
      irregularity_reason: "Not computed in demo mode.", features: null, units_detected: "m/s^2" },
    clinical_risk_factors: clinical,
    data_coverage: { camera_trials: trials.length, imu_samples: imuSamples },
    disclaimer: "DEMO data. Not a diagnosis.",
  };
}

export const mockApi = {
  mode: "mock",
  async createPatient() {
    await wait(300);
    store.patients += 1;
    return `demo-patient-${store.patients}`;
  },
  async updatePatient(serverId) {
    await wait(200);
    return serverId;
  },
  async analyze(draft) {
    await wait(1200);
    return mockResult(draft);
  },
  async saveScreening(draft) {
    await wait(500);
    const doc = { id: `demo-screening-${store.screenings.length + 1}`, result: mockResult(draft), created_at: new Date().toISOString() };
    store.screenings.push(doc);
    return doc;
  },
  async signOff(screeningId) {
    await wait(300);
    return { id: screeningId, review_status: "reviewed" };
  },
};
