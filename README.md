# OA Sentinel (JointCare AI)

AI-assisted knee osteoarthritis risk screening for community health workers.

| Part | Folder / repo | Stack | Host |
|---|---|---|---|
| Frontend | `frontend/` | React (CRA + craco), Tailwind | Vercel |
| Backend | `backend/` | FastAPI, MongoDB (motor) | Render |
| Database | — | MongoDB | MongoDB Atlas (free M0) |
| ML API | [oa-sentinel-api](https://github.com/Lakshya1107Bahety/oa-sentinel-api) | Flask, scikit-learn | Render |

Browser → frontend → backend (`/api/...`) → ML API (`/analyze`). The backend
proxies ML calls, so the browser never talks to the ML API directly.

## Run locally

```bash
# backend
cd backend
cp .env.example .env        # fill in MONGO_URL, JWT_SECRET, ADMIN_PASSWORD
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# frontend (new terminal)
cd frontend
cp .env.example .env        # REACT_APP_BACKEND_URL=http://localhost:8001
yarn install
yarn start                  # http://localhost:3000
```

Backend tests (server must be running):

```bash
cd backend
ADMIN_EMAIL=... ADMIN_PASSWORD=... REACT_APP_BACKEND_URL=http://localhost:8001 pytest -q tests
```

## Deploy

Do these in order; each step needs the URL from the previous one.

### 1. MongoDB Atlas
1. Create a free **M0** cluster.
2. Database Access → add a user with a generated password.
3. Network Access → allow `0.0.0.0/0` (Render has no fixed IP).
4. Connect → Drivers → copy the `mongodb+srv://...` string and insert the password.

### 2. ML API (Render, already deployed)
Make sure its Environment has `SAVE_PATIENT_EXCEL=0`, and that
`https://<ml-api>/health` shows `"model_loaded": true`.

### 3. Backend (Render → New → Web Service → this repo)
- Root directory: `backend`
- Runtime: Python 3 (set env var `PYTHON_VERSION=3.11.11`)
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Environment: every variable in `backend/.env.example`, with real values.
  Set `CORS_ORIGINS` after step 4.

Check: `https://<backend>/api/oa/health` should return `"connected": true`.

### 4. Frontend (Vercel → Add New → Project → this repo)
- Root directory: `frontend`
- Framework preset: Create React App
- Build command: `yarn build`, output directory: `build`
- Environment variable: `REACT_APP_BACKEND_URL=https://<backend>` (no trailing slash)

Then set the backend's `CORS_ORIGINS=https://<your-app>.vercel.app` on Render and redeploy it.

### Free-tier caveat
Free Render services sleep after ~15 min idle; the first request then takes
30–60 s, and this app chains two Render services. Open both `/health` URLs a
couple of minutes before a demo.
