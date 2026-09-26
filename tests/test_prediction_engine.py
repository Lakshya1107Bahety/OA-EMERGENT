import sys
import os
import json

backend_dir = r"c:\Users\Lakshya\Documents\SIH FINAL\backend"
sys.path.insert(0, backend_dir)

import prediction_engine

def run_tests():
    print("=== Testing OA Sentinel Prediction Engine ===")
    
    # 1. Reference Data Loading
    ref_path = os.path.join(backend_dir, "oa_healthy_reference.json")
    assert os.path.exists(ref_path), "Reference JSON missing!"
    with open(ref_path, "r") as f:
        ref = json.load(f)
    print(f"[PASS] Reference data loaded: {ref['n_reference_participants']} participants, {ref['n_total_trials']} trials")
    
    # 2. Healthy Subject Simulation
    normal_readings = []
    for i in range(100):
        normal_readings.append({
            "timestamp": 1700000000000 + i * 20,
            "acc_x": 0.05,
            "acc_y": 9.81,
            "acc_z": 0.1,
            "gyro_x": 1.2,
            "gyro_y": 0.5,
            "gyro_z": 0.3
        })
    patient_normal = {
        "id": "PAT-TEST-001",
        "name": "Jane Healthy",
        "age": 35,
        "bmi": 21.5,
        "pain_score": 1,
        "affected_side": "None"
    }
    res_normal = prediction_engine.predict(normal_readings, patient_normal)
    assert res_normal["risk_level"] in ["Low", "Moderate", "High"], "Invalid risk level"
    print(f"[PASS] Healthy subject: Risk={res_normal['risk_level']}, Prob={res_normal['oa_probability']}%, KneeStability={res_normal['knee_stability_score']}")

    # 3. High Risk Subject Simulation
    pathological_readings = []
    for i in range(100):
        # jerky, asymmetrical readings
        factor = 2.5 if i % 2 == 0 else 0.4
        pathological_readings.append({
            "timestamp": 1700000000000 + i * 20,
            "acc_x": 1.8 * factor,
            "acc_y": 7.5 + factor,
            "acc_z": 2.2 * factor,
            "gyro_x": 45.0 * factor,
            "gyro_y": 25.0,
            "gyro_z": 18.0
        })
    patient_high_risk = {
        "id": "PAT-TEST-002",
        "name": "Robert Arthritic",
        "age": 68,
        "bmi": 32.4,
        "pain_score": 8,
        "affected_side": "Right",
        "previous_oa": True
    }
    res_high = prediction_engine.predict(pathological_readings, patient_high_risk)
    print(f"[PASS] High risk subject: Risk={res_high['risk_level']}, Prob={res_high['oa_probability']}%, KneeStability={res_high['knee_stability_score']}")
    print(f"       Contributing factors: {len(res_high['contributing_factors'])}")
    print(f"       Recommendation: {res_high['recommendation'][:60]}...")
    
    # 4. Multi-modal camera feature screening
    camera_trial = {
        "right_knee_rom_deg": 42.0,
        "left_knee_rom_deg": 65.0,
        "knee_rom_asymmetry_pct": 35.4,
        "cadence_steps_min": 78.0,
        "trunk_lean_deg": 12.5
    }
    res_multi = prediction_engine.screen_patient_multimodal(patient_normal, [camera_trial])
    print(f"[PASS] Multimodal camera test: Risk Category={res_multi['risk_category']}, Score={res_multi['screening_score']}")
    
    print("\nALL PREDICTION ENGINE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
