"""
OA Sentinel — screening engine.

What this engine measures, and what it does not
-----------------------------------------------
The only calibrated component is camera gait analysis. An Isolation Forest
(camera_biomechanics_model.pkl) was trained on 3,003 walking trials from a
49-participant reference cohort (camera_features.csv). A patient's own camera
trials are scored with that model and ranked against the reference trial
scores, giving a *gait deviation percentile*: the share of reference walking
trials that look more typical than the patient's gait.

The reference cohort contains no diagnosed OA patients, so the score measures
how atypical the gait is. It is NOT a probability of osteoarthritis.

IMU features and clinical risk factors are computed and reported, but they
are not fused into the score:
  * there is no IMU reference cohort to calibrate IMU features against;
  * there is no outcome data to weight clinical factors against each other.
Both are shown to the clinician as context instead of being turned into
made-up numbers.

Without camera trials no score is produced (risk_level "Not determined").
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import json
import math

import numpy as np
import pandas as pd

try:
    import joblib
except ImportError:  # pragma: no cover - reported via model_status
    joblib = None

ENGINE_VERSION = "2.0"

BASE_DIR = Path(__file__).parent
REF_PATH = BASE_DIR / "oa_healthy_reference.json"
MODEL_PATHS = [
    BASE_DIR / "camera_biomechanics_model.pkl",
    BASE_DIR.parent / "oa-sentinel-api-main" / "oa-sentinel-api-main" / "camera_biomechanics_model.pkl",
]

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

FEATURE_LABELS = {
    "right_knee_rom_deg": "Right knee range of motion",
    "left_knee_rom_deg": "Left knee range of motion",
    "right_hip_rom_deg": "Right hip range of motion",
    "left_hip_rom_deg": "Left hip range of motion",
    "step_duration_sec": "Step duration",
    "stride_duration_sec": "Stride duration",
    "cadence_steps_min": "Cadence",
    "knee_rom_asymmetry_pct": "Knee ROM asymmetry",
    "step_time_asymmetry_pct": "Step time asymmetry",
    "trunk_lean_deg": "Trunk lean",
}

# A trial must contain at least this many measured features to be scored;
# the rest are filled by the model's median imputer.
MIN_MEASURED_FEATURES = 6

G = 9.80665
DEFAULT_DT = 0.02  # 50 Hz, the firmware's sampling rate

# IMU gait irregularity index -- UNCALIBRATED. There is no IMU reference cohort,
# so these cut-offs are provisional and must be re-set once healthy IMU
# recordings exist. Only computed when the sensor shows walking movement.
IMU_MIN_SAMPLES = 100            # 2 s at 50 Hz
IMU_MIN_ANGULAR_VELOCITY = 15.0  # deg/s mean; below this the leg is not moving
IMU_TIER_MODERATE = 40.0
IMU_TIER_HIGH = 60.0

NOT_DETERMINED = "Not determined"

_model = None
_model_error: Optional[str] = None
_reference = None


# ---------------------------------------------------------------- loading
def get_reference() -> Dict[str, Any]:
    global _reference
    if _reference is None:
        with open(REF_PATH, "r", encoding="utf-8") as f:
            _reference = json.load(f)
    return _reference


def get_model():
    """Load the trained gait model once. Returns None if it is unavailable."""
    global _model, _model_error
    if _model is not None or _model_error is not None:
        return _model
    if joblib is None:
        _model_error = "joblib / scikit-learn is not installed"
        return None
    path = next((p for p in MODEL_PATHS if p.exists()), None)
    if path is None:
        _model_error = "camera_biomechanics_model.pkl not found"
        return None
    try:
        _model = joblib.load(path)
    except Exception as e:  # version mismatch, corrupt file ...
        _model_error = f"could not load model: {e}"
    return _model


def model_status() -> Dict[str, Any]:
    model = get_model()
    return {"loaded": model is not None, "error": _model_error}


# ---------------------------------------------------------------- helpers
def percentile_rank(values, value: float) -> float:
    """Fraction of `values` that are <= `value`."""
    values = np.asarray(values, dtype=float)
    values = values[np.isfinite(values)]
    if len(values) == 0 or not np.isfinite(value):
        return 0.5
    return float(np.searchsorted(np.sort(values), value, side="right") / len(values))


def _to_float(v) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return float("nan")
    return f if math.isfinite(f) else float("nan")


def _parse_time(t) -> Optional[float]:
    """Seconds since epoch from an ISO string or an epoch-ms / epoch-s number."""
    if t is None:
        return None
    if isinstance(t, (int, float)):
        return t / 1000.0 if t > 1e11 else float(t)
    try:
        return datetime.fromisoformat(str(t).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


# ---------------------------------------------------------------- IMU
def normalize_imu_units(readings: List[Dict[str, Any]]):
    """
    Return (readings_in_m_s2, unit). The ESP32 firmware sends acceleration in g,
    the simulator in m/s^2. At rest the gravity magnitude is ~1 in g and ~9.8
    in m/s^2; a ±2 g sensor can never exceed ~3.5 g, so a median below 4 means g.
    """
    rows = []
    for r in readings:
        rows.append({
            "acc_x": _to_float(r.get("acc_x", r.get("ax"))),
            "acc_y": _to_float(r.get("acc_y", r.get("ay"))),
            "acc_z": _to_float(r.get("acc_z", r.get("az"))),
            "gyro_x": _to_float(r.get("gyro_x", r.get("gx"))),
            "gyro_y": _to_float(r.get("gyro_y", r.get("gy"))),
            "gyro_z": _to_float(r.get("gyro_z", r.get("gz"))),
            "t": _parse_time(r.get("timestamp")),
        })
    rows = [r for r in rows if all(math.isfinite(r[k]) for k in
                                   ("acc_x", "acc_y", "acc_z", "gyro_x", "gyro_y", "gyro_z"))]
    if not rows:
        return [], None
    mags = [math.sqrt(r["acc_x"] ** 2 + r["acc_y"] ** 2 + r["acc_z"] ** 2) for r in rows]
    unit = "g" if float(np.median(mags)) < 4.0 else "m/s^2"
    if unit == "g":
        for r in rows:
            for k in ("acc_x", "acc_y", "acc_z"):
                r[k] *= G
    return rows, unit


def _sample_interval(rows: List[Dict[str, Any]]) -> Optional[float]:
    ts = [r["t"] for r in rows if r.get("t") is not None]
    if len(ts) < 2:
        return None
    diffs = np.diff(np.array(ts, dtype=float))
    diffs = diffs[diffs > 0]
    if not len(diffs):
        return None
    dt = float(np.median(diffs))
    return dt if 0.001 <= dt <= 1.0 else None


def analyze_imu(readings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Descriptive IMU statistics from the patient's own readings.
    Not calibrated: there is no IMU reference cohort to compare against.
    """
    rows, unit = normalize_imu_units(readings or [])
    if not rows:
        return {"calibrated": False, "sample_count": 0, "units_detected": None,
                "averages": None, "features": None, "irregularity_index": None,
                "irregularity_tier": None, "irregularity_reason": "No IMU readings.",
                "movement_detected": False}

    measured_dt = _sample_interval(rows)
    dt = measured_dt or DEFAULT_DT
    arr = {k: np.array([r[k] for r in rows]) for k in ("acc_x", "acc_y", "acc_z", "gyro_x", "gyro_y", "gyro_z")}
    acc_mag = np.sqrt(arr["acc_x"] ** 2 + arr["acc_y"] ** 2 + arr["acc_z"] ** 2)
    gyro_mag = np.sqrt(arr["gyro_x"] ** 2 + arr["gyro_y"] ** 2 + arr["gyro_z"] ** 2)

    jerk = float(np.sqrt(np.mean((np.diff(acc_mag) / dt) ** 2))) if len(acc_mag) > 1 else None

    periodicity = None
    if len(acc_mag) >= 50:
        centred = acc_mag - acc_mag.mean()
        # unbiased autocorrelation, so long lags are not penalised for overlap
        ac = np.correlate(centred, centred, mode="full")[len(centred) - 1:]
        ac = ac / (len(centred) - np.arange(len(ac)))
        if ac[0] > 0:
            # strongest repetition between 0.3 s and 2 s (step and stride periods)
            lo, hi = max(1, int(0.3 / dt)), min(len(ac) - len(ac) // 4, int(2.0 / dt))
            if hi > lo:
                periodicity = float(np.clip(ac[lo:hi].max() / ac[0], 0.0, 1.0))

    # Unit-free roughness: sample-to-sample change relative to the signal's
    # spread. ~0.2 for a smooth walking rhythm, ~1.0 for pure noise.
    acc_std = float(acc_mag.std())
    roughness = (float(np.sqrt(np.mean(np.diff(acc_mag) ** 2))) / (math.sqrt(2) * acc_std)
                 if acc_std > 1e-6 and len(acc_mag) > 1 else None)

    moving = float(gyro_mag.mean()) >= IMU_MIN_ANGULAR_VELOCITY
    index, tier, index_reason = None, None, None
    if len(rows) < IMU_MIN_SAMPLES:
        index_reason = f"Too few IMU samples ({len(rows)}); record the full 10 s test."
    elif not moving:
        index_reason = "No walking movement detected by the sensor; the patient must walk during the test."
    elif periodicity is None or roughness is None:
        index_reason = "Signal too short or flat to analyse."
    else:
        index = round(100.0 * (0.6 * (1.0 - periodicity) + 0.4 * min(1.0, roughness)), 1)
        tier = "High" if index > IMU_TIER_HIGH else "Moderate" if index > IMU_TIER_MODERATE else "Low"

    averages = {k: round(float(v.mean()), 3) for k, v in arr.items()}
    return {
        "calibrated": False,
        "sample_count": len(rows),
        "duration_s": round(len(rows) * dt, 1),
        "sample_rate_hz": round(1.0 / dt, 1),
        "sample_rate_measured": measured_dt is not None,
        "units_detected": unit,
        # Per-axis means mostly reflect how the sensor is oriented on the leg
        # (where gravity points), so they are reported, not used as risk markers.
        "averages": averages,
        "irregularity_index": index,
        "irregularity_tier": tier,
        "irregularity_reason": index_reason,
        "movement_detected": moving,
        "features": {
            "accel_rms": round(float(np.sqrt(np.mean(acc_mag ** 2))), 4),
            "accel_variance": round(float(np.var(acc_mag)), 4),
            "peak_accel": round(float(acc_mag.max()), 4),
            "gyro_rms": round(float(np.sqrt(np.mean(gyro_mag ** 2))), 4),
            "gyro_variance": round(float(np.var(gyro_mag)), 4),
            "mean_angular_velocity": round(float(gyro_mag.mean()), 4),
            "jerk_rms": round(jerk, 4) if jerk is not None else None,
            "step_periodicity": round(periodicity, 4) if periodicity is not None else None,
            "roughness": round(roughness, 4) if roughness is not None else None,
        },
    }


# ---------------------------------------------------------------- camera gait
def score_gait(camera_trials: Optional[List[Dict[str, Any]]]) -> Dict[str, Any]:
    """Score the patient's own camera gait trials against the reference cohort."""
    trials = camera_trials or []
    usable, rejected = [], 0
    for t in trials:
        row = {f: _to_float(t.get(f)) for f in FEATURES}
        if sum(math.isfinite(v) for v in row.values()) >= MIN_MEASURED_FEATURES:
            usable.append(row)
        else:
            rejected += 1

    out: Dict[str, Any] = {"trials_submitted": len(trials), "trials_analyzed": len(usable),
                           "trials_rejected": rejected}
    if not usable:
        out["available"] = False
        out["reason"] = ("No camera gait trials were recorded for this patient." if not trials else
                         f"No trial had at least {MIN_MEASURED_FEATURES} of the {len(FEATURES)} gait measurements.")
        return out

    model = get_model()
    if model is None:
        out["available"] = False
        out["reason"] = f"Gait model unavailable ({_model_error})."
        return out

    ref = get_reference()
    df = pd.DataFrame(usable, columns=FEATURES)
    imputed = int(df.isna().sum().sum())
    for f, b in ref.get("clip_bounds", {}).items():
        if f in df:
            df[f] = df[f].clip(lower=b.get("p1"), upper=b.get("p99"))

    scores = model.decision_function(df[FEATURES])
    flagged = int((model.predict(df[FEATURES]) == -1).sum())
    mean_score = float(np.mean(scores))

    # Share of reference trials that look MORE typical than this patient.
    deviation = round(100.0 * (1.0 - percentile_rank(ref["trial_scores"], mean_score)), 1)
    if deviation > 97.5:
        tier = "High"
    elif deviation > 90.0:
        tier = "Moderate"
    else:
        tier = "Low"

    dists = ref.get("feature_distributions", {})
    deviations = []
    for f in FEATURES:
        vals = df[f].dropna()
        stat = dists.get(f)
        if not len(vals) or not stat or not stat.get("std"):
            continue
        value = float(vals.mean())
        z = (value - stat["mean"]) / stat["std"]
        deviations.append({
            "feature": FEATURE_LABELS[f],
            "key": f,
            "patient_value": round(value, 2),
            "reference_mean": round(stat["mean"], 2),
            "reference_range": [round(stat.get("p5", float("nan")), 2), round(stat.get("p95", float("nan")), 2)],
            "z_score": round(z, 2),
            "direction": "above" if z > 0 else "below",
        })
    deviations.sort(key=lambda d: abs(d["z_score"]), reverse=True)

    asym = df["knee_rom_asymmetry_pct"].dropna()
    out.update({
        "available": True,
        "deviation_score": deviation,
        "tier": tier,
        "mean_model_score": round(mean_score, 5),
        "trials_flagged_atypical": flagged,
        "features_imputed": imputed,
        "feature_deviations": deviations,
        "knee_rom_symmetry": round(max(0.0, 100.0 - float(asym.mean())), 1) if len(asym) else None,
        "reference": {
            "participants": ref.get("n_reference_participants"),
            "trials": ref.get("n_total_trials"),
            "moderate_above_percentile": 90.0,
            "high_above_percentile": 97.5,
        },
    })
    return out


# ---------------------------------------------------------------- clinical context
def clinical_risk_factors(patient: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Established knee-OA risk factors present for this patient. Listed, not
    weighted: there is no outcome data to calibrate weights against.
    """
    factors = []
    age = _to_float(patient.get("age"))
    bmi = _to_float(patient.get("bmi"))
    if not math.isfinite(bmi):
        h, w = _to_float(patient.get("height_cm")), _to_float(patient.get("weight_kg"))
        if math.isfinite(h) and math.isfinite(w) and h > 0:
            bmi = w / (h / 100.0) ** 2
    pain = _to_float(patient.get("pain_score"))
    injury = str(patient.get("previous_knee_injury") or "").strip().lower()
    sex = str(patient.get("gender") or patient.get("sex") or "").strip().lower()

    if math.isfinite(age) and age >= 50:
        factors.append({"factor": "Age 50 or over", "value": f"{int(age)} years"})
    if math.isfinite(bmi) and bmi >= 30:
        factors.append({"factor": "Obesity (BMI 30 or over)", "value": f"BMI {bmi:.1f}"})
    elif math.isfinite(bmi) and bmi >= 25:
        factors.append({"factor": "Overweight (BMI 25-30)", "value": f"BMI {bmi:.1f}"})
    if injury and injury not in ("none", "no", "false", "0"):
        factors.append({"factor": "Previous knee injury", "value": str(patient.get("previous_knee_injury"))})
    if math.isfinite(pain) and pain >= 4:
        factors.append({"factor": "Knee pain (VAS 4 or more)", "value": f"{pain:g}/10"})
    if sex in ("female", "f"):
        factors.append({"factor": "Female sex (higher knee OA prevalence)", "value": "Female"})
    if patient.get("family_history_oa") is True:
        factors.append({"factor": "Family history of OA", "value": "Yes"})
    metabolic = [n for n, k in (("diabetes", "diabetes"), ("hypertension", "hypertension")) if patient.get(k) is True]
    if metabolic:
        factors.append({"factor": "Metabolic comorbidity (associated with knee OA)", "value": ", ".join(metabolic)})
    dur = _to_float(patient.get("symptom_duration_months"))
    if math.isfinite(dur) and dur >= 3:
        factors.append({"factor": "Knee symptoms for 3 months or more", "value": f"{dur:g} months"})
    return factors


def _recommendation(tier: str, score_type: Optional[str] = None) -> str:
    if score_type == "imu_irregularity_index":
        return {
            "High": "The IMU shows a very irregular walking pattern. This index is not calibrated; confirm with a "
                    "camera gait assessment and a clinical knee examination.",
            "Moderate": "The IMU shows a somewhat irregular walking pattern. This index is not calibrated; consider "
                        "a camera gait assessment.",
            "Low": "The IMU shows a regular walking pattern. This index is not calibrated and does not rule out "
                   "osteoarthritis.",
        }[tier]
    if tier == "High":
        return ("Gait is less typical than 97.5% of reference walking trials. Recommend a clinical knee "
                "examination by a doctor; imaging only if the examination indicates it.")
    if tier == "Moderate":
        return ("Gait is less typical than 90% of reference walking trials. Consider a clinical knee "
                "examination and repeat the camera gait assessment.")
    if tier == "Low":
        return ("Gait is within the typical range of the reference cohort. This does not rule out "
                "osteoarthritis; review symptoms and the clinical risk factors listed.")
    return ("No score: record a camera gait trial, or repeat the 10 s IMU test while the patient walks. "
            "The information below is for the clinician's review only.")


def _follow_up(tier: str) -> str:
    if tier == "High":
        return "Arrange a doctor's review within 2 weeks."
    if tier == "Moderate":
        return "Repeat screening in 3-6 months, sooner if symptoms worsen."
    if tier == "Low":
        return "Routine screening; re-assess if knee symptoms develop."
    return "Complete a camera gait assessment to obtain a score."


# ---------------------------------------------------------------- public API
def predict(
    readings: List[Dict[str, Any]],
    patient: Dict[str, Any],
    camera_results: Optional[List[Dict[str, Any]]] = None,
    imu_trials: Optional[List[List[Dict[str, Any]]]] = None,
) -> Dict[str, Any]:
    """
    Build a screening result from the patient's own data.

    readings       : raw IMU readings from the 10 s test (any accel unit).
    patient        : patient record (age, gender, bmi/height/weight, pain_score,
                     previous_knee_injury).
    camera_results : the patient's own camera gait trials. Reference or
                     uploaded datasets must NOT be passed here.
    imu_trials     : optional separate walking trials; the irregularity index is
                     then computed per trial (no artefacts where trials join)
                     and summarised by the median.
    """
    gait = score_gait(camera_results)
    imu = analyze_imu(readings)
    if imu_trials:
        per_trial = [analyze_imu(t) for t in imu_trials]
        imu["trials"] = [
            {"index": i + 1, "samples": t["sample_count"], "irregularity_index": t.get("irregularity_index"),
             "reason": t.get("irregularity_reason")}
            for i, t in enumerate(per_trial)
        ]
        scored = [t["irregularity_index"] for t in per_trial if t.get("irregularity_index") is not None]
        if scored:
            idx = round(float(np.median(scored)), 1)
            imu["irregularity_index"] = idx
            imu["irregularity_tier"] = ("High" if idx > IMU_TIER_HIGH else
                                        "Moderate" if idx > IMU_TIER_MODERATE else "Low")
            imu["irregularity_reason"] = None
        else:
            imu["irregularity_index"] = None
            imu["irregularity_tier"] = None
            imu["irregularity_reason"] = next((t["irregularity_reason"] for t in per_trial
                                               if t.get("irregularity_reason")), "No usable IMU trial.")
    clinical = clinical_risk_factors(patient)

    deviation = gait.get("deviation_score")
    deviations = gait.get("feature_deviations", [])
    imu_index = imu.get("irregularity_index")

    # The calibrated camera score takes precedence. Without camera trials the
    # uncalibrated IMU index is used, and is labelled as such.
    if gait.get("available"):
        tier, score_type = gait["tier"], "gait_deviation_percentile"
        basis = ("Camera gait compared with a reference walking cohort "
                 f"({gait['reference']['trials']} trials, {gait['reference']['participants']} participants).")
    elif imu_index is not None:
        tier, score_type = imu["irregularity_tier"], "imu_irregularity_index"
        basis = ("IMU gait irregularity index from the 10 s test. UNCALIBRATED: no IMU reference cohort "
                 "exists yet, so the Low/Moderate/High cut-offs are provisional.")
    else:
        tier, score_type = NOT_DETERMINED, None
        basis = " ".join(r for r in (gait.get("reason"), imu.get("irregularity_reason")) if r)

    return {
        "engine_version": ENGINE_VERSION,
        "score_type": score_type,
        "deviation_score": deviation,
        "imu_score": imu_index,
        "risk_level": tier,
        "calibrated": score_type == "gait_deviation_percentile",
        "risk_basis": basis,
        "gait": gait,
        "feature_deviations": deviations,
        "contributing_factors": [
            {"factor": d["feature"], "z_score": d["z_score"], "direction": d["direction"],
             "patient_value": d["patient_value"], "reference_mean": d["reference_mean"]}
            for d in deviations[:6]
        ],
        "movement_symmetry": gait.get("knee_rom_symmetry"),
        "imu": imu,
        "imu_averages": imu["averages"],
        "imu_features": imu["features"],
        "clinical_risk_factors": clinical,
        "data_coverage": {
            "camera_trials": gait.get("trials_analyzed", 0),
            "imu_samples": imu["sample_count"],
            "imu_duration_s": imu.get("duration_s"),
            "clinical_fields": [k for k in ("age", "gender", "bmi", "pain_score", "previous_knee_injury")
                                if patient.get(k) not in (None, "")],
        },
        "recommendation": _recommendation(tier, score_type),
        "follow_up": _follow_up(tier),
        "method": (
            "Camera: deviation score = share of reference walking trials (Isolation Forest scores) that look "
            "more typical than the patient's gait; Low <= 90, Moderate <= 97.5, High > 97.5 (calibrated). "
            "IMU (used only without camera data): irregularity index = 60% step irregularity (1 - autocorrelation "
            f"step regularity) + 40% signal roughness; Low <= {IMU_TIER_MODERATE:g}, Moderate <= {IMU_TIER_HIGH:g}, "
            "High above (UNCALIBRATED, provisional). Clinical risk factors are listed, not scored."
        ),
        "disclaimer": (
            "Research prototype. The reference cohort has no diagnosed OA patients, so this score measures "
            "how atypical the gait is, not the probability of osteoarthritis. It is not a diagnosis."
        ),
    }
