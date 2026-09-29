// Turns the backend analysis into the flow's MultimodalResult and OARiskReport.
// Policy (agreed): the risk band comes from the calibrated camera gait score.
// IMU is used for the band only when no camera score exists, and is labelled
// uncalibrated. Clinical factors are listed, never weighted. No invented
// fusion weights or confidence percentages.
import { isDemoDraft } from "./api/payloads";
import { cadenceAgreement, AGREE_WITHIN_PCT } from "./plausibility";

/** @typedef {import("./types").MultimodalResult} MultimodalResult */
/** @typedef {import("./types").OARiskReport} OARiskReport */

const avg = (xs) => {
  const v = xs.filter((x) => x != null && Number.isFinite(x));
  return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null;
};

/** @returns {MultimodalResult} */
export function buildMultimodal(result, draft) {
  // Demo status is per modality: a simulated IMU must not downgrade real camera data.
  const engineDemo = !!result.is_demo || result.engine_version === "demo";
  const cameraDemo = engineDemo || draft.cameraTrials.some((t) => t.isDemo);
  const imuDemo = engineDemo || draft.imu?.device?.source === "simulator";
  const demo = cameraDemo || imuDemo || isDemoDraft(draft);
  const gait = result.gait || {};
  const imu = result.imu || {};
  const imuTrials = (draft.imu?.trials || []).filter((t) => t.accepted);
  const camUsable = draft.cameraTrials.filter((t) => t.accepted);
  const dev = typeof result.deviation_score === "number" ? result.deviation_score : null;

  const vision = {
    modality: "vision",
    calibrated: !!gait.available && !cameraDemo,
    headline: dev != null ? `Gait deviation ${dev.toFixed(1)}` : "No calibrated gait score",
    value: dev,
    factors: (result.feature_deviations || []).slice(0, 5).map((d) => ({
      label: d.feature, value: `${d.patient_value} (ref ${d.reference_mean})`, zScore: d.z_score,
    })),
  };
  const imuMod = {
    modality: "imu",
    calibrated: false,
    headline: imu.irregularity_index != null
      ? `Irregularity index ${imu.irregularity_index} (${imu.irregularity_tier})`
      : imu.irregularity_reason || "No IMU score",
    value: imu.irregularity_index ?? null,
    factors: [
      { label: "Cadence (mean)", value: `${avg(imuTrials.map((t) => t.summary.cadenceSpm)) ?? "—"} steps/min` },
      { label: "Stride-time variability (mean)", value: `${avg(imuTrials.map((t) => t.summary.strideTimeCvPct)) ?? "—"} %` },
      { label: "Step symmetry (approx., mean)", value: `${avg(imuTrials.map((t) => t.summary.stepSymmetryPct)) ?? "—"} %` },
    ],
  };
  const clin = result.clinical_risk_factors || [];
  const clinical = {
    modality: "clinical",
    calibrated: false,
    headline: `${clin.length} known risk factor${clin.length === 1 ? "" : "s"} present`,
    value: clin.length,
    factors: clin.map((c) => ({ label: c.factor, value: c.value })),
  };

  // Camera and IMU measure cadence independently: compare them, never merge or copy.
  const cadenceCheck = cadenceAgreement(
    camUsable.map((t) => t.features?.cadence_steps_min),
    imuTrials.map((t) => t.summary?.cadenceSpm),
  );

  const flags = [];
  if (cameraDemo) flags.push("Camera trials are demo data: not a real screening.");
  if (imuDemo && !engineDemo) flags.push("IMU data is simulated (no hardware): IMU findings are not real.");
  if (gait.features_imputed) flags.push(`${gait.features_imputed} camera measurement(s) not captured; filled with the reference median.`);
  if (gait.trials_flagged_atypical) flags.push(`${gait.trials_flagged_atypical} camera trial(s) flagged atypical by the model.`);
  const highDrop = imuTrials.filter((t) => (t.quality.droppedPct ?? 0) > 5).length;
  if (highDrop) flags.push(`${highDrop} IMU trial(s) lost more than 5% of samples.`);
  if (dev == null) flags.push("No calibrated gait score: the band is not based on the reference cohort.");
  if (cadenceCheck.status === "disagree") flags.push(`Camera and IMU cadence differ by ${cadenceCheck.diffPct}% (more than ${AGREE_WITHIN_PCT}%): one of the recordings is unreliable.`);
  const rejected = draft.cameraTrials.filter((t) => t.accepted).reduce((n, t) => n + (t.rejectedFeatures?.length || 0), 0);
  if (rejected) flags.push(`${rejected} implausible camera value(s) were left out (outside the human walking range).`);

  return {
    engineVersion: result.engine_version || "unknown",
    status: "done",
    gaitDeviation: dev,
    gaitCalibrated: vision.calibrated,
    band: result.risk_level || "Not determined",
    bandSource: result.score_type === "gait_deviation_percentile" ? "vision"
      : result.score_type === "imu_irregularity_index" ? "imu" : null,
    modalities: [clinical, vision, imuMod],
    cadenceCheck,
    dataQuality: {
      usableCameraTrials: camUsable.length,
      usableImuTrials: imuTrials.length,
      missingMeasurements: gait.features_imputed || 0,
      flags,
    },
    raw: result,
    analyzedAt: new Date().toISOString(),
    isDemo: demo,
    demo: { vision: cameraDemo, imu: imuDemo, clinical: false },
  };
}

