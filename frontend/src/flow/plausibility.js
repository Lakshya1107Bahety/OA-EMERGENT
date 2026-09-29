// Physiological plausibility for walking measurements. Values outside these
// ranges are measurement errors (e.g. too few steps in view), so they are
// REJECTED, never clipped or replaced: a rejected value is left out and the
// model treats it as not measured.

export const PLAUSIBLE = {
  cadence_steps_min: [60, 150],
  step_duration_sec: [0.3, 1.2],
  stride_duration_sec: [0.6, 2.4],
  right_knee_rom_deg: [10, 100],
  left_knee_rom_deg: [10, 100],
  right_hip_rom_deg: [10, 120],
  left_hip_rom_deg: [10, 120],
  knee_rom_asymmetry_pct: [0, 100],
  step_time_asymmetry_pct: [0, 100],
  trunk_lean_deg: [0, 30],
};

export const CADENCE_RANGE = PLAUSIBLE.cadence_steps_min;
export const AGREE_WITHIN_PCT = 15;

export function isPlausible(key, value) {
  if (value == null) return true;
  const r = PLAUSIBLE[key];
  return !r || (Number.isFinite(value) && value >= r[0] && value <= r[1]);
}

/** Splits camera features into plausible values and rejected ones. */
export function checkCameraFeatures(features) {
  const clean = {};
  const rejected = [];
  for (const [k, v] of Object.entries(features)) {
    if (isPlausible(k, v)) clean[k] = v;
    else {
      clean[k] = null;
      rejected.push({ key: k, value: v, range: PLAUSIBLE[k] });
    }
  }
  return { clean, rejected };
}

const mean = (xs) => {
  const v = xs.filter((x) => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/**
 * Camera vs IMU cadence. Both are independent measurements of the same walk
 * type; they are compared, never copied into each other.
 */
export function cadenceAgreement(cameraValues, imuValues) {
  const cam = mean(cameraValues.filter((v) => isPlausible("cadence_steps_min", v)));
  const imu = mean(imuValues.filter((v) => isPlausible("cadence_steps_min", v)));
  const r = (x) => (x == null ? null : +x.toFixed(1));
  if (cam == null || imu == null) {
    return { camera: r(cam), imu: r(imu), diffPct: null, status: cam == null && imu == null ? "none" : "single" };
  }
  const diffPct = (Math.abs(cam - imu) / ((cam + imu) / 2)) * 100;
  return { camera: r(cam), imu: r(imu), diffPct: +diffPct.toFixed(1), status: diffPct <= AGREE_WITHIN_PCT ? "agree" : "disagree" };
}
