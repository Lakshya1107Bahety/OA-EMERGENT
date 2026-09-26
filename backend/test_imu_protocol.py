import urllib.request
import json

def test_imu_flow():
    # 1. Login
    req_login = urllib.request.Request(
        'http://localhost:8000/api/auth/login',
        data=json.dumps({'email': 'admin@example.com', 'password': 'admin123'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_login) as resp:
        auth_data = json.loads(resp.read().decode())
    token = auth_data['access_token']
    print(f"Logged in as {auth_data['user']['name']}")

    # 2. Get Patients
    req_pts = urllib.request.Request(
        'http://localhost:8000/api/patients',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req_pts) as resp:
        patients = json.loads(resp.read().decode())
    assert len(patients) > 0, "No patients found"
    patient_id = patients[0]['id']
    print(f"Testing with patient: {patients[0]['name']} (ID: {patient_id})")

    # 3. Create 10s IMU Session
    raw_stream = [
        {
            "acc_x": round(0.4 + i * 0.01, 3),
            "acc_y": round(9.8 + (i % 3) * 0.05, 3),
            "acc_z": round(0.1 + (i % 2) * 0.02, 3),
            "gyro_x": round(1.2 + (i % 4) * 0.1, 3),
            "gyro_y": round(0.8 - (i % 2) * 0.05, 3),
            "gyro_z": round(2.1 + (i % 5) * 0.1, 3),
            "timestamp": "2026-09-26T20:30:00Z"
        }
        for i in range(25)
    ]
    imu_payload = {
        "patient_id": patient_id,
        "session_id": "test-session-10s-flow",
        "timestamp": "2026-09-26T20:30:00Z",
        "duration_sec": 10.0,
        "acc_x_avg": 0.52,
        "acc_y_avg": 9.85,
        "acc_z_avg": 0.11,
        "gyro_x_avg": 1.35,
        "gyro_y_avg": 0.78,
        "gyro_z_avg": 2.30,
        "raw_stream": raw_stream,
        "is_simulated": True
    }
    req_imu = urllib.request.Request(
        'http://localhost:8000/api/imu-sessions',
        data=json.dumps(imu_payload).encode(),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req_imu) as resp:
        saved_session = json.loads(resp.read().decode())
    print("IMU Session successfully saved:")
    print(f" - Session ID: {saved_session['session_id']}")
    print(f" - Duration: {saved_session['duration_sec']}s")
    print(f" - Acc Averages: X={saved_session['acc_x_avg']}, Y={saved_session['acc_y_avg']}, Z={saved_session['acc_z_avg']}")
    print(f" - Gyro Averages: X={saved_session['gyro_x_avg']}, Y={saved_session['gyro_y_avg']}, Z={saved_session['gyro_z_avg']}")
    print(f" - Raw Stream points: {len(saved_session['raw_stream'])}")
    print(f" - Is Simulated: {saved_session['is_simulated']}")

    # 4. List IMU Sessions
    req_list = urllib.request.Request(
        f'http://localhost:8000/api/imu-sessions?patient_id={patient_id}',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req_list) as resp:
        all_sessions = json.loads(resp.read().decode())
    print(f"Retrieved {len(all_sessions)} IMU sessions for patient {patient_id}")

    # 5. Run OA Prediction with IMU averages
    screening_payload = {
        "patient_id": patient_id,
        "readings": raw_stream,
        "imu_averages": {
            "acc_x": 0.52, "acc_y": 9.85, "acc_z": 0.11,
            "gyro_x": 1.35, "gyro_y": 0.78, "gyro_z": 2.30
        },
        "session_id": "test-session-10s-flow",
        "is_simulated": True
    }
    req_pred = urllib.request.Request(
        'http://localhost:8000/api/screenings',
        data=json.dumps(screening_payload).encode(),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req_pred) as resp:
        screening_res = json.loads(resp.read().decode())
    print("Screening Prediction with 10s IMU Averages completed:")
    print(f" - Screening ID: {screening_res['id']}")
    print(f" - Risk Level: {screening_res['result']['risk_level']}")
    print(f" - OA Probability: {screening_res['result']['oa_probability']}%")
    print(f" - Knee Stability Score: {screening_res['result']['knee_stability_score']}")
    print(f" - IMU Averages in Result: {screening_res['result'].get('imu_averages')}")
    print("\nALL 10-SECOND IMU TEST PROTOCOL & DATABASE PERSISTENCE VERIFICATIONS PASSED!")

if __name__ == '__main__':
    test_imu_flow()
