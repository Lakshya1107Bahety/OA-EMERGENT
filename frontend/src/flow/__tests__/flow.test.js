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

describe("IMU input and diagnosis", () => {
  const { parsePacket } = require("@/lib/ble");
  const { diagnose } = require("../imuDiagnosis");
  const { gaitZ } = require("../gaitReference");

  test("firmware serial line keeps the ESP32 clock", () => {
    const r = parsePacket("1250,0.0123,-0.0214,0.9876,0.1520,-0.0830,0.4210");
    expect(r.device_ms).toBe(1250);
    expect(r.acc_z).toBeCloseTo(0.9876);
  });
  test("status lines are not readings", () => {
    expect(parsePacket("[BLE] Advertising restarted.")).toBeNull();
    expect(parsePacket("[MPU6050] Configured: ±2g, ±250 deg/s, 50 Hz, 400 kHz I2C.")).toBeNull();
  });
  const base = { connected: true, source: "ble", sinceConnectMs: 5000, sample: "" };
  test("diagnosis names the actual problem", () => {
    expect(diagnose({ ...base, stats: { received: 0, decoded: 0, unrecognised: 0, truncated: 0 } }).title).toMatch(/sending nothing/);
    expect(diagnose({ ...base, stats: { received: 9, decoded: 0, unrecognised: 9, truncated: 9 } }).title).toMatch(/cut off/);
    expect(diagnose({ ...base, stats: { received: 9, decoded: 0, unrecognised: 9, truncated: 0 } }).title).toMatch(/format/);
    expect(diagnose({ ...base, stats: { received: 9, decoded: 9, unrecognised: 0, truncated: 0 } })).toBeNull();
    expect(diagnose({ ...base, sinceConnectMs: 1000, stats: { received: 0, decoded: 0, unrecognised: 0, truncated: 0 } })).toBeNull();
  });
  test("reference z-score", () => {
    expect(gaitZ("cadence_steps_min", 126.57)).toBe(0);
    expect(gaitZ("cadence_steps_min", null)).toBeNull();
  });
});

describe("user's NUS sketch (Acc(g)/Gyro text, 2 Hz)", () => {
  const { parsePacket, isStatusLine } = require("@/lib/ble");
  const { diagnose } = require("../imuDiagnosis");
  test("full line parses; 20-byte cut does not", () => {
    const r = parsePacket("Acc(g): X=0.01 Y=-0.02 Z=1.00 | Gyro(°/s): X=1.20 Y=0.30 Z=-0.40");
    expect([r.acc_x, r.acc_z, r.gyro_x, r.gyro_z]).toEqual([0.01, 1, 1.2, -0.4]);
    expect(parsePacket("Acc(g): X=0.01 Y=0.0")).toBeNull();
  });
  test("boot messages are status lines", () => {
    expect(isStatusLine("BLE service started, waiting for connection...")).toBe(true);
    expect(isStatusLine("Acc(g): X=0.01 Y=0.0")).toBe(false);
  });
  test("2 Hz is accepted: no warning, real averages, no cadence", () => {
    expect(diagnose({ connected: true, source: "ble", sinceConnectMs: 6000, rateHz: 2,
      stats: { received: 12, decoded: 12, unrecognised: 0, truncated: 0 } })).toBeNull();
    const { imuTrialStats } = require("../imuStats");
    // 10 readings over 4.5 s, knee swinging, 1 g on Z
    const samples = Array.from({ length: 10 }, (_, i) => ({ t: i * 500, ax: 0, ay: 0, az: 9.80665, gx: i % 2 ? 60 : -60, gy: 0, gz: 0 }));
    const st = imuTrialStats(samples);
    expect(st).toMatchObject({ samples: 10, durationSec: 4.5, rateHz: 2, moving: true, gravityOk: true, gaitMeasurable: false });
    expect(st.axes.accZ.mean).toBe(1);
    expect(st.axes.gyroX).toMatchObject({ mean: 0, min: -60, max: 60 });
  });
});

describe("Bluetooth delivers readings in bursts", () => {
  const { evenlySpaced } = require("../imuStats");
  // 20 s walk sampled every 21.8 ms (delay(20)), stride 1.1 s; 2 readings arrive per 43.6 ms burst
  const samples = Array.from({ length: 914 }, (_, i) => {
    const ph = (2 * Math.PI * i * 21.8) / 1100;
    return { t: Math.floor(i / 2) * 43.6 + (i % 2) * 0.3, ax: 0.3, ay: 0.2, az: 9.81 + 2.5 * Math.sin(2 * ph),
      gx: 160 * Math.sin(ph) + 5 * Math.sin(i), gy: 3, gz: 3 };
  });
  test("cadence is found from bursty arrival times", () => {
    const m = imuTrialMetrics(samples);
    expect(m.sampleRateHz).toBeCloseTo(45.9, 0);
    expect(m.cadenceSpm).toBeCloseTo(110, -1);
  });
  test("readings are re-timed evenly for the backend", () => {
    const even = evenlySpaced(samples);
    const gaps = even.slice(1).map((x, i) => x.t - even[i].t);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.2);
    expect(even.at(-1).t).toBe(samples.at(-1).t);
  });
});

describe("plausibility and camera-IMU cadence check", () => {
  const { checkCameraFeatures, cadenceAgreement, isPlausible } = require("../plausibility");
  test("implausible camera values are rejected, not clipped", () => {
    const { clean, rejected } = checkCameraFeatures({ cadence_steps_min: 156.1, step_duration_sec: 0.39, trunk_lean_deg: 45 });
    expect(clean).toEqual({ cadence_steps_min: null, step_duration_sec: 0.39, trunk_lean_deg: null });
    expect(rejected.map((r) => [r.key, r.value])).toEqual([["cadence_steps_min", 156.1], ["trunk_lean_deg", 45]]);
    expect(isPlausible("cadence_steps_min", 130)).toBe(true);
    expect(isPlausible("cadence_steps_min", 150.1)).toBe(false);
  });
  test("agreement: compared, never copied", () => {
    expect(cadenceAgreement([112, 116], [110])).toMatchObject({ camera: 114, imu: 110, status: "agree" });
    expect(cadenceAgreement([112], [90]).status).toBe("disagree");
    expect(cadenceAgreement([112], [null])).toMatchObject({ camera: 112, imu: null, status: "single" });
    expect(cadenceAgreement([156], [110])).toMatchObject({ camera: null, imu: 110, status: "single" });
  });
  test("disagreeing sensors -> re-screen unless High", () => {
    const base = { band: "Low", bandSource: "vision", cadenceCheck: { status: "disagree", camera: 112, imu: 90, diffPct: 21.8 } };
    expect(suggestAction(base, { painScore: 8 }).action).toBe("re-screen");
    expect(suggestAction({ ...base, band: "High" }, {}).action).toBe("refer-orthopaedics");
  });
});
