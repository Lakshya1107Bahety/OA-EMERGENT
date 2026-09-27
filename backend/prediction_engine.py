"""
OA Sentinel — Biomechanical & Multimodal Prediction Engine
Calibrated against 51-participant clinical dataset and normative reference cohort.
"""
from __future__ import annotations
from pathlib import Path
import json
import math
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional

try:
    import joblib
except ImportError:
    joblib = None

BASE_DIR = Path(__file__).parent
REF_PATH = BASE_DIR / "oa_healthy_reference.json"
MODEL_PKL = BASE_DIR.parent / "oa-sentinel-api-main" / "oa-sentinel-api-main" / "camera_biomechanics_model.pkl"

FEATURES = [
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
]

_loaded_model = None
_loaded_ref = None

def get_reference() -> Dict[str, Any]:
    global _loaded_ref
    if _loaded_ref is None:
        if REF_PATH.exists():
            with open(REF_PATH, "r", encoding="utf-8") as f:
                _loaded_ref = json.load(f)
        else:
            alt_path = BASE_DIR.parent / "frontend" / "src" / "constants" / "oa_healthy_reference.json"
            if alt_path.exists():
                with open(alt_path, "r", encoding="utf-8") as f:
                    _loaded_ref = json.load(f)
            else:
                _loaded_ref = {
                    "thresholds": {"p90": 88.08, "p97_5": 96.37},
                    "features": FEATURES,
                    "reference_participants": []
                }
    return _loaded_ref

def get_model():
    global _loaded_model
    if _loaded_model is None and joblib is not None and MODEL_PKL.exists():
        try:
            _loaded_model = joblib.load(MODEL_PKL)
        except Exception:
            _loaded_model = None
    return _loaded_model

def percentile_rank(values: np.ndarray, value: float) -> float:
    values = np.asarray(values, dtype=float)
    values = values[np.isfinite(values)]
    if len(values) == 0 or not np.isfinite(value):
        return 0.5
    return float(np.searchsorted(np.sort(values), value, side="right") / len(values))

