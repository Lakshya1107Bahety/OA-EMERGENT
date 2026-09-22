import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { MOVEMENT_TESTS, createAccumulator } from "@/lib/movementTests";
import PoseCamera from "@/components/PoseCamera";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Activity, Play, Square, Save, CheckCircle2, Loader2, Timer, Repeat, Bone } from "lucide-react";

const Metric = ({ label, value, unit, testid }) => (
  <div className="bg-white rounded-xl border border-emerald-900/10 p-3 text-center" data-testid={testid}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-mono text-xl font-bold text-slate-800">{value != null ? value : "--"}<span className="text-xs text-muted-foreground ml-0.5">{unit}</span></p>
  </div>
);

export default function MovementAssessment() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(patientId || "");
  const [testId, setTestId] = useState("sit_to_stand");
  const [phase, setPhase] = useState("idle"); // idle | running | done
  const [countdown, setCountdown] = useState(0);
  const [live, setLive] = useState({});
  const [completed, setCompleted] = useState([]); // {test_type, metrics, quality_score, duration}
  const [saving, setSaving] = useState(false);

  const accRef = useRef(null);
  const startRef = useRef(0);
  const timerRef = useRef(null);
  const throttleRef = useRef(0);

  const test = MOVEMENT_TESTS.find((t) => t.id === testId);

  useEffect(() => {
    api.get("/patients").then((r) => setPatients(r.data));
  }, []);
  useEffect(() => () => clearInterval(timerRef.current), []);

  const onLandmarks = (lms) => {
    if (phase !== "running" || !accRef.current) return;
    const snap = accRef.current.push(lms);
    const now = performance.now();
    if (now - throttleRef.current > 120) {
      throttleRef.current = now;
      setLive({ ...snap });
    }
  };

  const finishTest = () => {
    clearInterval(timerRef.current);
    const elapsed = +((performance.now() - startRef.current) / 1000).toFixed(1);
    const res = accRef.current.finalize(elapsed);
    const entry = { test_type: testId, duration: elapsed, ...res };
    setCompleted((prev) => [...prev.filter((c) => c.test_type !== testId), entry]);
    setPhase("done");
    toast.success(`${test.name}: quality ${res.quality_score}%`);
  };

  const startTest = () => {
    if (!selected) { toast.error("Select a patient first"); return; }
    accRef.current = createAccumulator(testId);
    startRef.current = performance.now();
    setLive({});
    setPhase("running");
    if (test.mode === "countdown") {
      setCountdown(test.duration);
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timerRef.current); finishTest(); return 0; }
          return c - 1;
        });
      }, 1000);
    } else {
      setCountdown(0);
      timerRef.current = setInterval(() => {
        setCountdown(Math.floor((performance.now() - startRef.current) / 1000));
      }, 200);
    }
  };

  const stopTest = () => finishTest();

  const saveAssessment = async () => {
    if (!selected) { toast.error("Select a patient"); return; }
    if (completed.length === 0) { toast.error("Complete at least one test"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/movement-assessments", { patient_id: selected, tests: completed });
      toast.success(`Movement assessment saved (score ${data.overall_score}%)`);
      navigate(`/app/patients/${selected}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSaving(false);
    }
  };

  const doneEntry = completed.find((c) => c.test_type === testId);
  const progress = test?.mode === "countdown" && phase === "running"
    ? ((test.duration - countdown) / test.duration) * 100 : phase === "done" ? 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Bone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900">Movement Assessment</h1>
            <p className="text-slate-600">AI pose estimation — functional knee & mobility tests.</p>
          </div>
        </div>
        <div className="min-w-[220px]">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-11 rounded-xl" data-testid="movement-patient-select">
              <SelectValue placeholder="Select patient" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.age}y</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* test selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {MOVEMENT_TESTS.map((t) => {
          const done = completed.find((c) => c.test_type === t.id);
          return (
            <button
              key={t.id}
              disabled={phase === "running"}
              onClick={() => { setTestId(t.id); setPhase("idle"); setLive({}); }}
              data-testid={`test-tab-${t.id}`}
              className={`relative text-left p-3 rounded-2xl border transition-all ${
                testId === t.id ? "border-primary bg-accent" : "border-emerald-900/10 bg-white hover:shadow-sm"
              } ${phase === "running" ? "opacity-60" : ""}`}
            >
              {done && <CheckCircle2 className="w-4 h-4 text-primary absolute top-2 right-2" />}
              <p className="text-sm font-semibold text-slate-800 leading-tight">{t.name}</p>
              {done && <p className="text-xs text-primary mt-1 font-medium">{done.quality_score}%</p>}
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* camera */}
        <div className="lg:col-span-2 space-y-4">
          {(selected || phase === "running") ? (
            <PoseCamera onLandmarks={onLandmarks} />
          ) : (
            <div className="w-full aspect-video rounded-2xl bg-slate-100 border border-dashed border-emerald-900/20 flex items-center justify-center text-slate-400">
              Select a patient to enable the camera
            </div>
          )}

          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {test.mode === "countdown"
                  ? <span className="flex items-center gap-1 font-mono text-2xl font-bold text-primary" data-testid="countdown-timer"><Timer className="w-5 h-5" />{phase === "running" ? countdown : test.duration}s</span>
                  : <span className="flex items-center gap-1 font-mono text-2xl font-bold text-primary" data-testid="stopwatch-timer"><Timer className="w-5 h-5" />{countdown}s</span>}
                {(testId === "sit_to_stand" || testId === "squat") && (
                  <span className="flex items-center gap-1 font-mono text-lg font-semibold text-secondary ml-4" data-testid="rep-counter">
                    <Repeat className="w-4 h-4" />{live.reps ?? doneEntry?.metrics?.repetitions ?? 0}
                  </span>
                )}
              </div>
              {phase !== "running" ? (
                <Button className="rounded-xl" onClick={startTest} data-testid="start-test-button">
                  <Play className="w-4 h-4 mr-2" /> {doneEntry ? "Retake" : "Start"}
                </Button>
              ) : (
                <Button variant="destructive" className="rounded-xl" onClick={stopTest} data-testid="stop-test-button">
                  <Square className="w-4 h-4 mr-2" /> Stop
                </Button>
              )}
            </div>
            <Progress value={progress} className="h-2" data-testid="test-progress" />
            <p className="text-xs text-slate-500 mt-2">{test.desc}</p>
          </div>
        </div>

        {/* live metrics */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-4">
            <h3 className="font-heading font-semibold text-slate-800 mb-3">Live Joint Angles</h3>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Left Knee" value={live.kneeL} unit="°" testid="live-knee-left" />
              <Metric label="Right Knee" value={live.kneeR} unit="°" testid="live-knee-right" />
              <Metric label="Hip Angle" value={live.hipAngle} unit="°" testid="live-hip-angle" />
              <Metric label="Posture" value={live.posture} unit="%" testid="live-posture" />
            </div>
          </div>

          {doneEntry && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-4" data-testid="test-result-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold text-slate-800">Result — {test.name}</h3>
                <span className="font-heading text-2xl font-bold text-primary">{doneEntry.quality_score}%</span>
              </div>
              <div className="space-y-1.5">
                {Object.entries(doneEntry.metrics).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-slate-600 capitalize">{k.replace(/_/g, " ")}</span>
                    <span className="font-semibold text-slate-800">{typeof v === "boolean" ? (v ? "Yes" : "No") : v}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading font-semibold text-slate-800">Session</h3>
              <span className="text-sm text-slate-500">{completed.length}/5 tests</span>
            </div>
            <Button className="w-full rounded-xl h-11" onClick={saveAssessment} disabled={saving || completed.length === 0} data-testid="save-assessment-button">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save Assessment</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl text-amber-900 font-medium text-sm">
        AI-assisted screening, not a medical diagnosis. Results feed into the patient's OA risk workflow.
      </div>
    </div>
  );
}
