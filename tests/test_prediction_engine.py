"""
Tests for backend/prediction_engine.py (engine 2.0).

Run from the repo root:  python -m pytest tests/test_prediction_engine.py -p no:xdist
"""
import random
import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import prediction_engine as pe  # noqa: E402

CAMERA_CSV = ROOT / "oa-sentinel-api-main" / "oa-sentinel-api-main" / "camera_features.csv"
PATIENT = {"age": 58, "bmi": 26.2, "gender": "Male"}


@pytest.fixture(scope="module")
def reference_trials():
    return pd.read_csv(CAMERA_CSV)[pe.FEATURES]


def imu_readings(n=500, dt_ms=20, unit="m/s^2", seed=1):
    rnd = random.Random(seed)
    scale = 1 / pe.G if unit == "g" else 1.0
    t0 = 1_790_000_000_000
    return [{
        "acc_x": rnd.gauss(0, 0.3) * scale, "acc_y": rnd.gauss(0, 0.3) * scale,
        "acc_z": (9.8 + rnd.gauss(0, 0.3)) * scale,
        "gyro_x": rnd.gauss(0, 5), "gyro_y": rnd.gauss(0, 5), "gyro_z": rnd.gauss(0, 5),
        "timestamp": t0 + i * dt_ms,
    } for i in range(n)]


def test_model_loads():
    assert pe.model_status() == {"loaded": True, "error": None}


def test_tiers_are_calibrated_on_reference_cohort(reference_trials):
    """By construction ~10% of reference trials are Moderate+ and ~2.5% High."""
    tiers = pd.Series([pe.score_gait([row])["tier"] for row in reference_trials.to_dict("records")])
    share = tiers.value_counts(normalize=True)
    assert 0.07 <= share.get("Moderate", 0) + share.get("High", 0) <= 0.13
    assert 0.005 <= share.get("High", 0) <= 0.04


def test_no_camera_data_gives_no_score():
    """Without the patient's own gait trials nothing is invented."""
    for patient in (PATIENT, {"age": 30, "bmi": 20}):
        r = pe.predict(imu_readings(), patient)
        assert r["deviation_score"] is None
        assert r["risk_level"] == pe.NOT_DETERMINED
        assert r["calibrated"] is False


def test_extreme_gait_scores_high(reference_trials):
    extreme = {f: reference_trials[f].quantile(0.001) for f in pe.FEATURES}
    r = pe.predict([], PATIENT, [extreme])
    assert r["risk_level"] == "High"
    assert r["deviation_score"] > 97.5


def test_typical_gait_scores_low(reference_trials):
    r = pe.predict([], PATIENT, [reference_trials.median().to_dict()])
    assert r["risk_level"] == "Low"
    assert r["contributing_factors"] and "z_score" in r["contributing_factors"][0]


def test_imu_units_are_normalised():
    a = pe.analyze_imu(imu_readings(unit="m/s^2"))
    b = pe.analyze_imu(imu_readings(unit="g"))
    assert a["units_detected"] == "m/s^2" and b["units_detected"] == "g"
    for k, v in a["features"].items():
        assert b["features"][k] == pytest.approx(v, rel=1e-3), k


def test_imu_sample_rate_is_measured():
    r = pe.analyze_imu(imu_readings(dt_ms=50))
    assert r["sample_rate_hz"] == 20.0 and r["sample_rate_measured"] is True


def test_client_averages_are_not_trusted():
    r = pe.predict(imu_readings(), PATIENT)
    assert abs(r["imu_averages"]["acc_z"] - 9.8) < 0.1


def test_clinical_factors_listed_not_scored():
    factors = [c["factor"] for c in pe.clinical_risk_factors(
        {"age": 68, "bmi": 32.4, "pain_score": 8, "previous_knee_injury": "ACL tear", "gender": "Female"})]
    assert len(factors) == 5
    assert pe.clinical_risk_factors({"age": 30, "bmi": 21, "pain_score": 1, "previous_knee_injury": "none"}) == []
    # clinical factors never change the score
    trial = {f: 1.0 for f in pe.FEATURES}
    low = pe.predict([], {"age": 30}, [trial])["deviation_score"]
    high = pe.predict([], {"age": 80, "bmi": 40, "pain_score": 10}, [trial])["deviation_score"]
    assert low == high


def test_sparse_trials_are_rejected():
    g = pe.score_gait([{"cadence_steps_min": 100}])
    assert g["available"] is False and g["trials_rejected"] == 1


def test_no_overclaiming_fields():
    r = pe.predict(imu_readings(), PATIENT)
    for k in ("oa_probability", "confidence", "knee_stability_score", "balance_score"):
        assert k not in r
