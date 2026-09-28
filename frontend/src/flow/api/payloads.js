// Converts the flow's draft into the backend's request bodies.

/** @param {import("../types").Patient} p */
export function toPatientPayload(p) {
  return {
    name: p.fullName.trim(),
    age: p.age,
    gender: p.sex === "female" ? "Female" : p.sex === "male" ? "Male" : "Other",
    height_cm: p.heightCm,
    weight_kg: p.weightKg,
    bmi: p.bmi,
    occupation: p.occupation || null,
    village: p.village.trim(),
    block: p.block || null,
    phone: p.phone || null,
    pain_score: p.painScore,
    previous_knee_injury: p.priorInjuryOrSurgery || null,
    family_history_oa: p.familyHistoryOA,
    diabetes: p.comorbidities.diabetes,
    hypertension: p.comorbidities.hypertension,
    symptom_duration_months: p.symptomDurationMonths,
    affected_side: p.affectedSide,
  };
}

const FEATURE_KEYS = [
  "right_knee_rom_deg", "left_knee_rom_deg", "right_hip_rom_deg", "left_hip_rom_deg",
  "step_duration_sec", "stride_duration_sec", "cadence_steps_min",
  "knee_rom_asymmetry_pct", "step_time_asymmetry_pct", "trunk_lean_deg",
];

/** Only measured values are sent; missing ones are left out (never 0). */
export function cameraResults(draft) {
  return draft.cameraTrials
    .filter((t) => t.accepted)
    .map((t) => {
      const out = { trial: t.index };
      for (const k of FEATURE_KEYS) if (t.features[k] != null) out[k] = t.features[k];
      return out;
    });
}

/** IMU trials as the backend's SensorReading lists, with absolute timestamps. */
export function imuTrials(draft) {
  return (draft.imu?.trials || []).filter((t) => t.accepted !== false).map((trial) => {
    const start = Date.parse(trial.startedAt);
    return trial.samples.map((s) => ({
      acc_x: s.ax, acc_y: s.ay, acc_z: s.az, gyro_x: s.gx, gyro_y: s.gy, gyro_z: s.gz,
      timestamp: new Date(start + s.t).toISOString(),
    }));
  });
}

export function isDemoDraft(draft) {
  return draft.cameraTrials.some((t) => t.isDemo) || draft.imu?.device?.source === "simulator";
}

export function screeningPayload(draft, extras = {}) {
  return {
    patient_id: draft.patient.serverId,
    readings: [],
    camera_results: cameraResults(draft),
    imu_trials: imuTrials(draft),
    is_simulated: isDemoDraft(draft),
    source: "screening_flow",
    trial_metadata: {
      trials_required: draft.trialsRequired,
      camera: draft.cameraTrials.map(({ index, startedAt, durationSec, framesCaptured, missingFeatures, accepted }) =>
        ({ index, startedAt, durationSec, framesCaptured, missingFeatures, accepted })),
      imu: (draft.imu?.trials || []).map(({ index, startedAt, durationSec, quality, summary, accepted, pairedCameraIndex }) =>
        ({ index, startedAt, durationSec, quality, summary, accepted, pairedCameraIndex })),
      imu_device: draft.imu?.device || null,
    },
    ...extras,
  };
}
