// Run: cd frontend && npx craco test --watchAll=false
import { imuTrialMetrics } from "../imuMetrics";
import { canOpen, firstOpenStep, isDone } from "../flowSteps";
import { buildMultimodal, suggestAction, topDrivers, buildReport } from "../buildResults";
import { validate, computeBmi } from "../patientValidation";

// Knee-worn IMU walking signal (same model as imuSimulator.js), deterministic.
function walk({ stride = 1.1, varPct = 0.04, n = 500, gyroAmp = 160, seed = 1 } = {}) {
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  const out = [];
  let phase = 0, period = stride;
  for (let i = 0; i < n; i++) {
    const prev = phase;
    phase += (2 * Math.PI * 0.02) / period;
    if (Math.floor(prev / (2 * Math.PI)) !== Math.floor(phase / (2 * Math.PI))) period = stride * (1 + rnd() * varPct);
    out.push({ t: i * 20, ax: 0.3 * rnd(), ay: 0.3 * rnd(), az: 9.81 + 2.5 * Math.sin(2 * phase) + 1.2 * Math.sin(phase) + 0.3 * rnd(),
      gx: gyroAmp * Math.sin(phase) + 5 * rnd(), gy: 3 * rnd(), gz: 3 * rnd() });
  }
  return out;
}

describe("IMU metrics", () => {
  test("cadence is correct even for short (4 s) trials", () => {
    for (let s = 1; s <= 40; s++) {
      expect(imuTrialMetrics(walk({ n: 210, seed: s * 7919 })).cadenceSpm).toBeCloseTo(109, -1);
    }
  });
  test("faster walking gives higher cadence", () => {
    expect(imuTrialMetrics(walk({ stride: 0.9, varPct: 0 })).cadenceSpm).toBeCloseTo(133.3, 0);
  });
  test("irregular strides raise variability and hide unreliable symmetry", () => {
    const reg = imuTrialMetrics(walk({ varPct: 0 }));
    const irr = imuTrialMetrics(walk({ varPct: 0.25, seed: 7 }));
    expect(irr.strideTimeCvPct).toBeGreaterThan(reg.strideTimeCvPct + 5);
    expect(irr.stepSymmetryPct).toBeNull();
  });
  test("standing still is not scored", () => {
    const m = imuTrialMetrics(walk({ gyroAmp: 0 }));
    expect(m.moving).toBe(false);
    expect(m.cadenceSpm).toBeNull();
  });
});

describe("step guards", () => {
  const d = { completed: { details: true, camera: true, imu: false, multimodal: false, results: false }, stale: {} };
  test("cannot open a step before earlier ones are done", () => {
    expect(canOpen(d, "imu")).toBe(true);
    expect(canOpen(d, "multimodal")).toBe(false);
    expect(firstOpenStep(d)).toBe("imu");
  });
  test("a stale step blocks later steps", () => {
    const st = { completed: { ...d.completed, imu: true, multimodal: true }, stale: { multimodal: true } };
    expect(isDone(st, "multimodal")).toBe(false);
    expect(canOpen(st, "results")).toBe(false);
  });
});

describe("patient validation", () => {
  const ok = { fullName: "Asha Kumari", age: "61", sex: "female", village: "Rampur", phone: "", heightCm: "155",
    weightKg: "70", familyHistoryOA: "no", symptomDurationMonths: "0", affectedSide: "left", painScore: "0" };
  test("valid form has no errors; pain 0 is allowed", () => expect(validate(ok)).toEqual({}));
  test("rejects bad values", () => {
    const e = validate({ ...ok, age: "12", phone: "123", heightCm: "20", painScore: "" });
    expect(Object.keys(e).sort()).toEqual(["age", "heightCm", "painScore", "phone"]);
  });
  test("BMI", () => expect(computeBmi("155", "70")).toBe(29.1));
});

describe("results policy", () => {
  const draft = { patient: { painScore: 3 }, cameraTrials: [{ accepted: true }],
    imu: { device: { source: "simulator" }, trials: [{ accepted: true, quality: { droppedPct: 0 }, summary: {} }] } };
  const res = { engine_version: "2.0", score_type: "gait_deviation_percentile", deviation_score: 98.4, risk_level: "High",
    gait: { available: true }, feature_deviations: [{ feature: "Cadence", patient_value: 70, reference_mean: 126.6, z_score: -1.9 }],
    imu: {}, clinical_risk_factors: [{ factor: "Age 50 or over", value: "61 years" }] };
  test("simulated IMU does not downgrade a real camera score", () => {
    const mm = buildMultimodal(res, draft);
    expect(mm.gaitCalibrated).toBe(true);
    expect(mm.demo).toEqual({ vision: false, imu: true, clinical: false });
  });
  test("High -> refer; uncalibrated IMU High -> re-screen", () => {
    const mm = buildMultimodal(res, draft);
    expect(suggestAction(mm, { painScore: 0 }).action).toBe("refer-orthopaedics");
    expect(suggestAction({ ...mm, bandSource: "imu" }, {}).action).toBe("re-screen");
  });
  test("drivers ranked with calibrated gait first; clinician choice kept", () => {
    const mm = buildMultimodal(res, draft);
    expect(topDrivers(mm)[0].label).toBe("Cadence");
    const rep = buildReport(mm, draft.patient, { recommendedAction: "radiograph", clinicianNotes: "n" });
    expect(rep.recommendedAction).toBe("radiograph");
    expect(rep.suggestedAction).toBe("refer-orthopaedics");
  });
});
