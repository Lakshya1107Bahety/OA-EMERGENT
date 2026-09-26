"""
OA SENTINEL — oa_api.py
JointCare Flask Backend for OA Screening
"""

from pathlib import Path
import pandas as pd
from flask import Flask, request, jsonify

from oa_screen import (
    load_reference,
    screen_trials,
    append_patient_to_excel,
)

# -----------------------------
# Flask App
# -----------------------------
app = Flask(__name__)

# Base paths
BASE = Path(__file__).parent
REFERENCE_FILE = BASE / "oa_healthy_reference.json"
PATIENT_EXCEL = BASE / "OA_Sentinel_Patient_Records.xlsx"

@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, PUT, DELETE"
    return response

# -----------------------------
# Home Route
# -----------------------------
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "running",
        "service": "JointCare OA Sentinel API",
        "message": "API is live",
        "version": "1.0"
    }), 200


# -----------------------------
# Health Check Route
# -----------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "JointCare OA Sentinel API"
    }), 200


# -----------------------------
# OA Analysis Endpoint
# -----------------------------
@app.route("/analyze", methods=["POST", "OPTIONS"])
def analyze():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    payload = request.get_json(silent=True)

    if payload is None:
        return jsonify({
            "success": False,
            "error": "JSON request body required."
        }), 400

    patient = payload.get("patient", {})
    camera_results = payload.get("camera_results", [])

    if len(camera_results) == 0:
        return jsonify({
            "success": False,
            "error": "camera_results is empty."
        }), 400

    if not REFERENCE_FILE.exists():
        return jsonify({
            "success": False,
            "error": "Healthy reference file not found."
        }), 500

    try:
        # Load healthy reference
        reference = load_reference(REFERENCE_FILE)

        # Convert incoming camera data to dataframe
        df = pd.DataFrame(camera_results)

        # Perform screening
        screening = screen_trials(df, reference)

        # Ensure patient_id is present
        patient_id = patient.get("patient_id") or patient.get("id") or payload.get("patient_id") or "UNKNOWN"
        patient["patient_id"] = patient_id

        # Save patient record
        record = append_patient_to_excel(
            patient,
            screening,
            PATIENT_EXCEL
        )

        screening_score = float(record["screening_score"])
        abnormal_pct = float(record.get("abnormal_trial_rate_pct", 0.0))

        # Return results for Frontend / Clients
        return jsonify({
            "success": True,
            "patient_id": record["patient_id"],

            # UI fields
            "oa_probability": round(screening_score, 1),
            "risk_level": record["screening_level"],
            "knee_stability": round(max(0.0, min(100.0, 100.0 - screening_score)), 1),
            "balance_score": round(max(0.0, min(100.0, 100.0 - screening_score)), 1),
            "symmetry": round(max(0.0, min(100.0, 100.0 - abnormal_pct)), 1),

            # Existing API fields
            "screening_level": record["screening_level"],
            "screening_score": record["screening_score"],
            "trials_analyzed": record["trials_analyzed"],
            "mean_biomechanical_score": record["mean_biomechanical_score"],
            "abnormal_trial_rate_pct": record["abnormal_trial_rate_pct"],
            "main_findings": record["main_findings"],
            "note": record["screening_note"]
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# -----------------------------
# Run Locally
# -----------------------------
if __name__ == "__main__":
    print("Starting JointCare OA Sentinel API...")
    print("Home   : http://127.0.0.1:5000/")
    print("Health : http://127.0.0.1:5000/health")
    print("Analyze: http://127.0.0.1:5000/analyze")

    app.run(host="0.0.0.0", port=5000, debug=False)
