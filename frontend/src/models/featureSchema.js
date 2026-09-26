/**
 * OA Sentinel - Biomechanical & Sensor Feature Schema
 * Defines the clinical feature set calibrated on the 51-participant clinical dataset.
 */

export const CAMERA_FEATURE_NAMES = [
  "right_knee_rom_deg",
  "left_knee_rom_deg",
  "right_hip_rom_deg",
  "left_hip_rom_deg",
  "step_duration_sec",
  "stride_duration_sec",
  "cadence_steps_min",
  "knee_rom_asymmetry_pct",
  "step_time_asymmetry_pct",
  "trunk_lean_deg",
];

export const IMU_FEATURE_NAMES = [
  "accel_variance",
  "accel_rms",
  "peak_accel",
  "gyro_variance",
  "gyro_rms",
  "angular_velocity",
  "movement_smoothness",
  "jerk",
  "step_periodicity",
];

export const FUNCTIONAL_TESTS = [
  {
    id: "walk_5m",
    name: "5-Meter Gait Walk Test",
    description: "Evaluates walking cadence, stride length, knee ROM asymmetry, and gait velocity.",
    recommendedDuration: 12,
    mode: "stopwatch",
    unit: "sec",
    targetFeatures: ["cadence_steps_min", "stride_duration_sec", "knee_rom_asymmetry_pct", "walking_velocity"],
  },
  {
    id: "sit_to_stand_5x",
    name: "5-Time Sit-to-Stand (5xSTS)",
    description: "Measures functional lower-extremity strength, knee flexion/extension range, and trunk lean.",
    recommendedDuration: 15,
    mode: "reps",
    unit: "reps",
    targetFeatures: ["right_knee_rom_deg", "left_knee_rom_deg", "trunk_lean_deg"],
  },
  {
    id: "knee_flexion",
    name: "Active Knee Flexion & Extension Test",
    description: "Captures bilateral maximal knee flexion and terminal knee extension degrees under active control.",
    recommendedDuration: 10,
    mode: "reps",
    unit: "deg",
    targetFeatures: ["right_knee_rom_deg", "left_knee_rom_deg", "knee_rom_asymmetry_pct"],
  },
  {
    id: "single_leg_stance",
    name: "Single-Leg Stance Balance Test",
    description: "Evaluates unilateral knee joint stability, postural sway, and coronal trunk compensation.",
    recommendedDuration: 10,
    mode: "countdown",
    unit: "sec",
    targetFeatures: ["trunk_lean_deg", "movement_smoothness", "angular_velocity"],
  },
];

export const DATASET_MOVEMENT_LABELS = [
  { id: "normal", label: "Normal Walking / Free Stride" },
  { id: "walking", label: "5-Meter Controlled Gait" },
  { id: "sit_to_stand", label: "Sit-to-Stand Transition" },
  { id: "knee_flexion", label: "Active Knee Flexion" },
  { id: "knee_extension", label: "Terminal Knee Extension" },
  { id: "single_leg_stance", label: "Single-Leg Stance" },
  { id: "double_shake", label: "Bilateral Foot Tapping / Shaking" },
  { id: "other", label: "Other Functional Task" },
];
