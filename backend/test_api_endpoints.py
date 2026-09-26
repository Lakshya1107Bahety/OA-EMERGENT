import urllib.request
import json

def test_endpoints():
    # 1. Login
    req = urllib.request.Request(
        'http://localhost:8000/api/auth/login',
        data=json.dumps({'email': 'admin@example.com', 'password': 'admin123'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
    token = data['access_token']
    print(f"Login OK: {data['user']['name']} ({data['user']['role']})")

    # 2. Auth me
    req_me = urllib.request.Request(
        'http://localhost:8000/api/auth/me',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req_me) as resp:
        me_data = json.loads(resp.read().decode())
    print(f"Auth /me OK: {me_data['email']}")

    # 3. Analytics Summary
    req_an = urllib.request.Request(
        'http://localhost:8000/api/analytics/summary',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req_an) as resp:
        analytics = json.loads(resp.read().decode())
    print(f"Analytics Summary OK: Total Patients = {analytics['total_patients']}, Screenings = {analytics['total_screenings']}")

    # 4. Patients list
    req_pts = urllib.request.Request(
        'http://localhost:8000/api/patients',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req_pts) as resp:
        patients = json.loads(resp.read().decode())
    print(f"Patients list OK: {len(patients)} patients")
    for p in patients:
        print(f" - {p['name']} ({p['age']}y, {p.get('village')}) | Screenings: {p.get('screening_count')}")

    # 5. OA Health
    req_oa = urllib.request.Request(
        'http://localhost:8000/api/oa/health',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req_oa) as resp:
        oa_health = json.loads(resp.read().decode())
    print(f"OA Sentinel Health OK: {oa_health}")

if __name__ == '__main__':
    test_endpoints()
