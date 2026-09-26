"""
OA Sentinel - Retrain ML Model & Calibrate Normative Reference Cohort
Trained on 51-participant clinical biomechanics dataset (info_participants.xlsx & camera_features.csv)
"""
from pathlib import Path
from datetime import datetime
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline

BASE_DIR = Path(__file__).parent
INFO_FILE = BASE_DIR / "info_participants.xlsx"
FEATURES_FILE = BASE_DIR / "camera_features.csv"
MODEL_PKL = BASE_DIR / "camera_biomechanics_model.pkl"
RESULTS_FILE = BASE_DIR / "camera_results.csv"
REFERENCE_JSON = BASE_DIR / "oa_healthy_reference.json"
CLIENT_MODEL_JSON = BASE_DIR / "oa_normative_model.json"

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
    "trunk_lean_deg"
]

def percentile_rank(values, value):
    values = np.asarray(values, dtype=float)
    values = values[np.isfinite(values)]
    if len(values) == 0 or not np.isfinite(value):
        return 0.5
    return float(np.searchsorted(np.sort(values), value, side="right") / len(values))

def train_and_calibrate():
    print(f"Loading feature dataset from {FEATURES_FILE}...")
    df_trials = pd.read_csv(FEATURES_FILE)
    print(f"Loaded {len(df_trials)} trials across {df_trials['participant_id'].nunique()} participants.")

    print(f"Loading participant info from {INFO_FILE}...")
    df_participants = pd.read_excel(INFO_FILE)
    print(f"Loaded {len(df_participants)} participant records.")

    # 1. Train Biomechanical Isolation Forest Model
    X = df_trials[FEATURES]
    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("model", IsolationForest(n_estimators=250, contamination="auto", random_state=42))
    ])
    
    print("Fitting model...")
    pipeline.fit(X)
    
    # 2. Predict on all trials
    preds = pipeline.predict(X)
    scores = pipeline.decision_function(X)
    
    df_trials["biomechanical_prediction"] = preds
    df_trials["biomechanical_score"] = scores
    
    # Save camera_results.csv
    df_trials.to_csv(RESULTS_FILE, index=False)
    print(f"Saved predictions to {RESULTS_FILE}")
    
    # Save model pkl
    joblib.dump(pipeline, MODEL_PKL)
    print(f"Saved model pipeline to {MODEL_PKL}")
    
    # 3. Compute Per-Participant Biomechanical Metrics
    patient_stats = (
        df_trials.groupby("participant_id")
        .agg(
            mean_biomechanical_score=("biomechanical_score", "mean"),
            abnormal_trial_rate=("biomechanical_prediction", lambda x: float(np.mean(np.asarray(x) == -1))),
            trials=("biomechanical_score", "count"),
            **{f"mean_{f}": (f, "mean") for f in FEATURES}
        )
        .reset_index()
    )

    score_vals = patient_stats["mean_biomechanical_score"].to_numpy(dtype=float)
    abnormal_vals = patient_stats["abnormal_trial_rate"].to_numpy(dtype=float)

    patient_stats["score_risk_percentile"] = [
        100.0 * (1.0 - percentile_rank(score_vals, x)) for x in score_vals
    ]
    patient_stats["abnormal_rate_percentile"] = [
        100.0 * percentile_rank(abnormal_vals, x) for x in abnormal_vals
    ]
    patient_stats["screening_score"] = (
        0.70 * patient_stats["score_risk_percentile"] + 0.30 * patient_stats["abnormal_rate_percentile"]
    )

    screening_scores = patient_stats["screening_score"].to_numpy(dtype=float)
    p90 = float(np.percentile(screening_scores, 90))
    p97_5 = float(np.percentile(screening_scores, 97.5))

    print(f"Calibration complete: Threshold p90 = {p90:.2f}, Threshold p97.5 = {p97_5:.2f}")

    # 4. Compute Cohort Normative Distributions for Explainable AI & Feature Contributions
    feature_distributions = {}
    for f in FEATURES:
        vals = df_trials[f].dropna().to_numpy(dtype=float)
        feature_distributions[f] = {
            "mean": float(np.mean(vals)),
            "std": float(np.std(vals)),
            "p5": float(np.percentile(vals, 5)),
            "p25": float(np.percentile(vals, 25)),
            "median": float(np.median(vals)),
            "p75": float(np.percentile(vals, 75)),
            "p95": float(np.percentile(vals, 95)),
            "min": float(np.min(vals)),
            "max": float(np.max(vals))
        }

    # Extract scaler parameters for client-side evaluation
    scaler = pipeline.named_steps["scaler"]
    imputer = pipeline.named_steps["imputer"]
    scaler_means = {f: float(m) for f, m in zip(FEATURES, scaler.mean_)}
    scaler_scales = {f: float(s) for f, s in zip(FEATURES, scaler.scale_)}
    imputer_medians = {f: float(m) for f, m in zip(FEATURES, imputer.statistics_)}

    # Build reference document
    reference = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "source": str(RESULTS_FILE),
        "n_reference_participants": int(len(patient_stats)),
        "n_total_trials": int(len(df_trials)),
        "total_participants_enrolled": int(len(df_participants)),
        "method": {
            "mean_biomechanical_score_weight": 0.70,
            "abnormal_trial_rate_weight": 0.30,
            "low_upper_percentile": 90.0,
            "moderate_upper_percentile": 97.5
        },
        "thresholds": {
            "p90": p90,
            "p97_5": p97_5
        },
        "features": FEATURES,
        "feature_distributions": feature_distributions,
        "scaler": {
            "means": scaler_means,
            "scales": scaler_scales,
            "medians": imputer_medians
        },
        "score_distribution": {
            "min": float(np.min(score_vals)),
            "max": float(np.max(score_vals)),
            "mean": float(np.mean(score_vals)),
            "std": float(np.std(score_vals))
        },
        "reference_participants": patient_stats[
            ["participant_id", "mean_biomechanical_score", "abnormal_trial_rate", "screening_score", "trials"]
        ].to_dict(orient="records")
    }

    # Save to JSON
    with open(REFERENCE_JSON, "w", encoding="utf-8") as f:
        json.dump(reference, f, indent=2)
    print(f"Saved reference to {REFERENCE_JSON}")

    with open(CLIENT_MODEL_JSON, "w", encoding="utf-8") as f:
        json.dump(reference, f, indent=2)
    print(f"Saved client model JSON to {CLIENT_MODEL_JSON}")

    # Copy to backend and frontend public/src folders so they are always in sync
    import shutil
    backend_ref = BASE_DIR.parent.parent / "backend" / "oa_healthy_reference.json"
    frontend_ref = BASE_DIR.parent.parent / "frontend" / "src" / "constants" / "oa_healthy_reference.json"
    frontend_pub = BASE_DIR.parent.parent / "frontend" / "public" / "oa_healthy_reference.json"
    
    frontend_ref.parent.mkdir(parents=True, exist_ok=True)
    frontend_pub.parent.mkdir(parents=True, exist_ok=True)
    backend_ref.parent.mkdir(parents=True, exist_ok=True)

    shutil.copyfile(REFERENCE_JSON, backend_ref)
    shutil.copyfile(REFERENCE_JSON, frontend_ref)
    shutil.copyfile(REFERENCE_JSON, frontend_pub)
    print("Copied reference JSON to backend and frontend constants!")

if __name__ == "__main__":
    train_and_calibrate()