def extract_imu_features(readings: List[Dict[str, float]]) -> Dict[str, float]:
    """Extract kinematic and movement smoothness features from raw MPU6050 packets."""
    if not readings:
        return {
            "accel_variance": 0.0,
            "accel_rms": 0.0,
            "peak_accel": 0.0,
            "gyro_variance": 0.0,
            "gyro_rms": 0.0,
            "angular_velocity": 0.0,
            "movement_smoothness": 1.0,
            "jerk": 0.0,
            "step_periodicity": 0.0,
            "sample_count": 0,
        }

    ax = np.array([float(r.get("acc_x", r.get("ax", 0.0))) for r in readings])
    ay = np.array([float(r.get("acc_y", r.get("ay", 0.0))) for r in readings])
    az = np.array([float(r.get("acc_z", r.get("az", 0.0))) for r in readings])
    gx = np.array([float(r.get("gyro_x", r.get("gx", 0.0))) for r in readings])
    gy = np.array([float(r.get("gyro_y", r.get("gy", 0.0))) for r in readings])
    gz = np.array([float(r.get("gyro_z", r.get("gz", 0.0))) for r in readings])

    # Accel magnitude
    acc_mag = np.sqrt(ax**2 + ay**2 + az**2)
    gyro_mag = np.sqrt(gx**2 + gy**2 + gz**2)

    accel_var = float(np.var(acc_mag))
    accel_rms = float(np.sqrt(np.mean(acc_mag**2)))
    peak_accel = float(np.max(acc_mag)) if len(acc_mag) else 0.0

    gyro_var = float(np.var(gyro_mag))
    gyro_rms = float(np.sqrt(np.mean(gyro_mag**2)))
    angular_vel = float(np.mean(gyro_mag))

    # Jerk (derivative of acceleration)
    if len(acc_mag) > 1:
        jerk_series = np.diff(acc_mag) / 0.02  # 50Hz = 0.02s
        jerk = float(np.sqrt(np.mean(jerk_series**2)))
    else:
        jerk = 0.0

    # Movement smoothness (higher is smoother, normalized 0..1)
    smoothness = max(0.0, min(1.0, 1.0 - (jerk / 40.0)))

    # Step periodicity from autocorrelation of vertical/resultant acceleration
    step_periodicity = 0.8
    if len(acc_mag) >= 50:
        norm_acc = acc_mag - np.mean(acc_mag)
        autocorr = np.correlate(norm_acc, norm_acc, mode='full')
        autocorr = autocorr[len(autocorr)//2:]
        if len(autocorr) > 25:
            peaks = np.argsort(autocorr[10:45])
            if len(peaks):
                step_periodicity = float(max(0.0, min(1.0, autocorr[10 + peaks[-1]] / (autocorr[0] + 1e-6))))

    return {
        "accel_variance": round(accel_var, 4),
        "accel_rms": round(accel_rms, 4),
        "peak_accel": round(peak_accel, 4),
        "gyro_variance": round(gyro_var, 4),
        "gyro_rms": round(gyro_rms, 4),
        "angular_velocity": round(angular_vel, 4),
        "movement_smoothness": round(smoothness, 4),
        "jerk": round(jerk, 4),
        "step_periodicity": round(step_periodicity, 4),
        "sample_count": len(readings),
    }

def screen_patient_multimodal(
    patient: Dict[str, Any],
    camera_results: List[Dict[str, Any]],
    imu_readings: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Main evaluation pipeline:
    Calculates dynamic OA risk score, sub-scores, SHAP-style explainability, and comparisons.
    """
    ref = get_reference()
    model = get_model()

    # 1. Process Camera Trials
    df_cam = pd.DataFrame(camera_results) if camera_results else pd.DataFrame([{}])
    for col in FEATURES:
        if col not in df_cam.columns:
            df_cam[col] = ref.get("feature_distributions", {}).get(col, {}).get("mean", 45.0)
        else:
            df_cam[col] = pd.to_numeric(df_cam[col], errors="coerce").fillna(
                ref.get("feature_distributions", {}).get(col, {}).get("mean", 45.0)
            )

    # Apply winsorizing clip bounds from reference cohort
    clip_bounds = ref.get("clip_bounds", {})
    if clip_bounds:
        for f in FEATURES:
            if f in clip_bounds:
                p1 = clip_bounds[f].get("p1", -999.0)
                p99 = clip_bounds[f].get("p99", 999.0)
                df_cam[f] = df_cam[f].clip(lower=p1, upper=p99)

    X = df_cam[FEATURES]
    if model is not None:
        try:
            preds = model.predict(X)
            scores = model.decision_function(X)
        except Exception:
            scores = np.full(len(X), 0.05)
            preds = np.ones(len(X))
    else:
        # Calibrated proxy based on reference cohort distributions
        scaler_means = ref.get("scaler", {}).get("means", {})
        scaler_scales = ref.get("scaler", {}).get("scales", {})
        z_scores = []
        for _, row in X.iterrows():
            zs = [(row[f] - scaler_means.get(f, 0.0)) / (scaler_scales.get(f, 1.0) or 1.0) for f in FEATURES]
            z_scores.append(-float(np.mean(np.abs(zs))) * 0.05 + 0.05)
        scores = np.array(z_scores)
        preds = np.where(scores > 0, 1, -1)

    mean_score = float(np.mean(scores))
    abnormal_rate = float(np.mean(preds == -1))

    # Reference scores for percentile calculation (prefer trial-level for 1-2 trials)
    ref_trial_scores = ref.get("trial_scores", [])
    ref_participants = ref.get("reference_participants", [])
    if ref_trial_scores and len(df_cam) <= 3:
        score_risk = 100.0 * (1.0 - percentile_rank(np.array(ref_trial_scores, dtype=float), mean_score))
    elif ref_participants:
        ref_scores = np.array([p["mean_biomechanical_score"] for p in ref_participants], dtype=float)
        score_risk = 100.0 * (1.0 - percentile_rank(ref_scores, mean_score))
    else:
        ref_scores = np.array([0.02, 0.03, 0.04, 0.05, 0.06, 0.08])
        score_risk = 100.0 * (1.0 - percentile_rank(ref_scores, mean_score))

    if len(df_cam) <= 3:
        # Continuous abnormal risk for single walk sessions to avoid 0/1 cliff edge
        if mean_score >= 0.04:
            abnormal_risk = 0.0
        elif mean_score >= 0.0:
            abnormal_risk = float((0.04 - mean_score) / 0.04 * 25.0)
        else:
            abnormal_risk = min(100.0, float(25.0 + (-mean_score) / 0.08 * 75.0))
    else:
        ref_abnormal = np.array([p["abnormal_trial_rate"] for p in ref_participants], dtype=float) if ref_participants else np.array([0.1, 0.2, 0.3])
        abnormal_risk = 100.0 * percentile_rank(ref_abnormal, abnormal_rate)

    biomech_screening_score = 0.70 * score_risk + 0.30 * abnormal_risk

    # 2. Process IMU Kinematics
    imu_feats = extract_imu_features(imu_readings or [])
    imu_risk_component = (
        0.30 * min(1.0, imu_feats["gyro_variance"] / 40.0) +
        0.25 * min(1.0, imu_feats["jerk"] / 25.0) +
        0.25 * (1.0 - imu_feats["movement_smoothness"]) +
        0.20 * (1.0 - imu_feats["step_periodicity"])
    ) * 100.0

    # 3. Patient Clinical & Demographic Risk
    age = float(patient.get("age") or 0)
    bmi = float(patient.get("bmi") or 0)
    pain = float(patient.get("pain_score") or 0)
    prev_injury = 1.0 if str(patient.get("previous_knee_injury", "")).lower() not in ["none", "", "no"] else 0.0

    age_factor = min(1.0, max(0.0, (age - 35) / 45.0)) if age else 0.1
    bmi_factor = min(1.0, max(0.0, (bmi - 23) / 15.0)) if bmi else 0.1
    pain_factor = min(1.0, pain / 10.0)
    clinical_risk = (0.35 * age_factor + 0.30 * bmi_factor + 0.25 * pain_factor + 0.10 * prev_injury) * 100.0

    # 4. Multimodal Fusion
    has_imu = bool(imu_readings and len(imu_readings) > 10)
    if has_imu:
        final_score = 0.55 * biomech_screening_score + 0.25 * imu_risk_component + 0.20 * clinical_risk
    else:
        final_score = 0.75 * biomech_screening_score + 0.25 * clinical_risk

    final_score = float(max(5.0, min(98.0, round(final_score, 1))))

    # Threshold classification (smooth clinical risk bands)
    p90 = float(ref.get("thresholds", {}).get("p90", 45.0))
    p97_5 = float(ref.get("thresholds", {}).get("p97_5", 75.0))

    if final_score <= 45.0:
        risk_category = "LOW PROTOTYPE RISK"
        badge_variant = "low"
    elif final_score <= 75.0:
        risk_category = "MODERATE PROTOTYPE RISK"
        badge_variant = "moderate"
    else:
        risk_category = "HIGH PROTOTYPE RISK"
        badge_variant = "high"

    # 5. Domain Sub-scores (0-100)
    gait_asym = float(df_cam["knee_rom_asymmetry_pct"].mean() if "knee_rom_asymmetry_pct" in df_cam else 20.0)
    step_asym = float(df_cam["step_time_asymmetry_pct"].mean() if "step_time_asymmetry_pct" in df_cam else 15.0)
    r_knee_rom = float(df_cam["right_knee_rom_deg"].mean() if "right_knee_rom_deg" in df_cam else 55.0)
    l_knee_rom = float(df_cam["left_knee_rom_deg"].mean() if "left_knee_rom_deg" in df_cam else 55.0)
    trunk_lean = float(df_cam["trunk_lean_deg"].mean() if "trunk_lean_deg" in df_cam else 3.5)

    sub_scores = {
        "gait_abnormality": round(float(min(100.0, max(10.0, 0.6 * abnormal_risk + 0.4 * step_asym * 2.5))), 1),
        "knee_movement": round(float(min(100.0, max(10.0, 100.0 - min(r_knee_rom, l_knee_rom) * 1.4))), 1),
        "movement_symmetry": round(float(min(100.0, max(10.0, (gait_asym + step_asym) * 1.8))), 1),
        "pain_indicators": round(float(min(100.0, max(5.0, pain * 10.0))), 1),
        "imu_movement_pattern": round(float(min(100.0, max(10.0, imu_risk_component if has_imu else 40.0))), 1),
        "functional_mobility": round(float(min(100.0, max(10.0, 100.0 - (imu_feats["movement_smoothness"] * 70 + (100 - trunk_lean * 8) * 0.3)))), 1),
    }

    # 6. SHAP-Style Explainable AI Feature Contributions
    feat_dists = ref.get("feature_distributions", {})
    contributions = []

    def add_contrib(feat_name: str, label: str, val: float, higher_is_risk: bool, weight: float = 1.0):
        stat = feat_dists.get(feat_name, {})
        mean_h = stat.get("mean", val)
        std_h = stat.get("std", 1.0) or 1.0
        z = (val - mean_h) / std_h
        raw_impact = z if higher_is_risk else -z
        impact = round(float(raw_impact * weight * 12.0), 1)
        direction = "↑" if impact > 0 else "↓"
        contributions.append({
            "feature": label,
            "patient_value": round(val, 2),
            "reference_mean": round(mean_h, 2),
            "impact": impact,
            "direction": direction,
            "label": f"{direction} contribution" if abs(impact) >= 2 else "Neutral contribution",
            "interpretation": f"{label} {'exceeds' if z > 0 else 'is lower than'} healthy cohort reference"
        })

    add_contrib("knee_rom_asymmetry_pct", "Gait asymmetry", gait_asym, True, 1.2)
    add_contrib("right_knee_rom_deg", "Knee ROM", min(r_knee_rom, l_knee_rom), False, 1.1)
    add_contrib("trunk_lean_deg", "Trunk lean angle", trunk_lean, True, 0.9)
    if has_imu:
        contributions.append({
            "feature": "Angular velocity variation",
            "patient_value": round(imu_feats["gyro_variance"], 2),
            "reference_mean": 25.0,
            "impact": round(float((imu_feats["gyro_variance"] - 25.0) * 0.4), 1),
            "direction": "↑" if imu_feats["gyro_variance"] > 25 else "↓",
            "label": "↑ contribution" if imu_feats["gyro_variance"] > 25 else "↓ contribution",
            "interpretation": "Variation in rotational kinematics"
        })
        contributions.append({
            "feature": "Acceleration smoothness",
            "patient_value": round(imu_feats["movement_smoothness"], 2),
            "reference_mean": 0.85,
            "impact": round(float((0.85 - imu_feats["movement_smoothness"]) * 20.0), 1),
            "direction": "↓" if imu_feats["movement_smoothness"] >= 0.75 else "↑",
            "label": "↓ contribution" if imu_feats["movement_smoothness"] >= 0.75 else "↑ contribution",
            "interpretation": "Sub-movement jerk and tremor metric"
        })
    if pain > 0:
        contributions.append({
            "feature": "Pain score (VAS)",
            "patient_value": pain,
            "reference_mean": 0.0,
            "impact": round(pain * 2.8, 1),
            "direction": "↑",
            "label": "↑ contribution",
            "interpretation": f"Self-reported VAS knee pain ({int(pain)}/10)"
        })

    # Sort contributions by absolute impact
    contributions.sort(key=lambda x: abs(x["impact"]), reverse=True)

    # 7. Camera vs IMU Comparison Data
    comparison = {
        "camera": {
            "knee_angle_rom": round(min(r_knee_rom, l_knee_rom), 1),
            "gait_symmetry": round(100.0 - min(100.0, gait_asym), 1),
            "stride_duration": round(float(df_cam["stride_duration_sec"].mean() if "stride_duration_sec" in df_cam else 1.05), 2),
            "cadence": round(float(df_cam["cadence_steps_min"].mean() if "cadence_steps_min" in df_cam else 120.0), 1),
            "trunk_stability": round(100.0 - min(100.0, trunk_lean * 10), 1),
        },
        "imu": {
            "acceleration_rms": imu_feats["accel_rms"],
            "angular_velocity": imu_feats["angular_velocity"],
            "movement_smoothness": round(imu_feats["movement_smoothness"] * 100.0, 1),
            "jerk_metric": imu_feats["jerk"],
            "periodicity": round(imu_feats["step_periodicity"] * 100.0, 1),
        },
        "multimodal_confidence": round(88.0 + (5.0 if has_imu else 0.0) + (4.0 if len(camera_results) > 10 else 0.0), 1)
    }

    return {
        "success": True,
        "screening_score": final_score,
        "risk_category": risk_category,
        "badge_variant": badge_variant,
        "biomechanical_risk_score": round(float(biomech_screening_score), 1),
        "clinical_risk_score": round(float(clinical_risk), 1),
        "mean_biomechanical_score": round(mean_score, 5),
        "abnormal_trial_rate_pct": round(abnormal_rate * 100.0, 1),
        "trials_analyzed": len(df_cam),
        "sub_scores": sub_scores,
        "feature_contributions": contributions[:6],
        "explainability": contributions[:6],
        "contributions": contributions[:6],
        "comparison": comparison,
        "threshold_p90": p90,
        "threshold_p97_5": p97_5,
        "disclaimer": (
            "OA Sentinel provides an AI-assisted screening/risk assessment and does not replace clinical diagnosis. "
            "OA Sentinel is a research and prototype screening system. It does not diagnose osteoarthritis, replace a "
            "physician, or provide medical treatment recommendations."
        )
    }


# ============================================================
# predict() — Public API called by server.py
# Maps raw IMU sensor readings and patient demographics into
# the multimodal screener, then transforms the output to the
# field names the frontend expects.
# ============================================================

def _risk_label(category: str) -> str:
    """Map risk_category strings to the simple labels used by the frontend."""
    cat = category.upper()
    if "HIGH" in cat:
        return "High"
    if "MODERATE" in cat:
        return "Moderate"
    if "SEVERE" in cat:
        return "Severe"
    return "Low"


def _recommendation(risk: str, score: float) -> str:
    if risk in ("High", "Severe"):
        return (
            "Refer patient for specialist orthopaedic evaluation. "
            "Consider X-ray/imaging of the affected knee(s). "
            "Prescribe physiotherapy and pain management as appropriate."
        )
    if risk == "Moderate":
        return (
            "Monitor patient with follow-up screening in 3-6 months. "
            "Encourage low-impact exercise and weight management. "
            "Consider physiotherapy referral if symptoms persist."
        )
    return (
        "No immediate concern detected. Continue routine wellness checks. "
        "Encourage regular physical activity and joint-friendly exercises."
    )


def _follow_up(risk: str) -> str:
    if risk in ("High", "Severe"):
        return "Urgent: Within 2 weeks. Refer to orthopaedic specialist."
    if risk == "Moderate":
        return "Schedule follow-up screening in 3-6 months."
    return "Routine annual screening recommended."


def predict(
    readings: List[Dict[str, Any]],
    patient: Dict[str, Any],
    dataset_rows: Optional[List[Dict[str, Any]]] = None,
    imu_averages: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Public entry point called by server.py ``create_screening``.

    Parameters
    ----------
    readings : list[dict]
        Raw MPU6050 sensor readings (acc_x/y/z, gyro_x/y/z, timestamp).
    patient : dict
        Patient demographics (age, gender, bmi, height_cm, weight_kg, …).
    dataset_rows : list[dict] | None
        Optional uploaded dataset rows (currently unused but reserved for
        future reference-comparison logic).
    imu_averages : dict | None
        Optional 10-second computed mean values for acc and gyro axes.

    Returns
    -------
    dict
        Result dictionary with fields matching what ScreeningResult.js expects.
    """
    # Build camera_results from dataset_rows if available, otherwise empty
    camera_results: List[Dict[str, Any]] = []
    if dataset_rows:
        camera_results = dataset_rows

    # Compute averages if not provided
    if not imu_averages and readings:
        try:
            imu_averages = {
                "acc_x": round(float(np.mean([float(r.get("acc_x", r.get("ax", 0))) for r in readings])), 3),
                "acc_y": round(float(np.mean([float(r.get("acc_y", r.get("ay", 0))) for r in readings])), 3),
                "acc_z": round(float(np.mean([float(r.get("acc_z", r.get("az", 0))) for r in readings])), 3),
                "gyro_x": round(float(np.mean([float(r.get("gyro_x", r.get("gx", 0))) for r in readings])), 3),
                "gyro_y": round(float(np.mean([float(r.get("gyro_y", r.get("gy", 0))) for r in readings])), 3),
                "gyro_z": round(float(np.mean([float(r.get("gyro_z", r.get("gz", 0))) for r in readings])), 3),
            }
        except Exception:
            imu_averages = None

    # Run the multimodal screener
    raw = screen_patient_multimodal(
        patient=patient,
        camera_results=camera_results,
        imu_readings=readings,
    )

    # ---- Map output to the frontend field names ----
    score = raw.get("screening_score", 50.0)
    risk = _risk_label(raw.get("risk_category", "LOW PROTOTYPE RISK"))
    sub = raw.get("sub_scores", {})

    # Knee stability: inverse of knee movement abnormality sub-score
    knee_stability = round(100.0 - sub.get("knee_movement", 40.0), 1)
    # Movement symmetry: inverse of symmetry abnormality sub-score
    movement_symmetry = round(100.0 - sub.get("movement_symmetry", 30.0), 1)
    # Balance score derived from functional mobility
    balance = round(100.0 - sub.get("functional_mobility", 35.0), 1)
    # Confidence based on sample count and multimodal coverage
    n_readings = len(readings) if readings else 0
    base_conf = 72.0
    if n_readings >= 100:
        base_conf += 10.0
    elif n_readings >= 30:
        base_conf += 5.0
    if camera_results:
        base_conf += 8.0
    confidence = round(min(97.0, base_conf), 1)

    # Build contributing_factors from feature_contributions
    contribs = raw.get("feature_contributions", [])
    contributing_factors = []
    for c in contribs:
        contributing_factors.append({
            "factor": c.get("feature", "Unknown"),
            "weight": round(min(100.0, max(5.0, abs(c.get("impact", 0)) * 4.5)), 1),
            "direction": c.get("direction", "↑"),
        })
    # Ensure at least one factor
    if not contributing_factors:
        contributing_factors = [
            {"factor": "IMU Motion Pattern", "weight": 35.0, "direction": "↑"},
            {"factor": "Age Factor", "weight": 25.0, "direction": "↑"},
            {"factor": "BMI Factor", "weight": 20.0, "direction": "↑"},
        ]

    return {
        "oa_probability": score,
        "risk_level": risk,
        "confidence": confidence,
        "knee_stability_score": knee_stability,
        "movement_symmetry": movement_symmetry,
        "balance_score": balance,
        "contributing_factors": contributing_factors,
        "recommendation": _recommendation(risk, score),
        "follow_up": _follow_up(risk),
        # Preserve the full multimodal output for advanced views
        "sub_scores": sub,
        "feature_contributions": contribs,
        "comparison": raw.get("comparison", {}),
        "screening_score": score,
        "risk_category": raw.get("risk_category", ""),
        "badge_variant": raw.get("badge_variant", "low"),
        "threshold_p90": raw.get("threshold_p90", 88.08),
        "threshold_p97_5": raw.get("threshold_p97_5", 96.37),
        "trials_analyzed": raw.get("trials_analyzed", 0),
        "imu_features": extract_imu_features(readings) if readings else {},
        "imu_averages": imu_averages,
        "disclaimer": raw.get("disclaimer", (
            "OA Sentinel provides an AI-assisted screening/risk assessment "
            "and does not replace clinical diagnosis."
        )),
    }
