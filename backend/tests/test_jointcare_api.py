"""
JointCare AI - Backend API tests.
Covers auth, patients, screenings (prediction), doctor review, analytics,
dataset upload/role gating, AI summary, and WebSocket sensor streaming.
"""
import os
import io
import json
import time
import uuid
import asyncio
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Read from frontend/.env fallback
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "lakshyabahety15@gmail.com"
ADMIN_PASSWORD = "JointCare@2026"

UNIQ = uuid.uuid4().hex[:6]
WORKER_EMAIL = f"worker_{UNIQ}@jointcare.ai"
DOCTOR_EMAIL = f"doctor_{UNIQ}@jointcare.ai"
WORKER_PW = "Worker@2026"
DOCTOR_PW = "Doctor@2026"

state = {}


# ------------------------------------------------------------- helpers
def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ------------------------------------------------------------- auth
def test_admin_login():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"
    state["admin_token"] = data["access_token"]


def test_signup_worker():
    r = requests.post(f"{API}/auth/register", json={
        "name": "Test Worker", "email": WORKER_EMAIL, "password": WORKER_PW, "role": "healthcare_worker"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "healthcare_worker"
    state["worker_token"] = data["access_token"]


def test_signup_doctor():
    r = requests.post(f"{API}/auth/register", json={
        "name": "Test Doctor", "email": DOCTOR_EMAIL, "password": DOCTOR_PW, "role": "doctor"
    })
    assert r.status_code == 200, r.text
    state["doctor_token"] = r.json()["access_token"]


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_auth_me():
    r = requests.get(f"{API}/auth/me", headers=_hdr(state["worker_token"]))
    assert r.status_code == 200
    assert r.json()["email"] == WORKER_EMAIL


def test_auth_me_unauth():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


# ------------------------------------------------------------- patients
def test_create_patient_bmi_auto():
    body = {
        "name": f"TEST_Patient_{UNIQ}", "age": 62, "gender": "female",
        "height_cm": 160, "weight_kg": 70, "occupation": "farmer",
        "village": "Kohima", "district": "Kohima", "phone": "9999900000",
        "medical_history": "knee pain"
    }
    r = requests.post(f"{API}/patients", json=body, headers=_hdr(state["worker_token"]))
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["name"] == body["name"]
    assert p["bmi"] == round(70 / (1.6 * 1.6), 1)
    assert "id" in p
    state["patient_id"] = p["id"]


def test_list_patients_and_search():
    r = requests.get(f"{API}/patients", headers=_hdr(state["worker_token"]))
    assert r.status_code == 200
    lst = r.json()
    assert any(p["id"] == state["patient_id"] for p in lst)
    r = requests.get(f"{API}/patients?search=Kohima", headers=_hdr(state["worker_token"]))
    assert r.status_code == 200
    assert any(p["id"] == state["patient_id"] for p in r.json())


def test_get_patient_detail():
    r = requests.get(f"{API}/patients/{state['patient_id']}", headers=_hdr(state["worker_token"]))
    assert r.status_code == 200
    assert r.json()["patient"]["id"] == state["patient_id"]


# ------------------------------------------------------------- screening / prediction
def _fake_readings(n=10):
    import math, random
    out = []
    for i in range(n):
        out.append({
            "acc_x": random.uniform(-1, 1),
            "acc_y": random.uniform(-1, 1),
            "acc_z": 9.8 + random.uniform(-0.5, 0.5),
            "gyro_x": random.uniform(-30, 30),
            "gyro_y": random.uniform(-30, 30),
            "gyro_z": random.uniform(-30, 30),
            "timestamp": None,
        })
    return out


def test_create_screening_and_prediction():
    body = {"patient_id": state["patient_id"], "readings": _fake_readings(12)}
    r = requests.post(f"{API}/screenings", json=body, headers=_hdr(state["worker_token"]))
    assert r.status_code == 200, r.text
    s = r.json()
    res = s["result"]
    for k in ("oa_probability", "risk_level", "confidence",
              "knee_stability_score", "movement_symmetry", "balance_score",
              "contributing_factors"):
        assert k in res, f"Missing {k} in result"
    assert 0 <= res["oa_probability"] <= 100
    assert res["risk_level"] in {"Low", "Moderate", "High", "Severe"}
    state["screening_id"] = s["id"]


def test_screening_empty_readings():
    r = requests.post(f"{API}/screenings", json={"patient_id": state["patient_id"], "readings": []},
                      headers=_hdr(state["worker_token"]))
    assert r.status_code == 400


def test_get_screening():
    r = requests.get(f"{API}/screenings/{state['screening_id']}", headers=_hdr(state["worker_token"]))
    assert r.status_code == 200
    j = r.json()
    assert j["id"] == state["screening_id"]
    assert j["patient"]["id"] == state["patient_id"]


def test_list_screenings_pending():
    r = requests.get(f"{API}/screenings?review_status=pending", headers=_hdr(state["doctor_token"]))
    assert r.status_code == 200
    assert any(s["id"] == state["screening_id"] for s in r.json())


# ------------------------------------------------------------- role gating
def test_doctor_review_denied_for_worker():
    r = requests.post(f"{API}/screenings/{state['screening_id']}/review",
                      json={"notes": "x", "status": "reviewed"},
                      headers=_hdr(state["worker_token"]))
    assert r.status_code == 403


def test_doctor_review_success():
    r = requests.post(f"{API}/screenings/{state['screening_id']}/review",
                      json={"notes": "Follow up in 3 months", "confirmed_risk_level": "Moderate",
                            "follow_up_date": "2026-04-01", "status": "reviewed"},
                      headers=_hdr(state["doctor_token"]))
    assert r.status_code == 200
    s = r.json()
    assert s["review_status"] == "reviewed"
    assert s["confirmed_risk_level"] == "Moderate"

    # Verify not in pending list
    r2 = requests.get(f"{API}/screenings?review_status=pending", headers=_hdr(state["doctor_token"]))
    assert not any(s["id"] == state["screening_id"] for s in r2.json())


# ------------------------------------------------------------- dataset upload
def test_dataset_upload_worker_denied():
    csv_bytes = b"age,bmi,knee_pain\n60,28,1\n"
    r = requests.post(f"{API}/dataset/upload",
                      files={"file": ("d.csv", csv_bytes, "text/csv")},
                      headers={"Authorization": f"Bearer {state['worker_token']}"})
    assert r.status_code == 403


def test_dataset_upload_admin_ok():
    csv_bytes = b"age,bmi,knee_pain\n60,28.5,1\n45,24.0,0\n72,30.2,1\n"
    r = requests.post(f"{API}/dataset/upload",
                      files={"file": ("d.csv", csv_bytes, "text/csv")},
                      headers={"Authorization": f"Bearer {state['admin_token']}"})
    assert r.status_code == 200, r.text
    assert r.json()["row_count"] == 3

    r2 = requests.get(f"{API}/dataset/info", headers=_hdr(state["admin_token"]))
    assert r2.status_code == 200
    assert r2.json()["loaded"] is True


# ------------------------------------------------------------- analytics
def test_analytics_summary():
    r = requests.get(f"{API}/analytics/summary", headers=_hdr(state["admin_token"]))
    assert r.status_code == 200, r.text
    a = r.json()
    for k in ("total_patients", "total_screenings", "high_risk_patients",
              "age_distribution", "village_cases", "risk_distribution",
              "monthly_screenings"):
        assert k in a
    assert a["total_patients"] >= 1
    assert a["total_screenings"] >= 1


# ------------------------------------------------------------- AI summary
def test_ai_summary():
    r = requests.post(f"{API}/screenings/{state['screening_id']}/ai-summary",
                      headers=_hdr(state["worker_token"]), timeout=60)
    assert r.status_code == 200, r.text
    s = r.json().get("ai_summary", "")
    assert isinstance(s, str) and len(s) > 20


# ------------------------------------------------------------- WebSocket
def test_websocket_sensor_stream():
    try:
        import websocket  # websocket-client
    except ImportError:
        pytest.skip("websocket-client not installed")

    ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + f"/api/ws/sensor/test-{UNIQ}"
    ws = websocket.create_connection(ws_url, timeout=15)
    hello = json.loads(ws.recv())
    assert hello.get("type") == "status" and hello.get("connected") is True

    payload = {"acc_x": 0.1, "acc_y": 0.2, "acc_z": 9.7,
               "gyro_x": 1.0, "gyro_y": 2.0, "gyro_z": 3.0}
    ws.send(json.dumps(payload))
    echo = json.loads(ws.recv())
    assert echo.get("type") == "reading"
    assert abs(echo["acc_z"] - 9.7) < 1e-6
    ws.close()
