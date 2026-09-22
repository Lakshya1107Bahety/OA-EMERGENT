"""
OA Prediction Engine (modular, placeholder rule-based).

Replace `_ml_predict` with a real ML model later without changing the API/UI.
The engine reads sensor readings (MPU6050) + patient info and returns a
structured OA risk result. If a dataset is provided it is used for a simple
nearest-reference comparison; otherwise pure rule-based scoring is used.
"""
from __future__ import annotations
import math
from statistics import mean, pstdev
from typing import List, Dict, Any, Optional


def _safe_stats(values: List[float]):
    if not values:
        return 0.0, 0.0, 0.0, 0.0
    mn, mx = min(values), max(values)
    return mean(values), pstdev(values) if len(values) > 1 else 0.0, mn, mx


def extract_features(readings: List[Dict[str, float]]) -> Dict[str, float]:
    """Normalize + extract movement features from raw MPU6050 readings."""
    ax = [r.get("acc_x", 0.0) for r in readings]
    ay = [r.get("acc_y", 0.0) for r in readings]
    az = [r.get("acc_z", 0.0) for r in readings]
    gx = [r.get("gyro_x", 0.0) for r in readings]
    gy = [r.get("gyro_y", 0.0) for r in readings]
    gz = [r.get("gyro_z", 0.0) for r in readings]

    ax_m, ax_s, _, _ = _safe_stats(ax)
    ay_m, ay_s, _, _ = _safe_stats(ay)
    az_m, az_s, _, _ = _safe_stats(az)
    gx_m, gx_s, gx_min, gx_max = _safe_stats(gx)
    gy_m, gy_s, gy_min, gy_max = _safe_stats(gy)
    gz_m, gz_s, gz_min, gz_max = _safe_stats(gz)

    accel_var = (ax_s + ay_s + az_s) / 3.0
    gyro_var = (gx_s + gy_s + gz_s) / 3.0
    gyro_range = ((gx_max - gx_min) + (gy_max - gy_min) + (gz_max - gz_min)) / 3.0

    # symmetry: how balanced axis energies are (1.0 = perfectly symmetric)
    energies = [abs(ax_m) + ax_s, abs(ay_m) + ay_s, abs(az_m) + az_s]
    e_total = sum(energies) or 1.0
    e_norm = [e / e_total for e in energies]
    symmetry = 1.0 - (pstdev(e_norm) if len(e_norm) > 1 else 0.0) * 3.0
    symmetry = max(0.0, min(1.0, symmetry))

    # tremor: normalized high-frequency gyro variance
    tremor = min(1.0, gyro_var / 60.0)

    return {
        "accel_variance": round(accel_var, 4),
        "gyro_variance": round(gyro_var, 4),
        "gyro_range": round(gyro_range, 4),
        "symmetry": round(symmetry, 4),
        "tremor": round(tremor, 4),
        "sample_count": len(readings),
    }


def _ml_predict(features: Dict[str, float], patient: Dict[str, Any],
                dataset: Optional[List[Dict[str, Any]]] = None) -> float:
    """
    PLACEHOLDER ML function. Returns a probability 0..1.
    Swap this body with a real trained model call later.
    """
    # movement-derived risk
    gyro_component = min(1.0, features["gyro_variance"] / 45.0)
    range_component = min(1.0, features["gyro_range"] / 120.0)
    tremor_component = features["tremor"]
    asymmetry_component = 1.0 - features["symmetry"]

    movement_risk = (
        0.35 * gyro_component
        + 0.25 * range_component
        + 0.20 * tremor_component
        + 0.20 * asymmetry_component
    )

    # patient risk factors
    age = float(patient.get("age") or 0)
    bmi = float(patient.get("bmi") or 0)
    age_risk = min(1.0, max(0.0, (age - 40) / 45.0)) if age else 0.0
    bmi_risk = min(1.0, max(0.0, (bmi - 24) / 15.0)) if bmi else 0.0
    demo_risk = 0.6 * age_risk + 0.4 * bmi_risk

    prob = 0.65 * movement_risk + 0.35 * demo_risk

    # optional dataset nearest-reference nudge
    if dataset:
        try:
            best = min(
                dataset,
                key=lambda row: abs(float(row.get("gyro_variance", 0)) - features["gyro_variance"])
                + abs(float(row.get("symmetry", 1)) - features["symmetry"]),
            )
            label = float(best.get("oa_label", best.get("label", 0)))
            prob = 0.7 * prob + 0.3 * label
        except Exception:
            pass

    return max(0.0, min(1.0, prob))


