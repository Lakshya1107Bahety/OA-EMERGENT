import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { checkHealth, analyze, averageEvery, loadLastSession, pick, normalizeCameraResults, OA_API_URL } from "@/lib/oaApi";
import { parseCSV } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Cloud, CloudOff, Upload, RadioTower, Loader2, Zap, CheckCircle2, AlertTriangle,
  Activity, Scale, Gauge, FileText, Stethoscope, Server,
} from "lucide-react";

const ResultTile = ({ icon: Icon, label, value, suffix, testid }) => (
  <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-4 text-center" data-testid={testid}>
    <Icon className="w-6 h-6 text-primary mx-auto" />
    <p className="mt-2 font-heading text-2xl font-bold text-slate-900">
      {value != null && value !== "" ? value : "—"}<span className="text-xs text-muted-foreground ml-0.5">{value != null ? suffix : ""}</span>
    </p>
    <p className="text-xs text-slate-600">{label}</p>
  </div>
);

export default function OASentinel() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(patientId || "");
  const [health, setHealth] = useState({ loading: true });
  const [tab, setTab] = useState("csv");
  const [cameraResults, setCameraResults] = useState([]);
  const [sourceLabel, setSourceLabel] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    api.get("/patients").then((r) => setPatients(r.data)).catch(() => {});
    refreshHealth();
  }, []);

  const refreshHealth = async () => {
    setHealth({ loading: true });
    try {
      const h = await checkHealth();
      setHealth({ loading: false, ...h });
    } catch (e) {
      setHealth({ loading: false, connected: false, detail: "Could not reach server" });
    }
  };

  const onCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { rows } = parseCSV(text);
      if (!rows.length) { toast.error("CSV has no data rows"); return; }
      const averaged = averageEvery(rows, 20);
      setCameraResults(averaged);
      setSourceLabel(`${file.name} — ${rows.length} rows → ${averaged.length} averaged (every 20)`);
      toast.success(`Parsed ${rows.length} rows → ${averaged.length} averaged samples`);
    } catch {
      toast.error("Could not parse CSV");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const useLastSession = () => {
    const raw = loadLastSession();
    if (!raw.length) { toast.error("No recent BLE/simulator session found. Capture data in AI Screening first."); return; }
    const averaged = averageEvery(raw, 20);
    setCameraResults(averaged);
    setSourceLabel(`Last sensor session — ${raw.length} readings → ${averaged.length} averaged (every 20)`);
    toast.success(`Loaded ${raw.length} readings → ${averaged.length} averaged samples`);
  };

  const buildPatient = () => {
    const p = patients.find((x) => x.id === selected);
    if (!p) return null;
    return {
      patient_id: p.id,
      age: p.age,
      gender: p.gender,
      height_cm: p.height_cm ?? null,
      mass_kg: p.weight_kg ?? null,
    };
  };

  const runAnalyze = async () => {
    setError("");
    setResult(null);
    if (!selected) { toast.error("Select a patient"); return; }
    if (!cameraResults.length) { toast.error("Load camera_results (CSV or sensor session) first"); return; }
    const patient = buildPatient();
    const camera_results = normalizeCameraResults(cameraResults, selected);
    setAnalyzing(true);
    try {
      const data = await analyze({ patient, camera_results, patient_id: selected });
      if (data.success) {
        setResult(data.result);
        toast.success("Analysis complete");
      } else {
        setError(data.error || "The analysis service returned an error.");
        toast.error("Analysis failed");
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail
        : err.code === "ERR_NETWORK" ? "Network error — please check your connection and try again."
        : err.message || "Analysis failed";
      setError(msg);
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const HealthBadge = () => {
    if (health.loading) return <span className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full bg-slate-100 text-slate-500" data-testid="api-status"><Loader2 className="w-4 h-4 animate-spin" /> Checking API…</span>;
    return health.connected
      ? <span className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full bg-emerald-50 text-emerald-700" data-testid="api-status"><Cloud className="w-4 h-4" /> API Connected</span>
      : <span className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full bg-red-50 text-red-600" data-testid="api-status"><CloudOff className="w-4 h-4" /> API Offline</span>;
  };

  // flexible response mapping
  const r = result || {};
  const probability = pick(r, ["oa_probability", "probability", "oa_prob", "risk_probability"]);
  const riskLevel = pick(r, ["risk_level", "risk", "risk_category", "category"]);
  const kneeStability = pick(r, ["knee_stability", "knee_stability_score", "stability"]);
  const balance = pick(r, ["balance_score", "balance"]);
  const symmetry = pick(r, ["symmetry", "movement_symmetry", "symmetry_score"]);
  const findings = pick(r, ["findings", "finding", "explanation", "notes"]);
  const recommendation = pick(r, ["recommendation", "recommendations", "advice", "follow_up"]);
  const patientIdOut = pick(r, ["patient_id", "participant_id", "id"]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Server className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900">Cloud OA Analysis</h1>
            <p className="text-slate-600">Analyze via the OA Sentinel API and view live model results.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HealthBadge />
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={refreshHealth} data-testid="refresh-health-button">Retry</Button>
        </div>
      </div>

      {OA_API_URL && (
        <p className="text-xs text-muted-foreground -mt-3">Endpoint: <span className="font-mono">{OA_API_URL}</span></p>
      )}

      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
        <label className="text-sm font-medium text-slate-700">Patient</label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="mt-1.5 h-11 rounded-xl max-w-md" data-testid="analyze-patient-select">
            <SelectValue placeholder="Select patient" />
          </SelectTrigger>
          <SelectContent>
            {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.age}y</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="csv" data-testid="analyze-tab-csv"><Upload className="w-4 h-4 mr-1.5" /> CSV Upload</TabsTrigger>
          <TabsTrigger value="session" data-testid="analyze-tab-session"><RadioTower className="w-4 h-4 mr-1.5" /> Sensor Session</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="mt-4">
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 max-w-lg">Upload a CSV of processed camera/biomechanical results. Rows are averaged every 20 samples in the browser before sending.</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onCsv} data-testid="analyze-csv-input" />
            <Button className="rounded-xl h-11" onClick={() => fileRef.current?.click()} data-testid="analyze-csv-button">
              <Upload className="w-4 h-4 mr-2" /> Upload CSV
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="session" className="mt-4">
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 max-w-lg">Use the most recent BLE / simulator session captured in AI Screening. The same average-every-20 processing is applied.</p>
            <Button className="rounded-xl h-11" variant="outline" onClick={useLastSession} data-testid="analyze-session-button">
              <RadioTower className="w-4 h-4 mr-2" /> Use Last Session
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {sourceLabel && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3" data-testid="source-label">
          <CheckCircle2 className="w-4 h-4" /> {sourceLabel}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4 sticky bottom-4">
        <div className="flex items-center gap-2 text-slate-600">
          <Activity className="w-5 h-5 text-primary" />
          <span className="font-mono font-semibold" data-testid="camera-results-count">{cameraResults.length}</span> averaged sample(s) ready
        </div>
        <Button size="lg" className="rounded-xl h-12 px-8" onClick={runAnalyze} disabled={analyzing} data-testid="analyze-button">
          {analyzing ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Analyzing…</> : <><Zap className="w-5 h-5 mr-2" /> Analyze</>}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl text-red-800 text-sm flex items-start gap-2" data-testid="analyze-error">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Could not complete analysis</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4" data-testid="analyze-result">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold text-slate-900">API Result</h2>
            {patientIdOut != null && <span className="text-sm text-slate-500">Patient ID: <b data-testid="result-patient-id">{String(patientIdOut)}</b></span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <ResultTile icon={Gauge} label="OA Probability" value={probability} suffix="%" testid="result-probability" />
            <ResultTile icon={Stethoscope} label="Risk Level" value={riskLevel} suffix="" testid="result-risk" />
            <ResultTile icon={Activity} label="Knee Stability" value={kneeStability} suffix="" testid="result-stability" />
            <ResultTile icon={Gauge} label="Balance Score" value={balance} suffix="" testid="result-balance" />
            <ResultTile icon={Scale} label="Symmetry" value={symmetry} suffix="" testid="result-symmetry" />
          </div>
          {(findings || recommendation) && (
            <div className="grid lg:grid-cols-2 gap-4">
              {findings && (
                <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5" data-testid="result-findings">
                  <h3 className="font-heading font-semibold text-slate-800 flex items-center gap-2 mb-2"><FileText className="w-5 h-5 text-primary" /> Findings</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{typeof findings === "string" ? findings : JSON.stringify(findings, null, 2)}</p>
                </div>
              )}
              {recommendation && (
                <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5" data-testid="result-recommendation">
                  <h3 className="font-heading font-semibold text-slate-800 flex items-center gap-2 mb-2"><Stethoscope className="w-5 h-5 text-primary" /> Recommendation</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{typeof recommendation === "string" ? recommendation : JSON.stringify(recommendation, null, 2)}</p>
                </div>
              )}
            </div>
          )}
          <details className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
            <summary className="cursor-pointer font-heading font-semibold text-slate-800">Raw API response</summary>
            <pre className="mt-3 text-xs text-slate-600 overflow-x-auto jc-scrollbar">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </motion.div>
      )}

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl text-amber-900 text-sm">
        AI-assisted screening, not a medical diagnosis. All values shown come directly from the OA Sentinel API response.
      </div>
    </div>
  );
}
