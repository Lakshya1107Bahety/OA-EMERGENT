# JointCare AI — Product Requirements Document

## Original Problem Statement
AI-assisted Osteoarthritis (OA) screening platform for rural healthcare workers in North East India (SIH 2026). Collect patient details, receive live MPU6050 sensor data, compare with a medical dataset, and predict OA risk. Modules: Landing, Auth (Worker/Doctor/Admin), Patient Registration, AI Screening, Patient Records, Doctor Review, Analytics, Awareness Hub, Settings, Reports (PDF+QR), Offline support.

## Stack (adapted, user-approved)
React 19 + FastAPI + MongoDB (originally requested Next.js/Supabase). Recharts, Framer Motion, Tailwind, shadcn/ui, jsPDF+qrcode, idb (IndexedDB), WebSocket for MPU6050, Emergent LLM (gpt-5.4) for AI summaries. JWT Bearer auth (localStorage).

## User Personas
- Healthcare Worker: registers patients, runs sensor screenings.
- Doctor: reviews flagged screenings, confirms risk, adds clinical notes, uploads dataset.
- Admin: full access, analytics, dataset management.

## Core Requirements (static)
- Role-based auth; patient records with screening history; live MPU6050 WebSocket dashboard; modular OA prediction engine (swap placeholder with ML model without UI change); animated results (probability, risk tier, confidence, knee stability/symmetry/balance, contributing factors, disclaimer); analytics charts; PDF+QR reports; offline IndexedDB queue + auto-sync; elderly accessibility.

## Implemented (2026-06-22)
- JWT auth (register/login/me), admin seeded (lakshyabahety15@gmail.com), 3 roles, role gating on backend + routes.
- Patient CRUD with auto-BMI, search, filters.
- Live Sensor Screening: WebSocket /api/ws/sensor/{session}, client-generated MPU6050 stream, live tiles + accel/gyro charts, severity slider.
- OA Prediction Engine (prediction_engine.py) — rule-based placeholder, optional dataset comparison, returns full result object.
- ScreeningResult: animated circular meter, sub-scores, contributing factors, AI summary (Emergent LLM), PDF+QR download.
- Doctor Review workflow (confirm risk, follow-up, notes).
- Analytics dashboard (totals, high-risk, age dist, village cases, risk dist, monthly, avg stability).
- Awareness Hub (multilingual toggle, topics), Settings (dataset upload CSV/JSON, elderly mode, offline sync).
- Offline support via IndexedDB queue + auto-sync on reconnect.
- Verified: testing agent 100% backend (20/20) + all frontend flows.

## Backlog / Remaining
- P1: Real MPU6050 hardware device integration (BLE/Web Serial bridge) — WebSocket endpoint ready.
- P1: Replace placeholder engine with trained ML model (drop-in in prediction_engine._ml_predict).
- P2: Full Assamese/Bengali translations (currently toggle UI).
- P2: Give Recharts ResponsiveContainers explicit min-height to silence console warnings.
- P2: Make LLM model env-configurable.

## Next Tasks
- Await user's dataset + ML model to wire into the engine.
- Optional: hardware WebSocket client sample for the MPU6050 device.
