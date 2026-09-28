// Reference cohort mean / SD per gait measurement (from oa_healthy_reference.json:
// 3,003 walking trials, 49 participants).
export const GAIT_REF = {
  right_knee_rom_deg: [67.74, 22.44], left_knee_rom_deg: [62.34, 18.85],
  right_hip_rom_deg: [70.6, 22.11], left_hip_rom_deg: [77.26, 26.49],
  step_duration_sec: [0.5, 0.12], stride_duration_sec: [1.0, 0.24],
  cadence_steps_min: [126.57, 30.19], knee_rom_asymmetry_pct: [21.05, 22.82],
  step_time_asymmetry_pct: [21.83, 19.65], trunk_lean_deg: [4.86, 4.05],
};

export const GAIT_LABEL = {
  right_knee_rom_deg: "Right knee range of motion", left_knee_rom_deg: "Left knee range of motion",
  right_hip_rom_deg: "Right hip range of motion", left_hip_rom_deg: "Left hip range of motion",
  step_duration_sec: "Step duration", stride_duration_sec: "Stride duration", cadence_steps_min: "Cadence",
  knee_rom_asymmetry_pct: "Knee ROM asymmetry", step_time_asymmetry_pct: "Step time asymmetry",
  trunk_lean_deg: "Trunk lean",
};

export const GAIT_UNIT = {
  right_knee_rom_deg: "°", left_knee_rom_deg: "°", right_hip_rom_deg: "°", left_hip_rom_deg: "°",
  step_duration_sec: " s", stride_duration_sec: " s", cadence_steps_min: " steps/min",
  knee_rom_asymmetry_pct: "%", step_time_asymmetry_pct: "%", trunk_lean_deg: "°",
};

/** z-score against the reference cohort, or null when not measured. */
export function gaitZ(key, value) {
  if (value == null || !GAIT_REF[key]) return null;
  const [m, sd] = GAIT_REF[key];
  return +((value - m) / sd).toFixed(2);
}