export const ACTIONS = {
  "re-screen": "Re-screen",
  physiotherapy: "Physiotherapy",
  radiograph: "Knee radiograph",
  "refer-orthopaedics": "Refer to orthopaedics",
};

/** Suggested next action. The clinician can change it; the rule is shown. */
export function suggestAction(mm, patient) {
  const pain = patient?.painScore ?? 0;
  if (mm.bandSource === "imu") {
    return mm.band === "Low"
      ? { action: "re-screen", why: "IMU pattern regular, but IMU is uncalibrated and no camera score exists: routine re-screen with camera." }
      : { action: "re-screen", why: "IMU pattern irregular, but IMU is uncalibrated: repeat with camera gait analysis and examine the knee before any referral." };
  }
  if (mm.cadenceCheck?.status === "disagree" && mm.band !== "High") {
    return { action: "re-screen", why: `Camera (${mm.cadenceCheck.camera}) and IMU (${mm.cadenceCheck.imu}) cadence disagree by ${mm.cadenceCheck.diffPct}%: repeat both recordings before acting on the band.` };
  }
  switch (mm.band) {
    case "High":
      return { action: "refer-orthopaedics", why: "Gait less typical than 97.5% of reference walking trials: refer for orthopaedic examination; radiograph only if the examination indicates it." };
    case "Moderate":
      return pain >= 7
        ? { action: "refer-orthopaedics", why: "Gait less typical than 90% of reference trials with severe pain (≥7/10): refer for examination." }
        : { action: "physiotherapy", why: "Gait less typical than 90% of reference trials: physiotherapy and re-screen in 3–6 months." };
    case "Low":
      return pain >= 7
        ? { action: "physiotherapy", why: "Gait within the typical range but severe pain (≥7/10): physiotherapy and clinical review." }
        : { action: "re-screen", why: "Gait within the typical range of the reference cohort: routine re-screen; does not rule out OA." };
    default:
      return { action: "re-screen", why: "No score could be computed: repeat the camera gait assessment." };
  }
}

/** Top drivers: calibrated gait deviations first, then IMU, then clinical factors. */
export function topDrivers(mm) {
  const [clinical, vision, imu] = mm.modalities;
  const out = [];
  for (const f of vision.factors) {
    if (f.zScore != null && Math.abs(f.zScore) >= 1) {
      out.push({ label: f.label, detail: `${f.value}; ${Math.abs(f.zScore).toFixed(1)} SD ${f.zScore > 0 ? "above" : "below"} the reference mean`, modality: "vision", calibrated: vision.calibrated });
    }
  }
  if (imu.value != null && mm.raw?.imu?.irregularity_tier && mm.raw.imu.irregularity_tier !== "Low") {
    out.push({ label: "Irregular walking pattern (IMU)", detail: imu.headline, modality: "imu", calibrated: false });
  }
  for (const f of clinical.factors) out.push({ label: f.label, detail: f.value, modality: "clinical", calibrated: false });
  return out.slice(0, 8);
}

/** @returns {OARiskReport} */
export function buildReport(mm, patient, previous) {
  const s = suggestAction(mm, patient);
  return {
    band: mm.band,
    riskScore: mm.gaitDeviation ?? (mm.bandSource === "imu" ? mm.modalities[2].value : null),
    topDrivers: topDrivers(mm),
    recommendedAction: previous?.recommendedAction || s.action,
    suggestedAction: s.action,
    actionRationale: s.why,
    clinicianNotes: previous?.clinicianNotes || "",
    signOff: previous?.signOff,
    screeningId: previous?.screeningId,
    sync: previous?.sync || "local",
  };
}
