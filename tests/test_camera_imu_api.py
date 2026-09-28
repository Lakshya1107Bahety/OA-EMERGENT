"""
End-to-end API tests for the two working flows: camera gait analysis and the
10 s IMU test. Runs the FastAPI app in-process on the in-memory fallback DB
(no MongoDB needed).

Run from the repo root:  python -m pytest tests/test_camera_imu_api.py -p no:xdist
"""
import math
import os
import sys
import tempfile
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

os.environ["MONGO_URL"] = "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=200"  # force fallback DB
import resilient_db  # noqa: E402

_tmp = Path(tempfile.mkdtemp())
resilient_db.DATA_DIR = _tmp
resilient_db.DATA_FILE = _tmp / "local_db.json"

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402
import prediction_engine as pe  # noqa: E402

CAMERA_CSV = ROOT / "oa-sentinel-api-main" / "oa-sentinel-api-main" / "camera_features.csv"


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        r = c.post("/api/auth/register", json={"name": "Worker", "email": "worker@test.dev",
                                                "password": "pw123456"})
        c.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
        yield c


@pytest.fixture(scope="module")
def patient_id(client):
    r = client.post("/api/patients", json={"name": "Asha", "age": 61, "gender": "Female",
                                           "height_cm": 155, "weight_kg": 70, "pain_score": 6,
                                           "previous_knee_injury": "meniscus tear"})
    assert r.status_code == 200, r.text
    assert r.json()["pain_score"] == 6
    return r.json()["id"]


def walking_imu(n=500, unit_g=False):
    """Regular knee-worn walking pattern at 50 Hz."""
    s = 1 / pe.G if unit_g else 1.0
    out = []
    for i in range(n):
        ph = 2 * math.pi * i * 0.02 / 1.1
        out.append({"acc_x": 0.2 * s, "acc_y": 0.1 * s,
                    "acc_z": (9.8 + 3 * math.sin(2 * ph) + 1.5 * math.sin(ph)) * s,
                    "gyro_x": 150 * math.sin(ph), "gyro_y": 5.0, "gyro_z": 2.0,
                    "timestamp": f"2026-09-28T10:00:{(i * 0.02):06.3f}Z"})
    return out


# ---------------------------------------------------------------- IMU flow
def test_imu_test_gives_uncalibrated_score(client, patient_id):
    r = client.post("/api/screenings", json={"patient_id": patient_id, "readings": walking_imu(unit_g=True),
                                             "imu_averages": {"acc_x": 999}})
    assert r.status_code == 200, r.text
    res = r.json()["result"]
    assert res["score_type"] == "imu_irregularity_index"
    assert res["calibrated"] is False
    assert res["imu_score"] is not None and res["risk_level"] in {"Low", "Moderate", "High"}
    assert res["imu"]["units_detected"] == "g"
    assert abs(res["imu_averages"]["acc_z"] - 9.8) < 0.2  # recomputed server-side, not the client's 999
    assert "Previous knee injury" in [c["factor"] for c in res["clinical_risk_factors"]]


def test_imu_standing_still_is_not_scored(client, patient_id):
    still = [{**r, "acc_z": 9.8, "gyro_x": 0.5} for r in walking_imu()]
    res = client.post("/api/screenings", json={"patient_id": patient_id, "readings": still}).json()["result"]
    assert res["risk_level"] == "Not determined" and res["imu_score"] is None


# ---------------------------------------------------------------- camera flow
def test_camera_analyze_uses_local_model(client):
    health = client.get("/api/oa/health").json()
    assert health["connected"] is True and health["engine"] == "local"

    df = pd.read_csv(CAMERA_CSV)[pe.FEATURES]
    typical = df.median().round(3).to_dict()
    r = client.post("/api/oa/analyze", json={"patient": {"age": 61, "gender": "Female", "mass_kg": 70},
                                             "camera_results": [typical], "patient_id": "local-browser-id-1"})
    body = r.json()
    assert body["success"] is True, body
    res = body["result"]
    assert res["score_type"] == "gait_deviation_percentile" and res["calibrated"] is True
    assert res["risk_level"] == "Low" and res["trials_analyzed"] == 1
    assert "reference walking trials" in res["findings"]


def test_camera_trial_without_measurements_is_rejected(client):
    body = client.post("/api/oa/analyze", json={"patient": {}, "camera_results": [{"cadence_steps_min": 110}]}).json()
    assert body["success"] is False and "at least" in body["error"]


def test_listings_survive_browser_side_patient_ids(client):
    # the camera screening above was saved with a non-ObjectId patient id
    assert client.get("/api/screenings").status_code == 200
    assert client.get("/api/analytics/summary").status_code == 200
    assert client.get("/api/patients").status_code == 200


# ---------------------------------------------------------------- screening flow
def test_flow_intake_fields_and_update(client):
    body = {"name": "Kamla Devi", "age": 64, "gender": "Female", "height_cm": 152, "weight_kg": 71,
            "village": "Rampur", "block": "Sadar", "pain_score": 7, "previous_knee_injury": "fall 2020",
            "family_history_oa": True, "diabetes": True, "hypertension": False,
            "symptom_duration_months": 18, "affected_side": "right"}
    p = client.post("/api/patients", json=body).json()
    assert p["family_history_oa"] is True and p["affected_side"] == "right" and p["block"] == "Sadar"
    upd = client.put(f"/api/patients/{p['id']}", json={**body, "pain_score": 5, "affected_side": "bilateral"})
    assert upd.status_code == 200, upd.text
    assert upd.json()["pain_score"] == 5 and upd.json()["affected_side"] == "bilateral"
    assert client.put("/api/patients/not-an-id", json=body).status_code == 404


def test_flow_analyze_does_not_save_and_uses_per_trial_imu(client, patient_id):
    before = len(client.get("/api/screenings").json())
    df = pd.read_csv(CAMERA_CSV)[pe.FEATURES]
    trials = [walking_imu(250), walking_imu(250)]
    r = client.post("/api/assessments/analyze", json={
        "patient_id": patient_id, "camera_results": [df.median().round(3).to_dict()], "imu_trials": trials})
    assert r.status_code == 200, r.text
    res = r.json()["result"]
    assert res["score_type"] == "gait_deviation_percentile"          # camera takes precedence
    assert len(res["imu"]["trials"]) == 2                              # scored per trial
    assert res["imu"]["irregularity_index"] is not None
    factors = [c["factor"] for c in res["clinical_risk_factors"]]
    assert len(client.get("/api/screenings").json()) == before         # nothing saved


def test_flow_save_with_notes_and_high_risk_counts_patients(client):
    p = client.post("/api/patients", json={"name": "Test High", "age": 70, "gender": "Male", "village": "Mirzapur",
                                           "family_history_oa": True}).json()
    df = pd.read_csv(CAMERA_CSV)[pe.FEATURES]
    extreme = {f: float(df[f].quantile(0.001)) for f in pe.FEATURES}
    before = client.get("/api/analytics/summary").json()["high_risk_patients"]
    for _ in range(2):  # two High screenings for the SAME patient
        s = client.post("/api/screenings", json={"patient_id": p["id"], "camera_results": [extreme],
                                                 "source": "screening_flow", "clinician_notes": "Refer.",
                                                 "recommended_action": "refer-orthopaedics"}).json()
        assert s["result"]["risk_level"] == "High" and s["clinician_notes"] == "Refer."
    after = client.get("/api/analytics/summary").json()
    assert after["high_risk_patients"] == before + 1   # counted once per patient
    assert "Family history of OA" in [c["factor"] for c in s["result"]["clinical_risk_factors"]]
