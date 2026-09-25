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
  Database, Upload, CheckCircle2, TrendingUp,
} from "lucide-react";

const MAX_POINTS = 40;
const ROLL_WINDOW = 75; // rolling average of last 50-100 readings

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

  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState(null); // 'ble' | 'sim'
  const [bleName, setBleName] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [severity, setSeverity] = useState(0.35);
  const [chart, setChart] = useState([]);
  const [latest, setLatest] = useState(null);
  const [rolling, setRolling] = useState(null);
  const [count, setCount] = useState(0);
  const [predicting, setPredicting] = useState(false);

  const [dataset, setDataset] = useState(loadDatasetMeans());
  const [preview, setPreview] = useState(null); // {headers, rows}
  const [uploading, setUploading] = useState(false);

  const wsRef = useRef(null);
  const bleRef = useRef(null);
  const timerRef = useRef(null);
  const readingsRef = useRef([]);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get("/patients").then((r) => setPatients(r.data));
    api.get("/dataset/info").catch(() => {});
  }, []);

  const computeRolling = () => {
    const win = readingsRef.current.slice(-ROLL_WINDOW);
    if (!win.length) return null;
    const sums = {};
    AXES.forEach((a) => (sums[a.key] = 0));
    win.forEach((r) => AXES.forEach((a) => (sums[a.key] += r[a.key] || 0)));
    const means = {};
    AXES.forEach((a) => (means[a.key] = +(sums[a.key] / win.length).toFixed(3)));
    means._n = win.length;
    return means;
  };

  const handleReading = (r) => {
    readingsRef.current.push(r);
    try { localStorage.setItem("jc_last_session", JSON.stringify(readingsRef.current.slice(-600))); } catch {}
    setLatest(r);
    setCount(readingsRef.current.length);
    setRolling(computeRolling());
    setChart((prev) => {
      const next = [...prev, {
        t: new Date(r.timestamp || Date.now()).toLocaleTimeString().split(" ")[0],
        accX: r.acc_x, accY: r.acc_y, accZ: r.acc_z, gyroX: r.gyro_x, gyroY: r.gyro_y, gyroZ: r.gyro_z,
      }];
      return next.slice(-MAX_POINTS);
    });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(r));
    }
  };

  const openWs = () => {
    const ws = new WebSocket(wsSensorUrl(sessionId));
    ws.onopen = () => {};
    ws.onmessage = () => {}; // echo ignored; we already have local readings
    wsRef.current = ws;
  };

  // ---- Simulator ----
  const connectSim = () => {
    openWs();
    setSource("sim");
    setConnected(true);
    toast.success("Simulator connected");
  };
  const toggleStream = () => {
    if (streaming) { clearInterval(timerRef.current); setStreaming(false); return; }
    setStreaming(true);
    timerRef.current = setInterval(() => handleReading(makeReading(severity)), 250);
  };

  // ---- Bluetooth ----
  const connectBluetooth = async () => {
    if (!bleSupported()) { toast.error("Web Bluetooth not supported. Use Chrome/Edge on desktop or Android."); return; }
    try {
      const conn = await connectBLE({
        onReading: handleReading,
        onDisconnect: () => { setConnected(false); setSource(null); toast.warning("BLE device disconnected"); },
      });
      openWs();
      bleRef.current = conn;
      setBleName(conn.deviceName);
      setSource("ble");
      setConnected(true);
      toast.success(`Connected to ${conn.deviceName}`);
    } catch (e) {
      toast.error(e.message || "BLE connection cancelled");
    }
  };

  const disconnect = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    bleRef.current?.disconnect?.();
    bleRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setStreaming(false);
    setConnected(false);
    setSource(null);
  };

  useEffect(() => () => disconnect(), []); // cleanup

  // ---- Dataset ----
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

  // ---- Prediction ----
  const runPrediction = async () => {
    if (!selected) { toast.error("Select a patient"); return; }
    if (readingsRef.current.length < 8) { toast.error("Capture more readings first (min 8)"); return; }
    disconnect();
    setPredicting(true);
    try {
      const readings = readingsRef.current.map((r) => ({
        acc_x: r.acc_x, acc_y: r.acc_y, acc_z: r.acc_z,
        gyro_x: r.gyro_x, gyro_y: r.gyro_y, gyro_z: r.gyro_z, timestamp: r.timestamp,
      }));
      const { data } = await api.post("/screenings", { patient_id: selected, readings });
      toast.success("Prediction complete");
      navigate(`/app/result/${data.id}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setPredicting(false);
    }
  };

  const SensorTile = ({ a }) => (
    <div className="bg-white rounded-xl border border-emerald-900/10 p-3 text-center">
      <p className="text-xs text-muted-foreground">{a.label}</p>
      <p className="font-mono text-lg font-semibold text-slate-800" data-testid={`sensor-${a.key}`}>
        {latest?.[a.key] != null ? Number(latest[a.key]).toFixed(2) : "—"}
      </p>
      <p className="text-[10px] text-muted-foreground">{a.unit}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900">Live Sensor Screening</h1>
          <p className="text-slate-600">Stream MPU6050 data via ESP32 BLE or simulator, then run the OA engine.</p>
        </div>
        <span
          data-testid="sensor-connection-status"
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full ${connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
        >
          {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {connected ? `Connected${source === "ble" ? ` · ${bleName}` : source === "sim" ? " · Simulator" : ""}` : "Disconnected"}
        </span>
      </div>

      {/* patient */}
      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
        <label className="text-sm font-medium text-slate-700">Patient</label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="mt-1.5 h-11 rounded-xl max-w-md" data-testid="screening-patient-select">
            <SelectValue placeholder="Select patient" />
          </SelectTrigger>
          <SelectContent>
            {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.age}y</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="bluetooth" data-testid="tab-bluetooth"><Bluetooth className="w-4 h-4 mr-1.5" /> Bluetooth</TabsTrigger>
          <TabsTrigger value="simulator" data-testid="tab-simulator"><RadioTower className="w-4 h-4 mr-1.5" /> Simulator</TabsTrigger>
          <TabsTrigger value="dataset" data-testid="tab-dataset"><Database className="w-4 h-4 mr-1.5" /> Dataset</TabsTrigger>
        </TabsList>

        {/* Bluetooth */}
        <TabsContent value="bluetooth" className="mt-4">
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex flex-wrap items-center gap-4">
            <Bluetooth className="w-6 h-6 text-primary" />
            <p className="text-sm text-slate-600 flex-1 min-w-[220px]">
              Scan and connect to your ESP32 (Nordic UART Service). It streams MPU6050 accelerometer & gyroscope data directly to the browser.
            </p>
            {!connected ? (
              <Button className="rounded-xl h-11" onClick={connectBluetooth} data-testid="ble-connect-button">
                <Bluetooth className="w-4 h-4 mr-2" /> Scan & Connect
              </Button>
            ) : (
              <Button className="rounded-xl h-11" variant="outline" onClick={disconnect} data-testid="ble-disconnect-button">Disconnect</Button>
            )}
          </div>
          {!bleSupported() && (
            <p className="text-xs text-amber-600 mt-2">Web Bluetooth requires Chrome/Edge (desktop) or Chrome on Android over HTTPS.</p>
          )}
        </TabsContent>

        {/* Simulator */}
        <TabsContent value="simulator" className="mt-4 space-y-4">
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex flex-wrap items-center gap-4">
            <RadioTower className="w-6 h-6 text-primary" />
            <p className="text-sm text-slate-600 flex-1 min-w-[200px]">Generate realistic MPU6050 readings for demo (no hardware needed).</p>
            {!connected ? (
              <Button className="rounded-xl h-11" onClick={connectSim} data-testid="connect-sensor-button"><RadioTower className="w-4 h-4 mr-2" /> Connect Simulator</Button>
            ) : (
              <>
                <Button className="rounded-xl h-11" variant={streaming ? "destructive" : "default"} onClick={toggleStream} data-testid="stream-toggle-button">
                  {streaming ? <><Square className="w-4 h-4 mr-2" /> Stop</> : <><Play className="w-4 h-4 mr-2" /> Start Stream</>}
                </Button>
                <Button className="rounded-xl h-11" variant="outline" onClick={disconnect}>Disconnect</Button>
              </>
            )}
          </div>
          {connected && source === "sim" && (
            <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">Simulated movement severity</p>
                <span className="font-mono text-sm text-primary">{Math.round(severity * 100)}%</span>
              </div>
              <Slider value={[severity]} min={0} max={1} step={0.01} onValueChange={(v) => setSeverity(v[0])} data-testid="severity-slider" />
            </div>
          )}
        </TabsContent>

        {/* Dataset */}
        <TabsContent value="dataset" className="mt-4 space-y-4">
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Database className="w-6 h-6 text-primary" />
                <p className="text-sm text-slate-600 max-w-lg">Upload a CSV of historical MPU6050 / OA data. Column means are computed automatically and used as the reference for comparison.</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onDatasetFile} data-testid="dataset-file-input" />
              <Button className="rounded-xl h-11" disabled={uploading} onClick={() => fileRef.current?.click()} data-testid="dataset-upload-button">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />} Upload CSV
              </Button>
            </div>
            {dataset && (
              <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3" data-testid="dataset-loaded">
                <CheckCircle2 className="w-4 h-4" /> <b>{dataset.filename}</b> · {dataset.rowCount} rows · {Object.keys(dataset.means).length} sensor columns
              </div>
            )}
          </div>

          {dataset && Object.keys(dataset.means).length > 0 && (
            <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
              <h3 className="font-heading font-semibold text-slate-800 mb-3">Dataset Column Means (reference)</h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {AXES.map((a) => (
                  <div key={a.key} className="text-center bg-muted rounded-xl p-2" data-testid={`dataset-mean-${a.key}`}>
                    <p className="text-xs text-muted-foreground">{a.label}</p>
                    <p className="font-mono font-semibold text-slate-800">{dataset.means[a.key] ?? "—"}</p>
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

      {/* Live visualization (bluetooth + simulator) */}
      {tab !== "dataset" && (
        <>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {AXES.map((a) => <SensorTile key={a.key} a={a} />)}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
              <h3 className="font-heading font-semibold text-slate-800 mb-3">Accelerometer</h3>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="t" hide /><YAxis fontSize={11} /><Tooltip /><Legend />
                    <Line type="monotone" dataKey="accX" stroke="#10B981" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="accY" stroke="#0F766E" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="accZ" stroke="#F59E0B" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
              <h3 className="font-heading font-semibold text-slate-800 mb-3">Gyroscope</h3>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="t" hide /><YAxis fontSize={11} /><Tooltip /><Legend />
                    <Line type="monotone" dataKey="gyroX" stroke="#F97316" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="gyroY" stroke="#EF4444" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="gyroZ" stroke="#0EA5E9" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Rolling average + dataset comparison */}
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
            <h3 className="font-heading font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Rolling Average (last {rolling?._n || 0} readings) {dataset ? "vs Dataset Mean" : ""}
            </h3>
            <div className="overflow-x-auto jc-scrollbar">
              <table className="w-full text-sm" data-testid="rolling-comparison-table">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 px-3">Axis</th>
                    <th className="py-2 px-3">Live Avg</th>
                    {dataset && <th className="py-2 px-3">Dataset Mean</th>}
                    {dataset && <th className="py-2 px-3">Δ Difference</th>}
                  </tr>
                </thead>
                <tbody>
                  {AXES.map((a) => {
                    const live = rolling?.[a.key];
                    const mean = dataset?.means?.[a.key];
                    const diff = live != null && mean != null ? +(live - mean).toFixed(3) : null;
                    return (
                      <tr key={a.key} className="border-b last:border-0" data-testid={`rolling-${a.key}`}>
                        <td className="py-2 px-3 text-slate-700">{a.label}</td>
                        <td className="py-2 px-3 font-mono">{live != null ? live : "—"}</td>
                        {dataset && <td className="py-2 px-3 font-mono">{mean ?? "—"}</td>}
                        {dataset && <td className={`py-2 px-3 font-mono ${diff != null && Math.abs(diff) > 5 ? "text-orange-600" : "text-slate-500"}`}>{diff != null ? diff : "—"}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!dataset && <p className="text-xs text-muted-foreground mt-2">Upload a CSV in the Dataset tab to enable live-vs-reference comparison.</p>}
          </div>

          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4 sticky bottom-4">
            <div className="flex items-center gap-2 text-slate-600">
              <Activity className="w-5 h-5 text-primary" />
              <span className="font-mono font-semibold" data-testid="reading-count">{count}</span> readings captured
            </div>
            <Button size="lg" className="rounded-xl h-12 px-8" onClick={runPrediction} disabled={predicting} data-testid="run-prediction-button">
              {predicting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-5 h-5 mr-2" /> Run OA Prediction</>}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
