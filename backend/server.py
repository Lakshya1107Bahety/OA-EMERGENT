from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging
import jwt
import bcrypt
import secrets
import io
import csv
import json
import httpx
import math

import prediction_engine

# ---------------------------------------------------------------- DB / app
from resilient_db import init_database

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'jointcare_ai')
client, db, is_fallback = init_database(mongo_url, db_name)

app = FastAPI(title="JointCare AI")
api = APIRouter(prefix="/api")

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "JointCare OA Sentinel Backend",
        "dataset_loaded": len(_DATASET_ROWS) > 0,
        "dataset_trials": len(_DATASET_ROWS),
        "docs_url": "/docs",
        "api_prefix": "/api"
    }

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jointcare")

JWT_SECRET = os.environ.get("JWT_SECRET", "jointcare_secret_jwt_key_2026_super_secure")
JWT_ALGO = "HS256"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
OA_API_URL = os.environ.get("OA_API_URL", "http://127.0.0.1:5000").rstrip("/")

ROLES = {"healthcare_worker", "doctor", "admin"}


# ---------------------------------------------------------------- helpers
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    return doc


async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return clean(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(request: Request) -> Optional[dict]:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        return clean(user) if user else None
    except Exception:
        return None


def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker



# ---------------------------------------------------------------- models
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "healthcare_worker"


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class PatientInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    age: int
    gender: str
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    bmi: Optional[float] = None
    occupation: Optional[str] = None
    village: Optional[str] = None
    district: Optional[str] = None
    phone: Optional[str] = None
    medical_history: Optional[str] = None
    pain_score: Optional[float] = Field(default=None, ge=0, le=10)  # VAS 0-10
    previous_knee_injury: Optional[str] = None


class SensorReading(BaseModel):
    acc_x: float = 0
    acc_y: float = 0
    acc_z: float = 0
    gyro_x: float = 0
    gyro_y: float = 0
    gyro_z: float = 0
    timestamp: Optional[str] = None


class IMUSessionInput(BaseModel):
    patient_id: str
    session_id: str
    timestamp: Optional[str] = None
    duration_sec: float = 10.0
    acc_x_avg: float = 0.0
    acc_y_avg: float = 0.0
    acc_z_avg: float = 0.0
    gyro_x_avg: float = 0.0
    gyro_y_avg: float = 0.0
    gyro_z_avg: float = 0.0
    raw_stream: List[Dict[str, Any]] = []
    is_simulated: bool = False


class ScreeningInput(BaseModel):
    patient_id: str
    readings: List[SensorReading] = []
    camera_results: Optional[List[Dict[str, Any]]] = None  # this patient's own gait trials
    imu_averages: Optional[Dict[str, float]] = None  # ignored: recomputed from readings
    session_id: Optional[str] = None
    is_simulated: Optional[bool] = False


class DoctorReviewInput(BaseModel):
    notes: str
    confirmed_risk_level: Optional[str] = None
    follow_up_date: Optional[str] = None
    status: str = "reviewed"


class MovementTest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    test_type: str
    metrics: Dict[str, Any] = {}
    quality_score: float = 0
    duration: Optional[float] = None


class MovementAssessmentInput(BaseModel):
    patient_id: str
    tests: List[MovementTest]


# ---------------------------------------------------------------- auth routes
@api.post("/auth/register")
async def register(body: RegisterInput):
    role = body.role if body.role in ROLES else "healthcare_worker"
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "name": body.name, "email": email, "password_hash": hash_password(body.password),
        "role": role, "created_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    token = create_token(uid, email, role)
    return {"access_token": token, "user": {"id": uid, "name": body.name, "email": email, "role": role}}


@api.post("/auth/login")
async def login(body: LoginInput):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(str(user["_id"]), email, user["role"])
    return {"access_token": token, "user": clean(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------- patients
@api.post("/patients")
async def create_patient(body: PatientInput, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    if doc.get("bmi") is None and doc.get("height_cm") and doc.get("weight_kg"):
        h = doc["height_cm"] / 100.0
        if h > 0:
            doc["bmi"] = round(doc["weight_kg"] / (h * h), 1)
    doc["created_by"] = user["id"]
    doc["created_at"] = now_iso()
    res = await db.patients.insert_one(doc)
    saved = await db.patients.find_one({"_id": res.inserted_id})
    return clean(saved)


@api.get("/patients")
async def list_patients(search: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if search:
        q = {"$or": [
            {"name": {"$regex": search, "$options": "i"}},
            {"village": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]}
    patients = await db.patients.find(q).sort("created_at", -1).to_list(1000)
    out = []
    for p in patients:
        pid = str(p["_id"])
        last = await db.screenings.find_one({"patient_id": pid}, sort=[("created_at", -1)])
        p = clean(p)
        p["latest_risk"] = last.get("result", {}).get("risk_level") if last else None
        p["latest_deviation_score"] = last.get("result", {}).get("deviation_score") if last else None
        p["screening_count"] = await db.screenings.count_documents({"patient_id": pid})
        out.append(p)
    return out


@api.get("/patients/{patient_id}")
async def get_patient(patient_id: str, user: dict = Depends(get_current_user)):
    p = await db.patients.find_one({"_id": ObjectId(patient_id)})
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    screenings = await db.screenings.find({"patient_id": patient_id}).sort("created_at", -1).to_list(1000)
    movements = await db.movement_assessments.find({"patient_id": patient_id}).sort("created_at", -1).to_list(1000)
    return {
        "patient": clean(p),
        "screenings": [clean(s) for s in screenings],
        "movement_assessments": [clean(m) for m in movements],
    }


# ---------------------------------------------------------------- movement assessment
def _movement_risk(overall: float) -> str:
    if overall >= 75:
        return "Low"
    if overall >= 55:
        return "Moderate"
    if overall >= 35:
        return "High"
    return "Severe"


@api.post("/movement-assessments")
async def create_movement_assessment(body: MovementAssessmentInput, user: dict = Depends(get_current_user)):
    patient = await db.patients.find_one({"_id": ObjectId(body.patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not body.tests:
        raise HTTPException(status_code=400, detail="No movement tests submitted")
    tests = [t.model_dump() for t in body.tests]
    scores = [t["quality_score"] for t in tests if t.get("quality_score") is not None]
    overall = round(sum(scores) / len(scores), 1) if scores else 0.0
    risk = "Insufficient Data" if overall <= 0 else _movement_risk(overall)
    doc = {
        "patient_id": body.patient_id,
        "tests": tests,
        "overall_score": overall,
        "movement_risk_level": risk,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    res = await db.movement_assessments.insert_one(doc)
    saved = await db.movement_assessments.find_one({"_id": res.inserted_id})
    return clean(saved)


@api.get("/movement-assessments")
async def list_movement_assessments(patient_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"patient_id": patient_id} if patient_id else {}
    items = await db.movement_assessments.find(q).sort("created_at", -1).to_list(1000)
    return [clean(i) for i in items]


# ---------------------------------------------------------------- dataset
# Auto-load the bundled 3003-trial clinical dataset with demographics at startup
_BUNDLED_CSV = ROOT_DIR / "camera_features_demographics.csv"
if not _BUNDLED_CSV.exists():
    _BUNDLED_CSV = ROOT_DIR / "camera_features.csv"
if not _BUNDLED_CSV.exists():
    _BUNDLED_CSV = ROOT_DIR.parent / "oa-sentinel-api-main" / "oa-sentinel-api-main" / "camera_features.csv"

_DATASET_ROWS: List[Dict[str, Any]] = []
_AGE_STD: float = 12.0
_BMI_STD: float = 4.5

def _load_bundled_dataset():
    global _DATASET_ROWS, _AGE_STD, _BMI_STD
    if _BUNDLED_CSV.exists():
        try:
            with open(_BUNDLED_CSV, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                _DATASET_ROWS = []
                for r in reader:
                    parsed = {}
                    for k, v in r.items():
                        try:
                            parsed[k] = float(v)
                        except (ValueError, TypeError):
                            parsed[k] = v
                    _DATASET_ROWS.append(parsed)
            logger.info(f"Loaded bundled dataset: {len(_DATASET_ROWS)} trials from {_BUNDLED_CSV.name}")

            ages = [r["Age"] for r in _DATASET_ROWS if isinstance(r.get("Age"), (int, float))]
            bmis = [r["BMI"] for r in _DATASET_ROWS if isinstance(r.get("BMI"), (int, float))]
            if ages and len(ages) > 1:
                m_age = sum(ages) / len(ages)
                _AGE_STD = max(1.0, math.sqrt(sum((x - m_age) ** 2 for x in ages) / (len(ages) - 1)))
            if bmis and len(bmis) > 1:
                m_bmi = sum(bmis) / len(bmis)
                _BMI_STD = max(1.0, math.sqrt(sum((x - m_bmi) ** 2 for x in bmis) / (len(bmis) - 1)))
        except Exception as e:
            logger.warning(f"Could not load bundled dataset: {e}")

_load_bundled_dataset()

# Numeric biomechanical feature keys used for nearest-neighbor matching
_BIOM_FEATURES = [
    "right_knee_rom_deg", "left_knee_rom_deg",
    "right_hip_rom_deg", "left_hip_rom_deg",
    "cadence_steps_min", "knee_rom_asymmetry_pct",
    "step_time_asymmetry_pct", "trunk_lean_deg",
    "step_duration_sec", "stride_duration_sec",
]

def _find_closest_trial(age: float, bmi: float, gender: Optional[str] = None, partial_metrics: dict = None) -> dict:
    """
    Find the closest real trial from the 3003-trial dataset using
    weighted nearest-neighbor distance on patient age, BMI, gender, and any observed movement features.
    Returns a dict with real biomechanical metric values strictly from the clinical dataset.
    """
    rows = _DATASET_ROWS
    if not rows:
        return {}

    g_char = gender.strip().upper()[0] if gender else None
    age_std = _AGE_STD
    bmi_std = _BMI_STD

    best_row = None
    best_dist = float("inf")

    for row in rows:
        r_age = float(row.get("Age", 50.0))
        r_bmi = float(row.get("BMI", 25.0))
        r_gender = str(row.get("Gender", "")).strip().upper()

        # 1. Demographic distance (Age + BMI + Gender penalty)
        d_age = ((r_age - age) / age_std) ** 2
        d_bmi = ((r_bmi - bmi) / bmi_std) ** 2
        d_gender = 2.5 if (g_char and r_gender and r_gender[0] != g_char) else 0.0

        dist = d_age * 1.5 + d_bmi * 1.5 + d_gender

        # 2. Biomechanical distance from test analysis (if partial movement metrics were captured)
        if partial_metrics:
            for f in _BIOM_FEATURES:
                if f in partial_metrics and partial_metrics[f] is not None:
                    p_val = float(partial_metrics[f])
                    # Ignore known fallback / default constants (e.g. 55.0, 12.0)
                    if p_val not in (55.0, 12.0) and f in row and isinstance(row[f], (int, float)):
                        feat_scale = 20.0 if "rom" in f else (30.0 if "cadence" in f else 5.0)
                        dist += 1.5 * (((float(row[f]) - p_val) / feat_scale) ** 2)

        if dist < best_dist:
            best_dist = dist
            best_row = row

    if not best_row:
        return {}

    step_dur = round(float(best_row.get("step_duration_sec", 0.52)), 3)
    duration_s = round(float(best_row.get("duration_sec", 4.5)), 2)

    return {
        "right_knee_rom_deg":     round(float(best_row.get("right_knee_rom_deg", 55.0)), 1),
        "left_knee_rom_deg":      round(float(best_row.get("left_knee_rom_deg", 55.0)), 1),
        "right_hip_rom_deg":      round(float(best_row.get("right_hip_rom_deg", 38.0)), 1),
        "left_hip_rom_deg":       round(float(best_row.get("left_hip_rom_deg", 38.0)), 1),
        "step_duration_sec":      step_dur,
        "stride_duration_sec":    round(float(best_row.get("stride_duration_sec", 1.04)), 3),
        "cadence_steps_min":      round(float(best_row.get("cadence_steps_min", 115.0)), 1),
        "knee_rom_asymmetry_pct": round(float(best_row.get("knee_rom_asymmetry_pct", 8.0)), 1),
        "step_time_asymmetry_pct":round(float(best_row.get("step_time_asymmetry_pct", 12.0)), 1),
        "trunk_lean_deg":         round(float(best_row.get("trunk_lean_deg", 3.2)), 2),
        "walking_velocity":       round(float(5.0 / max(0.1, duration_s)), 2),
        "stance_time":            round(step_dur * 0.62, 2),
        "swing_time":             round(step_dur * 0.38, 2),
        "frames_captured":        int(best_row.get("n_frames", 120)),
        "duration_sec":           duration_s,
        "_matched_participant":   int(best_row.get("participant_id", 0)),
        "_matched_trial":         str(best_row.get("trial", "")),
        "_matched_age":           float(best_row.get("Age", age)),
        "_matched_bmi":           float(best_row.get("BMI", bmi)),
        "_matched_gender":        str(best_row.get("Gender", "")),
        "_match_distance":        round(best_dist, 4),
        "_dataset_size":          len(rows),
    }


class DatasetMatchInput(BaseModel):
    age: float = 50.0
    bmi: float = 25.0
    gender: Optional[str] = None
    sex: Optional[str] = None
    partial_metrics: Optional[Dict[str, float]] = None


@api.post("/dataset/match")
async def dataset_match(body: DatasetMatchInput, user: Optional[dict] = Depends(get_optional_user)):
    """
    Given patient age + BMI (and optionally partial real camera metrics),
    return the closest real biomechanical trial strictly from the 3003-trial dataset.
    """
    gender = body.gender or body.sex
    matched = _find_closest_trial(body.age, body.bmi, gender, body.partial_metrics)
    if not matched:
        raise HTTPException(status_code=503, detail="Dataset not loaded. Upload camera_features.csv first.")
    return {
        "matched": True,
        "dataset_size": matched.pop("_dataset_size", len(_DATASET_ROWS)),
        "matched_participant": matched.get("_matched_participant"),
        "matched_trial": matched.get("_matched_trial"),
        "matched_age": matched.get("_matched_age"),
        "matched_bmi": matched.get("_matched_bmi"),
        "matched_gender": matched.get("_matched_gender"),
        "match_distance": matched.get("_match_distance"),
        "biomechanical_metrics": matched,
    }


@api.get("/dataset/match")
async def dataset_match_info(age: float = 50.0, bmi: float = 25.0, gender: Optional[str] = None):
    """
    GET helper: test closest match directly from browser URL query params
    e.g. /api/dataset/match?age=48&bmi=24.5&gender=Female
    """
    matched = _find_closest_trial(age, bmi, gender)
    if not matched:
        raise HTTPException(status_code=503, detail="Dataset not loaded.")
    return {
        "info": "This endpoint accepts POST JSON with {age, bmi, gender, partial_metrics}. Showing sample match below:",
        "matched": True,
        "dataset_size": len(_DATASET_ROWS),
        "matched_participant": matched.get("_matched_participant"),
        "matched_trial": matched.get("_matched_trial"),
        "matched_age": matched.get("_matched_age"),
        "matched_bmi": matched.get("_matched_bmi"),
        "matched_gender": matched.get("_matched_gender"),
        "biomechanical_metrics": matched,
    }



@api.post("/dataset/upload", dependencies=[Depends(require_roles("admin", "doctor"))])
async def upload_dataset(file: UploadFile = File(...)):
    global _DATASET_ROWS
    content = await file.read()
    rows: List[Dict[str, Any]] = []
    try:
        if file.filename.endswith(".json"):
            rows = json.loads(content.decode())
        else:
            reader = csv.DictReader(io.StringIO(content.decode()))
            for r in reader:
                rows.append({k: (float(v) if v.replace('.', '', 1).replace('-', '', 1).isdigit() else v)
                             for k, v in r.items()})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse dataset: {e}")
    _DATASET_ROWS = rows  # update in-memory cache
    await db.datasets.delete_many({})
    await db.datasets.insert_one({"filename": file.filename, "rows": rows,
                                  "uploaded_at": now_iso(), "row_count": len(rows)})
    return {"filename": file.filename, "row_count": len(rows)}


@api.get("/dataset/info")
async def dataset_info(user: dict = Depends(get_current_user)):
    return {
        "loaded": len(_DATASET_ROWS) > 0,
        "row_count": len(_DATASET_ROWS),
        "source": "bundled_csv" if _BUNDLED_CSV.exists() else "uploaded",
    }



# ---------------------------------------------------------------- IMU 10-second sessions
@api.post("/imu-sessions")
async def create_imu_session(body: IMUSessionInput, user: dict = Depends(get_current_user)):
    patient = await db.patients.find_one({"_id": ObjectId(body.patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    doc = {
        "patient_id": body.patient_id,
        "session_id": body.session_id,
        "timestamp": body.timestamp or now_iso(),
        "duration_sec": body.duration_sec,
        "acc_x_avg": body.acc_x_avg,
        "acc_y_avg": body.acc_y_avg,
        "acc_z_avg": body.acc_z_avg,
        "gyro_x_avg": body.gyro_x_avg,
        "gyro_y_avg": body.gyro_y_avg,
        "gyro_z_avg": body.gyro_z_avg,
        "raw_stream": body.raw_stream,
        "is_simulated": body.is_simulated,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    res = await db.imu_sessions.insert_one(doc)
    saved = await db.imu_sessions.find_one({"_id": res.inserted_id})
    return clean(saved)


@api.get("/imu-sessions")
async def list_imu_sessions(patient_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"patient_id": patient_id} if patient_id else {}
    items = await db.imu_sessions.find(q).sort("created_at", -1).to_list(100)
    return [clean(i) for i in items]


@api.get("/imu-sessions/{session_id}")
async def get_imu_session(session_id: str, user: dict = Depends(get_current_user)):
    s = await db.imu_sessions.find_one({"session_id": session_id})
    if not s:
        try:
            s = await db.imu_sessions.find_one({"_id": ObjectId(session_id)})
        except Exception:
            pass
    if not s:
        raise HTTPException(status_code=404, detail="IMU session not found")
    return clean(s)


# ---------------------------------------------------------------- screening / prediction
@api.post("/screenings")
async def create_screening(body: ScreeningInput, user: dict = Depends(get_current_user)):
    patient = await db.patients.find_one({"_id": ObjectId(body.patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    readings = [r.model_dump() for r in body.readings]
    if not readings and not body.camera_results:
        raise HTTPException(status_code=400, detail="No sensor readings or camera gait trials provided")

    # Only this patient's own data is scored. Reference/uploaded datasets are
    # never passed in as if they were the patient's camera trials.
    result = prediction_engine.predict(readings, clean(patient), body.camera_results)

    latest_movement = await db.movement_assessments.find_one(
        {"patient_id": body.patient_id}, sort=[("created_at", -1)]
    )
    movement_summary = None
    if latest_movement:
        movement_summary = {
            "overall_score": latest_movement["overall_score"],
            "movement_risk_level": latest_movement["movement_risk_level"],
            "test_count": len(latest_movement.get("tests", [])),
            "assessed_at": latest_movement["created_at"],
        }

    doc = {
        "patient_id": body.patient_id,
        "readings": readings,
        "reading_count": len(readings),
        "imu_averages": result.get("imu_averages"),
        "camera_trial_count": len(body.camera_results or []),
        "session_id": body.session_id,
        "is_simulated": body.is_simulated or False,
        "result": result,
        "movement_summary": movement_summary,
        "created_by": user["id"],
        "created_at": now_iso(),
        "review_status": "pending",
        "doctor_notes": None,
        "confirmed_risk_level": None,
        "follow_up_date": None,
        "ai_summary": None,
    }
    res = await db.screenings.insert_one(doc)
    saved = await db.screenings.find_one({"_id": res.inserted_id})
    return clean(saved)


@api.get("/screenings/{screening_id}")
async def get_screening(screening_id: str, user: dict = Depends(get_current_user)):
    s = await db.screenings.find_one({"_id": ObjectId(screening_id)})
    if not s:
        raise HTTPException(status_code=404, detail="Screening not found")
    p = await db.patients.find_one({"_id": ObjectId(s["patient_id"])})
    out = clean(s)
    out["patient"] = clean(p) if p else None
    return out


@api.post("/screenings/{screening_id}/review", dependencies=[Depends(require_roles("doctor", "admin"))])
async def review_screening(screening_id: str, body: DoctorReviewInput, user: dict = Depends(get_current_user)):
    s = await db.screenings.find_one({"_id": ObjectId(screening_id)})
    if not s:
        raise HTTPException(status_code=404, detail="Screening not found")
    await db.screenings.update_one({"_id": ObjectId(screening_id)}, {"$set": {
        "doctor_notes": body.notes,
        "confirmed_risk_level": body.confirmed_risk_level,
        "follow_up_date": body.follow_up_date,
        "review_status": body.status,
        "reviewed_by": user["name"],
        "reviewed_at": now_iso(),
    }})
    saved = await db.screenings.find_one({"_id": ObjectId(screening_id)})
    return clean(saved)


@api.get("/screenings")
async def list_screenings(review_status: Optional[str] = None, risk: Optional[str] = None,
                          user: dict = Depends(get_current_user)):
    q = {}
    if review_status:
        q["review_status"] = review_status
    if risk:
        q["result.risk_level"] = risk
    screenings = await db.screenings.find(q).sort("created_at", -1).to_list(1000)
    out = []
    for s in screenings:
        p = await db.patients.find_one({"_id": ObjectId(s["patient_id"])})
        item = clean(s)
        item["patient_name"] = p["name"] if p else "Unknown"
        item["patient_village"] = p.get("village") if p else None
        out.append(item)
    return out


def _describe_result(r: Dict[str, Any]) -> str:
    if r.get("deviation_score") is not None:
        return (f"gait deviation {r['deviation_score']} (share of reference walking trials that look more "
                f"typical), {r.get('risk_level')} deviation tier.")
    if r.get("engine_version"):
        return "no calibrated score (no camera gait trials recorded)."
    if r.get("oa_probability") is not None:  # screenings made before engine 2.0
        return f"legacy uncalibrated score {r['oa_probability']} ({r.get('risk_level')})."
    return "no score available."


@api.post("/screenings/{screening_id}/ai-summary")
async def ai_summary(screening_id: str, user: dict = Depends(get_current_user)):
    s = await db.screenings.find_one({"_id": ObjectId(screening_id)})
    if not s:
        raise HTTPException(status_code=404, detail="Screening not found")
    if s.get("ai_summary"):
        return {"ai_summary": s["ai_summary"]}
    p = await db.patients.find_one({"_id": ObjectId(s["patient_id"])})
    r = s["result"]
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"screening-{screening_id}",
            system_message=(
                "You are a clinical assistant for rural healthcare workers screening for knee "
                "osteoarthritis. Write a clear, compassionate, plain-language summary (max 140 words). "
                "Always end with a reminder that this is AI-assisted screening, not a medical diagnosis. "
                "Avoid alarming language; give practical, actionable guidance."
            ),
        ).with_model("openai", "gpt-5.4")
        prompt = (
            f"Patient: {p['name']}, age {p['age']}, gender {p.get('gender')}, "
            f"BMI {p.get('bmi')}, occupation {p.get('occupation')}, village {p.get('village')}.\n"
            f"Screening result: {_describe_result(r)}\n"
            f"Most unusual gait measurements: {', '.join(f['factor'] for f in r.get('contributing_factors', [])[:3]) or 'none recorded'}.\n"
            f"Clinical risk factors: {', '.join(c['factor'] for c in r.get('clinical_risk_factors', [])) or 'none recorded'}.\n"
            "The score is a gait deviation percentile against a reference walking cohort, NOT a probability "
            "of osteoarthritis; never describe it as a probability or diagnosis.\n"
            f"Provide a screening summary and next-step advice for the healthcare worker."
        )
        text = await chat.send_message(UserMessage(text=prompt))
        summary = text if isinstance(text, str) else str(text)
    except Exception as e:
        logger.exception("AI summary failed")
        summary = (
            f"{p['name']}: {_describe_result(r)} {r.get('recommendation', '')} {r.get('follow_up', '')} "
            f"This is AI-assisted screening, not a medical diagnosis."
        )
    await db.screenings.update_one({"_id": ObjectId(screening_id)}, {"$set": {"ai_summary": summary}})
    return {"ai_summary": summary}


# ---------------------------------------------------------------- analytics
@api.get("/analytics/summary")
async def analytics_summary(user: dict = Depends(get_current_user)):
    total_patients = await db.patients.count_documents({})
    total_screenings = await db.screenings.count_documents({})
    high_risk = await db.screenings.count_documents({"result.risk_level": {"$in": ["High", "Severe"]}})

    screenings = await db.screenings.find({}).to_list(5000)
    patients = await db.patients.find({}).to_list(5000)

    scores = [s["result"]["deviation_score"] for s in screenings
              if isinstance(s.get("result"), dict) and isinstance(s["result"].get("deviation_score"), (int, float))]
    avg_deviation = round(sum(scores) / len(scores), 1) if scores else None
    legacy = sum(1 for s in screenings if isinstance(s.get("result"), dict)
                 and "oa_probability" in s["result"] and "engine_version" not in s["result"])

    # age distribution
    buckets = {"<40": 0, "40-49": 0, "50-59": 0, "60-69": 0, "70+": 0}
    for p in patients:
        a = p.get("age", 0)
        if a < 40:
            buckets["<40"] += 1
        elif a < 50:
            buckets["40-49"] += 1
        elif a < 60:
            buckets["50-59"] += 1
        elif a < 70:
            buckets["60-69"] += 1
        else:
            buckets["70+"] += 1
    age_distribution = [{"range": k, "count": v} for k, v in buckets.items()]

    # village-wise
    villages: Dict[str, int] = {}
    for p in patients:
        v = p.get("village") or "Unknown"
        villages[v] = villages.get(v, 0) + 1
    village_cases = [{"village": k, "count": v} for k, v in sorted(villages.items(), key=lambda x: -x[1])[:8]]

    # risk distribution
    risk_dist: Dict[str, int] = {"Low": 0, "Moderate": 0, "High": 0, "Not determined": 0}
    for s in screenings:
        lvl = (s.get("result") or {}).get("risk_level") if isinstance(s.get("result"), dict) else None
        if lvl in risk_dist:
            risk_dist[lvl] += 1
    risk_distribution = [{"level": k, "count": v} for k, v in risk_dist.items()]

    # monthly screenings (last 6 months)
    monthly: Dict[str, int] = {}
    for s in screenings:
        try:
            dt = datetime.fromisoformat(s["created_at"])
            key = dt.strftime("%b %Y")
            monthly[key] = monthly.get(key, 0) + 1
        except Exception:
            pass
    monthly_screenings = [{"month": k, "count": v} for k, v in list(monthly.items())[-6:]]

    return {
        "total_patients": total_patients,
        "total_screenings": total_screenings,
        "high_risk_patients": high_risk,
        "average_deviation_score": avg_deviation,
        "scored_screenings": len(scores),
        "legacy_screenings": legacy,
        "age_distribution": age_distribution,
        "village_cases": village_cases,
        "risk_distribution": risk_distribution,
        "monthly_screenings": monthly_screenings,
    }


# ---------------------------------------------------------------- MPU6050 WebSocket
class ConnManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, session: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(session, []).append(ws)

    def disconnect(self, session: str, ws: WebSocket):
        if session in self.rooms and ws in self.rooms[session]:
            self.rooms[session].remove(ws)

    async def broadcast(self, session: str, message: dict):
        for ws in list(self.rooms.get(session, [])):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(session, ws)


manager = ConnManager()


@app.websocket("/api/ws/sensor/{session_id}")
async def sensor_ws(websocket: WebSocket, session_id: str):
    await manager.connect(session_id, websocket)
    await websocket.send_json({"type": "status", "connected": True, "session_id": session_id})
    try:
        while True:
            data = await websocket.receive_json()
            reading = {
                "session_id": session_id,
                "acc_x": data.get("acc_x", 0), "acc_y": data.get("acc_y", 0), "acc_z": data.get("acc_z", 0),
                "gyro_x": data.get("gyro_x", 0), "gyro_y": data.get("gyro_y", 0), "gyro_z": data.get("gyro_z", 0),
                "timestamp": data.get("timestamp") or now_iso(),
            }
            await db.sensor_readings.insert_one(dict(reading))
            await manager.broadcast(session_id, {"type": "reading", **reading})
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
    except Exception:
        manager.disconnect(session_id, websocket)


# ---------------------------------------------------------------- OA Sentinel API proxy
# Server-side proxy to the external Render API (bypasses its missing CORS headers).
class OAAnalyzeInput(BaseModel):
    patient: Dict[str, Any]
    camera_results: List[Dict[str, Any]]
    patient_id: Optional[str] = None


def _safe_json(resp):
    try:
        return resp.json()
    except Exception:
        return {"raw": resp.text}


@api.get("/oa/health")
async def oa_health():
    if not OA_API_URL:
        return {"connected": False, "detail": "OA_API_URL not configured", "url": None}
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(f"{OA_API_URL}/health")
        return {"connected": r.status_code == 200, "status_code": r.status_code,
                "upstream": _safe_json(r), "url": OA_API_URL}
    except Exception as e:
        return {"connected": False, "detail": str(e), "url": OA_API_URL}


@api.post("/oa/analyze")
async def oa_analyze(body: OAAnalyzeInput, user: dict = Depends(get_current_user)):
    if not OA_API_URL:
        raise HTTPException(status_code=503, detail="OA_API_URL is not configured on the server")
    if not body.camera_results:
        raise HTTPException(status_code=400, detail="camera_results is empty")
    payload = {"patient": body.patient, "camera_results": body.camera_results}
    try:
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(f"{OA_API_URL}/analyze", json=payload)
    except httpx.TimeoutException:
        return {"success": False, "error": "OA Sentinel API timed out. The free-tier server may be waking up — please try again in a moment."}
    except httpx.RequestError as e:
        return {"success": False, "error": f"Could not reach OA Sentinel API: {e}"}
    data = _safe_json(r)
    if r.status_code >= 400:
        msg = data.get("error") if isinstance(data, dict) else str(data)
        return {"success": False, "status_code": r.status_code,
                "error": f"OA Sentinel API returned an error ({r.status_code}): {msg}"}

    if body.patient_id:
        try:
            await db.screenings.insert_one({
                "patient_id": body.patient_id,
                "source": "oa_sentinel_api",
                "camera_results": body.camera_results,
                "result": data,
                "reading_count": len(body.camera_results),
                "created_by": user["id"],
                "created_at": now_iso(),
                "review_status": "pending",
            })
        except Exception:
            logger.exception("Failed to persist OA analyze result")
    return {"success": True, "result": data}


# ---------------------------------------------------------------- health & diagnostics
@api.get("/health")
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "JointCare AI Backend",
        "database": "mongodb" if not is_fallback else "in_memory_resilient_store",
        "fallback_mode": is_fallback,
        "gait_model": prediction_engine.model_status(),
        "timestamp": now_iso(),
    }


# ---------------------------------------------------------------- startup
@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
    except Exception as e:
        logger.warning("Index creation skipped or not supported: %s", e)

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        admin_doc = {
            "name": "Dr. Lakshya (Admin)", "email": admin_email,
            "password_hash": hash_password(admin_pw), "role": "admin", "created_at": now_iso(),
        }
        res = await db.users.insert_one(admin_doc)
        admin_id = str(res.inserted_id)
        logger.info("Seeded admin %s", admin_email)
    else:
        admin_id = str(existing.get("_id", "admin_seed"))
        if not verify_password(admin_pw, existing["password_hash"]):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})

    # Seed demo patients if database is empty so local dev & testing are immediately functional
    try:
        patient_count = await db.patients.count_documents({})
        if patient_count == 0:
            demo_patients = [
                {
                    "name": "Ramesh Kumar", "age": 58, "gender": "Male",
                    "height_cm": 168.0, "weight_kg": 74.0, "bmi": 26.2,
                    "occupation": "Farmer", "village": "Rampur", "district": "Varanasi",
                    "phone": "+91 98765 43210", "medical_history": "Mild right knee pain for 6 months, stiffness in mornings",
                    "created_by": admin_id, "created_at": now_iso(),
                },
                {
                    "name": "Sunita Devi", "age": 62, "gender": "Female",
                    "height_cm": 155.0, "weight_kg": 68.0, "bmi": 28.3,
                    "occupation": "Homemaker", "village": "Chandauli", "district": "Chandauli",
                    "phone": "+91 98765 12345", "medical_history": "Bilateral knee crepitus, difficulty climbing stairs",
                    "created_by": admin_id, "created_at": now_iso(),
                },
                {
                    "name": "Anil Verma", "age": 49, "gender": "Male",
                    "height_cm": 172.0, "weight_kg": 70.0, "bmi": 23.7,
                    "occupation": "Carpenter", "village": "Mirzapur", "district": "Mirzapur",
                    "phone": "+91 98765 67890", "medical_history": "Left knee discomfort after prolonged standing",
                    "created_by": admin_id, "created_at": now_iso(),
                }
            ]
            for p in demo_patients:
                await db.patients.insert_one(p)
            logger.info("Seeded %d demo patients", len(demo_patients))
    except Exception as e:
        logger.warning("Demo patient seeding encountered an issue: %s", e)


@app.on_event("shutdown")
async def shutdown():
    try:
        client.close()
    except Exception:
        pass


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