def _risk_level(prob_pct: float) -> str:
    if prob_pct < 30:
        return "Low"
    if prob_pct < 55:
        return "Moderate"
    if prob_pct < 80:
        return "High"
    return "Severe"


def _recommendation(level: str) -> Dict[str, str]:
    table = {
        "Low": {
            "recommendation": "Maintain regular low-impact activity and monitor annually.",
            "follow_up": "Routine check-up in 12 months.",
        },
        "Moderate": {
            "recommendation": "Begin guided knee-strengthening exercises and weight management.",
            "follow_up": "Re-screen in 3 months; refer to physiotherapist if symptoms persist.",
        },
        "High": {
            "recommendation": "Clinical evaluation advised. Start structured physiotherapy and pain management.",
            "follow_up": "Doctor review within 2 weeks; imaging recommended.",
        },
        "Severe": {
            "recommendation": "Urgent doctor consultation. Possible advanced OA requiring specialist care.",
            "follow_up": "Immediate referral to orthopedic specialist.",
        },
    }
    return table[level]


def predict(readings: List[Dict[str, float]], patient: Dict[str, Any],
            dataset: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    features = extract_features(readings)
    prob = _ml_predict(features, patient, dataset)
    prob_pct = round(prob * 100, 1)
    level = _risk_level(prob_pct)

    # derived clinical sub-scores (0..100)
    knee_stability = round(max(0.0, 100.0 - features["gyro_variance"] * 1.6 - features["tremor"] * 25), 1)
    knee_stability = max(0.0, min(100.0, knee_stability))
    movement_symmetry = round(features["symmetry"] * 100, 1)
    balance_score = round(max(0.0, 100.0 - features["accel_variance"] * 30), 1)
    balance_score = max(0.0, min(100.0, balance_score))

    # confidence grows with more samples
    confidence = round(min(97.0, 55.0 + math.log1p(features["sample_count"]) * 12), 1)

    # contributing factors (share of risk)
    contribs = {
        "Gyroscope variability": min(1.0, features["gyro_variance"] / 45.0),
        "Range of motion": min(1.0, features["gyro_range"] / 120.0),
        "Tremor / instability": features["tremor"],
        "Movement asymmetry": 1.0 - features["symmetry"],
        "Age & BMI factors": 0.6 * min(1.0, max(0.0, (float(patient.get("age") or 0) - 40) / 45.0))
        + 0.4 * min(1.0, max(0.0, (float(patient.get("bmi") or 0) - 24) / 15.0)),
    }
    total = sum(contribs.values()) or 1.0
    contributing_factors = [
        {"factor": k, "weight": round(v / total * 100, 1)}
        for k, v in sorted(contribs.items(), key=lambda x: x[1], reverse=True)
    ]

    rec = _recommendation(level)
    return {
        "oa_probability": prob_pct,
        "risk_level": level,
        "confidence": confidence,
        "knee_stability_score": knee_stability,
        "movement_symmetry": movement_symmetry,
        "balance_score": balance_score,
        "features": features,
        "contributing_factors": contributing_factors,
        "recommendation": rec["recommendation"],
        "follow_up": rec["follow_up"],
        "disclaimer": "AI-assisted screening, not a medical diagnosis.",
        "engine_version": "rule-based-placeholder-v1",
    }
