// Per-trial summary of the raw IMU readings, in the sensor's own units
// (acceleration in g, rotation in °/s) so it can be compared with the
// Arduino Serial Monitor. Works at any sample rate.

const G = 9.80665;
export const MIN_GAIT_RATE_HZ = 20; // below this, steps can't be resolved
const MIN_MOVING_DPS = 15;

const round = (v, d) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(d));

function describe(values, d) {
  if (!values.length) return { mean: null, min: null, max: null, sd: null };
  const n = values.length;
  const mean = values.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return { mean: round(mean, d), min: round(Math.min(...values), d), max: round(Math.max(...values), d), sd: round(sd, d) };
}

/** @param {{t:number,ax:number,ay:number,az:number,gx:number,gy:number,gz:number}[]} samples ax..az in m/s² */
export function imuTrialStats(samples) {
  const n = samples?.length || 0;
  const durationSec = n > 1 ? (samples[n - 1].t - samples[0].t) / 1000 : 0;
  const rateHz = durationSec > 0 ? (n - 1) / durationSec : 0;
  const g = (k) => samples.map((s) => s[k] / G);
  const d = (k) => samples.map((s) => s[k]);
  const accMag = samples.map((s) => Math.hypot(s.ax, s.ay, s.az) / G);
  const gyroMag = samples.map((s) => Math.hypot(s.gx, s.gy, s.gz));
  const axes = {
    accX: describe(n ? g("ax") : [], 3), accY: describe(n ? g("ay") : [], 3), accZ: describe(n ? g("az") : [], 3),
    gyroX: describe(n ? d("gx") : [], 1), gyroY: describe(n ? d("gy") : [], 1), gyroZ: describe(n ? d("gz") : [], 1),
  };
  const acc = describe(accMag, 3);
  const gyro = describe(gyroMag, 1);
  return {
    samples: n,
    durationSec: round(durationSec, 1),
    rateHz: round(rateHz, 1),
    axes,
    accMagnitude: acc,
    gyroMagnitude: gyro,
    moving: gyro.mean != null && gyro.mean >= MIN_MOVING_DPS,
    // At rest or walking, the average total acceleration should be close to 1 g (gravity).
    gravityOk: acc.mean != null && acc.mean >= 0.85 && acc.mean <= 1.15,
    gaitMeasurable: rateHz >= MIN_GAIT_RATE_HZ,
  };
}

/** Plain-language reading of one trial's numbers. */
export function interpretImuTrial(st, summary) {
  const out = [];
  if (st.gravityOk) out.push({ ok: true, text: `Sensor check passed: ${st.accMagnitude.mean} g average (gravity ≈ 1 g)` });
  else if (st.accMagnitude.mean != null) out.push({ ok: false, text: `Sensor check: ${st.accMagnitude.mean} g average, expected ≈ 1 g. Check the sensor wiring` });
  if (st.moving) out.push({ ok: true, text: `Leg movement detected: ${st.gyroMagnitude.mean} °/s average, ${st.gyroMagnitude.max} °/s peak` });
  else out.push({ ok: false, text: `Little leg movement (${st.gyroMagnitude.mean ?? "—"} °/s): walk during the trial` });
  if (!st.gaitMeasurable) {
    out.push({ ok: null, text: `${st.samples} readings at ${st.rateHz}/s · cadence needs ${MIN_GAIT_RATE_HZ}+/s` });
  } else if (summary?.cadenceRejected != null) {
    out.push({ ok: false, text: `Rhythm ${summary.cadenceRejected} steps/min is outside the walking range (60–150): not used` });
  } else if (summary?.cadenceSpm != null) {
    out.push({ ok: true, text: `Cadence ${summary.cadenceSpm} steps/min${summary.strideTimeCvPct != null ? ` · stride variability ${summary.strideTimeCvPct}%` : ""}` });
  } else if (st.moving) {
    out.push({ ok: false, text: "No steady walking rhythm: cadence not calculated" });
  }
  return out;
}

/** Re-times samples at an even interval between the first and last arrival. */
export function evenlySpaced(samples) {
  const n = samples.length;
  if (n < 2) return samples;
  const t0 = samples[0].t;
  const step = (samples[n - 1].t - t0) / (n - 1);
  return samples.map((x, i) => ({ ...x, t: +(t0 + i * step).toFixed(1) }));
}
