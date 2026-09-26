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

import prediction_engine

# ---------------------------------------------------------------- DB / app
from resilient_db import init_database

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'jointcare_ai')
client, db, is_fallback = init_database(mongo_url, db_name)

app = FastAPI(title="JointCare AI")
api = APIRouter(prefix="/api")

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
    readings: List[SensorReading]
    imu_averages: Optional[Dict[str, float]] = None
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
        p["latest_probability"] = last.get("result", {}).get("oa_probability") if last else None
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


# ---------------------------------------------------------------- dataset (placeholder)
@api.post("/dataset/upload", dependencies=[Depends(require_roles("admin", "doctor"))])
async def upload_dataset(file: UploadFile = File(...)):
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
    await db.datasets.delete_many({})
    await db.datasets.insert_one({"filename": file.filename, "rows": rows,
                                  "uploaded_at": now_iso(), "row_count": len(rows)})
    return {"filename": file.filename, "row_count": len(rows)}


@api.get("/dataset/info")
async def dataset_info(user: dict = Depends(get_current_user)):
    ds = await db.datasets.find_one({}, sort=[("uploaded_at", -1)])
    if not ds:
        return {"loaded": False}
    return {"loaded": True, "filename": ds["filename"], "row_count": ds["row_count"], "uploaded_at": ds["uploaded_at"]}


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
    if not readings:
        raise HTTPException(status_code=400, detail="No sensor readings provided")

    ds = await db.datasets.find_one({}, sort=[("uploaded_at", -1)])
    dataset_rows = ds["rows"] if ds else None
    result = prediction_engine.predict(readings, clean(patient), dataset_rows, imu_averages=body.imu_averages)

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
        "imu_averages": body.imu_averages,
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
            f"Screening result: OA probability {r['oa_probability']}%, risk level {r['risk_level']}, "
            f"confidence {r['confidence']}%. Knee stability {r['knee_stability_score']}/100, "
            f"movement symmetry {r['movement_symmetry']}%, balance {r['balance_score']}/100.\n"
            f"Top contributing factors: {', '.join(f['factor'] for f in r['contributing_factors'][:3])}.\n"
            f"Provide a screening summary and next-step advice for the healthcare worker."
        )
        text = await chat.send_message(UserMessage(text=prompt))
        summary = text if isinstance(text, str) else str(text)
    except Exception as e:
        logger.exception("AI summary failed")
        summary = (
            f"{p['name']} shows a {r['risk_level'].lower()} osteoarthritis risk "
            f"({r['oa_probability']}% probability). {r['recommendation']} {r['follow_up']} "
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

    probs = [s["result"]["oa_probability"] for s in screenings if s.get("result")]
    stabs = [s["result"]["knee_stability_score"] for s in screenings if s.get("result")]
    avg_prob = round(sum(probs) / len(probs), 1) if probs else 0
    avg_stab = round(sum(stabs) / len(stabs), 1) if stabs else 0

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
    risk_dist: Dict[str, int] = {"Low": 0, "Moderate": 0, "High": 0, "Severe": 0}
    for s in screenings:
        lvl = s.get("result", {}).get("risk_level")
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
        "average_oa_probability": avg_prob,
        "average_stability_score": avg_stab,
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
                p_res = await db.patients.insert_one(p)
                # Seed a screening for the first patient
                if p["name"] == "Ramesh Kumar":
                    await db.screenings.insert_one({
                        "patient_id": str(p_res.inserted_id),
                        "reading_count": 25,
                        "result": {
                            "oa_probability": 68.5,
                            "risk_level": "Moderate",
                            "confidence": 88.0,
                            "knee_stability_score": 62.0,
                            "movement_symmetry": 71.4,
                            "balance_score": 64.0,
                            "recommendation": "Recommend physiotherapy exercises and low-impact walking.",
                            "follow_up": "Schedule follow-up evaluation in 4 weeks.",
                            "contributing_factors": [
                                {"factor": "Joint ROM limitation", "weight": 0.35},
                                {"factor": "Acceleration asymmetry", "weight": 0.30},
                                {"factor": "BMI elevated", "weight": 0.20}
                            ]
                        },
                        "created_by": admin_id,
                        "created_at": now_iso(),
                        "review_status": "pending",
                    })
            logger.info("Seeded %d demo patients and initial screening", len(demo_patients))
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
