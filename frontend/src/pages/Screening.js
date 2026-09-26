import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, wsSensorUrl, formatApiError } from "@/lib/api";
import { makeReading } from "@/lib/sensor";
import { connectBLE, bleSupported } from "@/lib/ble";
import { parseCSV, computeSensorMeans, saveDatasetMeans, loadDatasetMeans } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";
import {
  Wifi, WifiOff, Play, Square, Zap, Loader2, Activity, RadioTower, Bluetooth,
  Database, Upload, CheckCircle2, TrendingUp, Timer, RotateCcw, AlertCircle, Lock,
} from "lucide-react";

const AXES = [
  { key: "acc_x", label: "Acc X", unit: "m/s²" },
  { key: "acc_y", label: "Acc Y", unit: "m/s²" },
  { key: "acc_z", label: "Acc Z", unit: "m/s²" },
  { key: "gyro_x", label: "Gyro X", unit: "°/s" },
  { key: "gyro_y", label: "Gyro Y", unit: "°/s" },
  { key: "gyro_z", label: "Gyro Z", unit: "°/s" },
];

export default function Screening() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(patientId || "");
  const [sessionId] = useState(() => `sess-${Math.random().toString(36).slice(2, 10)}`);
  const [tab, setTab] = useState("bluetooth");

  // Connection State
  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState(null); // 'ble' | 'sim'
  const [bleName, setBleName] = useState("");

  // 10-Second Test Protocol: "idle" | "running" | "completed"
  const [testState, setTestState] = useState("idle");
  const [timeLeft, setTimeLeft] = useState(10.0);
  const [progress, setProgress] = useState(0);
  const [chart, setChart] = useState([]);
  const [latest, setLatest] = useState(null);
  const [tenSecAverages, setTenSecAverages] = useState(null);
  const [predicting, setPredicting] = useState(false);

  // Simulator config
  const [severity, setSeverity] = useState(0.35);

  // Dataset
  const [dataset, setDataset] = useState(loadDatasetMeans());
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Refs
  const wsRef = useRef(null);
  const bleRef = useRef(null);
  const activeTestTimerRef = useRef(null);
  const simStreamTimerRef = useRef(null);
  const testReadingsRef = useRef([]);
  const isTestingRef = useRef(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api
      .get("/patients")
      .then((r) => setPatients(r.data))
      .catch(() => setPatients([]));
    api.get("/dataset/info").catch(() => {});
  }, []);

  const openWs = () => {
    try {
      const ws = new WebSocket(wsSensorUrl(sessionId));
      ws.onopen = () => {};
      ws.onmessage = () => {};
      wsRef.current = ws;
    } catch {}
  };

  // ---- Hardware Connection & Fallback Logic ----
  const handleTabChange = (newTab) => {
    if (isTestingRef.current) {
      cancel10sTest();
    }
    setTab(newTab);
    // Auto-simulator disabled: when switching to bluetooth tab, disconnect any active simulator
    if (newTab === "bluetooth" && source === "sim") {
      disconnect();
    }
  };

  const connectBluetooth = async () => {
    if (!bleSupported()) {
      toast.error("Web Bluetooth not supported. Use Chrome or Edge on desktop or Android.");
      return;
    }
    try {
      const conn = await connectBLE({
        onReading: (r) => {
          if (isTestingRef.current) {
            handleTestReading(r);
          }
        },
        onDisconnect: () => {
          setConnected(false);
          setSource(null);
          setBleName("");
          if (isTestingRef.current) {
            cancel10sTest();
          }
          toast.warning("BLE device disconnected.");
        },
      });
      openWs();
      bleRef.current = conn;
      setBleName(conn.deviceName || "OA_IMU");
      setSource("ble");
      setConnected(true);
      toast.success(`Connected to ${conn.deviceName || "ESP32 MPU6050"}`);
    } catch (e) {
      // DO NOT automatically trigger or fall back to simulator here!
      setConnected(false);
      setSource(null);
      setBleName("");
      toast.error(e.message || "BLE connection cancelled");
    }
  };

  const connectSim = () => {
    openWs();
    setSource("sim");
    setConnected(true);
    toast.success("Simulator Mode activated. Click 'Start 10s Screening Test' to begin.");
  };

  const disconnect = () => {
    if (isTestingRef.current) {
      cancel10sTest();
    }
    if (simStreamTimerRef.current) clearInterval(simStreamTimerRef.current);
    bleRef.current?.disconnect?.();
    bleRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setSource(null);
    setBleName("");
    setLatest(null);
    setTestState("idle");
    setChart([]);
    setTenSecAverages(null);
    testReadingsRef.current = [];
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => disconnect(), []);

  // ---- 10-Second Test Protocol ----
  const handleTestReading = (r) => {
    testReadingsRef.current.push(r);
    setLatest(r);
    setChart((prev) => {
      const point = {
        t: (testReadingsRef.current.length * 0.05).toFixed(1) + "s",
        accX: r.acc_x,
        accY: r.acc_y,
        accZ: r.acc_z,
        gyroX: r.gyro_x,
        gyroY: r.gyro_y,
        gyroZ: r.gyro_z,
      };
      // Keep up to 300 points for the full 10-second visualization
      return [...prev, point];
    });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(r));
    }
  };

  const start10sTest = () => {
    if (!selected) {
      toast.error("Please select a patient before starting the test.");
      return;
    }
    if (!connected) {
      toast.error(
        tab === "bluetooth"
          ? "Sensor disconnected. Please pair your ESP32 Bluetooth device first."
          : "Please connect the simulator first."
      );
      return;
    }

    // Reset buffer & state
    testReadingsRef.current = [];
    setChart([]);
    setTenSecAverages(null);
    setTestState("running");
    isTestingRef.current = true;
    setTimeLeft(10.0);
    setProgress(0);

    const startTime = Date.now();
    const DURATION_MS = 10000;

    // If simulator mode, stream simulated 50Hz packets
    if (source === "sim") {
      simStreamTimerRef.current = setInterval(() => {
        if (isTestingRef.current) {
          handleTestReading(makeReading(severity));
        }
      }, 50);
    }

    // Countdown and progress interval
    activeTestTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, (DURATION_MS - elapsed) / 1000);
      const pct = Math.min(100, (elapsed / DURATION_MS) * 100);

      setTimeLeft(+remaining.toFixed(1));
      setProgress(+pct.toFixed(1));

      if (elapsed >= DURATION_MS) {
        finish10sTest();
      }
    }, 100);

    toast.info("10-Second screening test started. Keep sensor active on patient knee.");
  };

  const finish10sTest = () => {
    if (activeTestTimerRef.current) clearInterval(activeTestTimerRef.current);
    if (simStreamTimerRef.current) clearInterval(simStreamTimerRef.current);
    isTestingRef.current = false;

    const readings = testReadingsRef.current;
    const n = readings.length;

    let avgs = { acc_x: 0, acc_y: 0, acc_z: 0, gyro_x: 0, gyro_y: 0, gyro_z: 0 };
    if (n > 0) {
      avgs = {
        acc_x: +(readings.reduce((s, r) => s + (r.acc_x || 0), 0) / n).toFixed(2),
        acc_y: +(readings.reduce((s, r) => s + (r.acc_y || 0), 0) / n).toFixed(2),
        acc_z: +(readings.reduce((s, r) => s + (r.acc_z || 0), 0) / n).toFixed(2),
        gyro_x: +(readings.reduce((s, r) => s + (r.gyro_x || 0), 0) / n).toFixed(2),
        gyro_y: +(readings.reduce((s, r) => s + (r.gyro_y || 0), 0) / n).toFixed(2),
        gyro_z: +(readings.reduce((s, r) => s + (r.gyro_z || 0), 0) / n).toFixed(2),
      };
    }

    setTenSecAverages(avgs);
    setTestState("completed");
    setTimeLeft(0);
    setProgress(100);
    try {
      localStorage.setItem("jc_last_session", JSON.stringify(readings.slice(-600)));
    } catch {}
    toast.success(`10-Second test completed (${n} packets collected). Final averages locked.`);
  };

  const cancel10sTest = () => {
    if (activeTestTimerRef.current) clearInterval(activeTestTimerRef.current);
    if (simStreamTimerRef.current) clearInterval(simStreamTimerRef.current);
    isTestingRef.current = false;
    setTestState("idle");
    setTimeLeft(10.0);
    setProgress(0);
    setChart([]);
    setTenSecAverages(null);
    testReadingsRef.current = [];
    toast.info("10-second test cancelled.");
  };

  // ---- Prediction & Database Integration ----
  const runPrediction = async () => {
    if (!selected) {
      toast.error("Please select a patient first.");
      return;
    }
    if (testState !== "completed" || !testReadingsRef.current.length) {
      toast.error("Please run and complete a 10-second screening test first.");
      return;
    }

    setPredicting(true);
    try {
      const readings = testReadingsRef.current.map((r) => ({
        acc_x: r.acc_x,
        acc_y: r.acc_y,
        acc_z: r.acc_z,
        gyro_x: r.gyro_x,
        gyro_y: r.gyro_y,
        gyro_z: r.gyro_z,
        timestamp: r.timestamp || new Date().toISOString(),
      }));

      // 1. Store session in imu_sessions schema
      try {
        await api.post("/imu-sessions", {
          patient_id: selected,
          session_id: sessionId,
          timestamp: new Date().toISOString(),
          duration_sec: 10.0,
          acc_x_avg: tenSecAverages?.acc_x || 0,
          acc_y_avg: tenSecAverages?.acc_y || 0,
          acc_z_avg: tenSecAverages?.acc_z || 0,
          gyro_x_avg: tenSecAverages?.gyro_x || 0,
          gyro_y_avg: tenSecAverages?.gyro_y || 0,
          gyro_z_avg: tenSecAverages?.gyro_z || 0,
          raw_stream: readings,
          is_simulated: source === "sim",
        });
      } catch (saveErr) {
        console.warn("Could not save to imu_sessions collection:", saveErr);
      }

      // 2. Submit to OA prediction engine
      const { data } = await api.post("/screenings", {
        patient_id: selected,
        readings,
        imu_averages: tenSecAverages,
        session_id: sessionId,
        is_simulated: source === "sim",
      });

      toast.success("Multimodal Prediction Complete & Session Saved!");
      navigate(`/app/result/${data.id}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setPredicting(false);
    }
  };

  // ---- Dataset Upload ----
  const onDatasetFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      setPreview({ headers, rows });
      const means = computeSensorMeans(headers, rows);
      const fd = new FormData();
      fd.append("file", file);
      let rowCount = rows.length;
      try {
        const { data } = await api.post("/dataset/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        rowCount = data.row_count ?? rowCount;
        toast.success(`Dataset saved: ${rowCount} rows`);
      } catch {
        toast.warning("Saved locally; backend upload needs doctor/admin role");
      }
      saveDatasetMeans(means, file.name, rowCount);
      setDataset(loadDatasetMeans());
    } catch (err) {
      toast.error("Could not parse CSV");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Helper for metrics display:
  // Disconnected / Idle: 0.00
  // Running: live packet value
  // Completed: frozen 10-second calculated average
  const getMetricValue = (key) => {
    if (testState === "completed" && tenSecAverages) {
      return tenSecAverages[key] != null ? Number(tenSecAverages[key]).toFixed(2) : "0.00";
    }
    if (testState === "running" && latest) {
      return latest[key] != null ? Number(latest[key]).toFixed(2) : "0.00";
    }
    return "0.00";
  };

  const SensorTile = ({ a }) => {
    const val = getMetricValue(a.key);
    const isAveraged = testState === "completed";
    return (
      <div className="bg-white rounded-2xl border border-emerald-900/10 p-3.5 text-center shadow-sm relative overflow-hidden transition-all">
        {isAveraged && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
            10s Avg
          </span>
        )}
        <p className="text-xs text-muted-foreground font-medium">{a.label}</p>
        <p
          className={`font-mono text-xl font-bold mt-0.5 ${val !== "0.00" ? "text-emerald-700" : "text-slate-500"}`}
          data-testid={`sensor-${a.key}`}
        >
          {val}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{a.unit}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Status Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900">Live Sensor Screening</h1>
          <p className="text-slate-600">Controlled 10-second MPU6050 test protocol with kinematic average computation.</p>
        </div>

        {/* Connection Status Indicator */}
        <div>
          {tab === "bluetooth" ? (
            !connected || source !== "ble" ? (
              <span
                data-testid="sensor-connection-status"
                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Sensor Disconnected / Awaiting BLE Pair
              </span>
            ) : (
              <span
                data-testid="sensor-connection-status"
                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                BLE Connected · {bleName || "ESP32 (MPU6050)"}
              </span>
            )
          ) : tab === "simulator" ? (
            !connected || source !== "sim" ? (
              <span
                data-testid="sensor-connection-status"
                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full bg-slate-100 text-slate-600 border border-slate-200"
              >
                <RadioTower className="w-3.5 h-3.5 text-slate-500" />
                Simulator Idle · Click Connect
              </span>
            ) : (
              <span
                data-testid="sensor-connection-status"
                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200"
              >
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                Simulator Active (50Hz Synthetic)
              </span>
            )
          ) : null}
        </div>
      </div>

      {/* Patient Selection Card */}
      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
        <label className="text-sm font-medium text-slate-700">Patient Identifier</label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="mt-1.5 h-11 rounded-xl max-w-md" data-testid="screening-patient-select">
            <SelectValue placeholder="Select patient for IMU screening" />
          </SelectTrigger>
          <SelectContent>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} · {p.age}y ({p.village || "Rural Health Clinic"})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mode Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="bluetooth" data-testid="tab-bluetooth">
            <Bluetooth className="w-4 h-4 mr-1.5" /> Bluetooth (Hardware)
          </TabsTrigger>
          <TabsTrigger value="simulator" data-testid="tab-simulator">
            <RadioTower className="w-4 h-4 mr-1.5" /> Simulator (Demo)
          </TabsTrigger>
          <TabsTrigger value="dataset" data-testid="tab-dataset">
            <Database className="w-4 h-4 mr-1.5" /> Dataset Reference
          </TabsTrigger>
        </TabsList>

        {/* Bluetooth Content */}
        <TabsContent value="bluetooth" className="mt-4">
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex flex-wrap items-center gap-4">
            <Bluetooth className="w-6 h-6 text-primary flex-shrink-0" />
            <p className="text-sm text-slate-600 flex-1 min-w-[220px]">
              Scan and pair with the <strong>ESP32 + MPU6050</strong> wearable IMU over Web Bluetooth (Nordic UART Service). Disconnected by default; auto-simulator fallback is strictly disabled.
            </p>
            {!connected || source !== "ble" ? (
              <Button className="rounded-xl h-11 px-5" onClick={connectBluetooth} data-testid="ble-connect-button">
                <Bluetooth className="w-4 h-4 mr-2" /> Scan & Connect
              </Button>
            ) : (
              <Button className="rounded-xl h-11 px-5" variant="outline" onClick={disconnect} data-testid="ble-disconnect-button">
                Disconnect BLE
              </Button>
            )}
          </div>
          {!bleSupported() && (
            <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2">
              Web Bluetooth requires Google Chrome, Microsoft Edge, or Android Chrome over HTTPS or localhost.
            </p>
          )}
        </TabsContent>

        {/* Simulator Content */}
        <TabsContent value="simulator" className="mt-4 space-y-4">
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex flex-wrap items-center gap-4">
            <RadioTower className="w-6 h-6 text-primary flex-shrink-0" />
            <p className="text-sm text-slate-600 flex-1 min-w-[200px]">
              Explicit Synthetic Simulator: generates 50Hz kinematic MPU6050 patterns with configurable joint instability for testing.
            </p>
            {!connected || source !== "sim" ? (
              <Button className="rounded-xl h-11 px-5" onClick={connectSim} data-testid="connect-sensor-button">
                <RadioTower className="w-4 h-4 mr-2" /> Connect Simulator
              </Button>
            ) : (
              <Button className="rounded-xl h-11 px-5" variant="outline" onClick={disconnect}>
                Disconnect Simulator
              </Button>
            )}
          </div>
          {connected && source === "sim" && (
            <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">Simulated movement severity</p>
                <span className="font-mono text-sm text-primary font-bold">{Math.round(severity * 100)}%</span>
              </div>
              <Slider
                value={[severity]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v) => setSeverity(v[0])}
                data-testid="severity-slider"
              />
            </div>
          )}
        </TabsContent>

        {/* Dataset Reference Content */}
        <TabsContent value="dataset" className="mt-4 space-y-4">
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Database className="w-6 h-6 text-primary flex-shrink-0" />
                <p className="text-sm text-slate-600 max-w-lg">
                  Upload historical MPU6050 / OA data CSV. Column means serve as the normative baseline for calculating delta differences against the 10-second test run.
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onDatasetFile} data-testid="dataset-file-input" />
              <Button className="rounded-xl h-11 px-5" disabled={uploading} onClick={() => fileRef.current?.click()} data-testid="dataset-upload-button">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />} Upload CSV
              </Button>
            </div>
            {dataset && (
              <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3" data-testid="dataset-loaded">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span><b>{dataset.filename}</b> · {dataset.rowCount} rows · {Object.keys(dataset.means).length} reference columns</span>
              </div>
            )}
          </div>

          {dataset && Object.keys(dataset.means).length > 0 && (
            <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
              <h3 className="font-heading font-semibold text-slate-800 mb-3">Dataset Reference Means</h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {AXES.map((a) => (
                  <div key={a.key} className="text-center bg-muted rounded-xl p-2.5" data-testid={`dataset-mean-${a.key}`}>
                    <p className="text-xs text-muted-foreground">{a.label}</p>
                    <p className="font-mono font-bold text-slate-800 mt-1">{dataset.means[a.key] ?? "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview && (
            <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 overflow-x-auto jc-scrollbar">
              <h3 className="font-heading font-semibold text-slate-800 mb-3">Preview (first 8 rows)</h3>
              <table className="w-full text-sm" data-testid="dataset-preview-table">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    {preview.headers.map((h) => <th key={h} className="py-2 px-3 whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 8).map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {preview.headers.map((h) => <td key={h} className="py-2 px-3 whitespace-nowrap font-mono text-slate-700">{String(row[h])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Controlled 10-Second Test Protocol Card */}
      {tab !== "dataset" && (
        <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <Timer className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-bold text-slate-900 text-lg">
                  10-Second Screening Protocol
                </h3>
                {testState === "completed" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    10s Test Complete · Metrics Frozen
                  </span>
                )}
                {testState === "running" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                    Recording Stream...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Captures a timed 10-second data window from the MPU6050, automatically computes axial averages, freezes the final display, and prepares payload for OA prediction.
              </p>
            </div>

            {/* Test Controls */}
            <div className="flex items-center gap-3">
              {testState === "idle" && (
                <Button
                  className="rounded-xl h-11 px-6 font-semibold shadow-sm"
                  disabled={!connected || !selected}
                  onClick={start10sTest}
                  data-testid="start-10s-test-button"
                >
                  <Play className="w-4 h-4 mr-2" /> Start 10s Screening Test
                </Button>
              )}

              {testState === "running" && (
                <Button
                  variant="destructive"
                  className="rounded-xl h-11 px-6 font-semibold animate-pulse"
                  onClick={cancel10sTest}
                  data-testid="cancel-test-button"
                >
                  <Square className="w-4 h-4 mr-2" /> Cancel Test
                </Button>
              )}

              {testState === "completed" && (
                <Button
                  variant="outline"
                  className="rounded-xl h-11 px-5 font-semibold text-slate-700"
                  onClick={start10sTest}
                  data-testid="rerun-10s-test-button"
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> Re-run 10s Test
                </Button>
              )}
            </div>
          </div>

          {/* Countdown & Visual Progress Bar */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">
                {testState === "running"
                  ? "Recording live MPU6050 kinematics... Have patient perform knee flexion / gait."
                  : testState === "completed"
                  ? `Completed 10.0s Window (${testReadingsRef.current.length} packets collected) — Display Frozen`
                  : !connected
                  ? "Controls locked: Connect hardware or simulator to enable test"
                  : !selected
                  ? "Controls locked: Select patient above to enable test"
                  : "Ready to start 10-second controlled screening"}
              </span>
              <span className="font-mono text-sm text-primary font-bold">
                {testState === "running"
                  ? `${timeLeft.toFixed(1)}s remaining`
                  : testState === "completed"
                  ? "10.0s / 10.0s (100%)"
                  : "10.0s Test Window"}
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  testState === "completed"
                    ? "bg-emerald-600"
                    : testState === "running"
                    ? "bg-primary"
                    : "bg-slate-300"
                }`}
                style={{ width: `${testState === "idle" ? 0 : progress}%` }}
              />
            </div>
          </div>

          {!connected && tab === "bluetooth" && (
            <div className="text-xs text-amber-800 bg-amber-50 rounded-xl p-3.5 border border-amber-200 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>
                <strong>Hardware Disconnected:</strong> Bluetooth pairing required before test controls can be enabled. Click <strong>Scan & Connect</strong> above, or switch to the <strong>Simulator</strong> tab for synthetic evaluation.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Visualizations & Metrics Cards (bluetooth + simulator) */}
      {tab !== "dataset" && (
        <>
          {/* Live / Frozen 6-Axis Metric Cards */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {AXES.map((a) => (
              <SensorTile key={a.key} a={a} />
            ))}
          </div>

          {/* Real-time / Frozen Complete 10s Line Graphs */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold text-slate-800">
                  Accelerometer (m/s²)
                </h3>
                {testState === "completed" && (
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-600" /> Complete 10s Window Locked
                  </span>
                )}
              </div>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="t" hide />
                    <YAxis fontSize={11} domain={["auto", "auto"]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="accX" stroke="#10B981" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="accY" stroke="#0F766E" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="accZ" stroke="#F59E0B" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold text-slate-800">
                  Gyroscope (°/s)
                </h3>
                {testState === "completed" && (
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-600" /> Complete 10s Window Locked
                  </span>
                )}
              </div>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="t" hide />
                    <YAxis fontSize={11} domain={["auto", "auto"]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="gyroX" stroke="#F97316" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="gyroY" stroke="#EF4444" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="gyroZ" stroke="#0EA5E9" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 10-Second Mean Average vs Dataset Reference Summary Table */}
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
            <h3 className="font-heading font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              10-Second Computed Mean Values {dataset ? "vs Dataset Baseline" : ""}
            </h3>
            <div className="overflow-x-auto jc-scrollbar">
              <table className="w-full text-sm" data-testid="rolling-comparison-table">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2.5 px-3">Kinematic Axis</th>
                    <th className="py-2.5 px-3">10s Test Mean</th>
                    {dataset && <th className="py-2.5 px-3">Dataset Reference Mean</th>}
                    {dataset && <th className="py-2.5 px-3">Δ Difference</th>}
                  </tr>
                </thead>
                <tbody>
                  {AXES.map((a) => {
                    const avg = tenSecAverages?.[a.key];
                    const refMean = dataset?.means?.[a.key];
                    const diff = avg != null && refMean != null ? +(avg - refMean).toFixed(2) : null;
                    return (
                      <tr key={a.key} className="border-b last:border-0" data-testid={`rolling-${a.key}`}>
                        <td className="py-2 px-3 text-slate-700 font-medium">
                          {a.label} ({a.unit})
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                          {avg != null ? Number(avg).toFixed(2) : testState === "running" ? "Calculating..." : "0.00"}
                        </td>
                        {dataset && <td className="py-2 px-3 font-mono">{refMean ?? "—"}</td>}
                        {dataset && (
                          <td
                            className={`py-2 px-3 font-mono ${
                              diff != null && Math.abs(diff) > 5 ? "text-orange-600 font-bold" : "text-slate-500"
                            }`}
                          >
                            {diff != null ? diff : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {testState !== "completed" && (
              <p className="text-xs text-muted-foreground mt-2.5">
                Run and complete the 10-second test protocol above to generate frozen 10-second averages.
              </p>
            )}
          </div>

          {/* Bottom Sticky Action Bar */}
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4 sticky bottom-4">
            <div className="flex items-center gap-3 text-slate-700">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Session Telemetry</p>
                <p className="text-sm font-semibold">
                  <span className="font-mono text-primary font-bold" data-testid="reading-count">
                    {testReadingsRef.current.length}
                  </span> packets collected
                  {testState === "completed" && " · 10s Window Locked"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {testState !== "completed" && (
                <span className="text-xs text-slate-500 hidden sm:inline">
                  Complete 10s test to unlock prediction
                </span>
              )}
              <Button
                size="lg"
                className="rounded-xl h-12 px-8 font-semibold shadow-md"
                onClick={runPrediction}
                disabled={predicting || testState !== "completed" || !testReadingsRef.current.length}
                data-testid="run-prediction-button"
              >
                {predicting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Processing Prediction...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Run OA Prediction
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
