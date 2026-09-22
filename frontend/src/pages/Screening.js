import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, wsSensorUrl, formatApiError } from "@/lib/api";
import { makeReading } from "@/lib/sensor";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";
import { Wifi, WifiOff, Play, Square, Zap, Loader2, Activity, RadioTower } from "lucide-react";

const MAX_POINTS = 40;

export default function Screening() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(patientId || "");
  const [sessionId] = useState(() => `sess-${Math.random().toString(36).slice(2, 10)}`);

  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [severity, setSeverity] = useState(0.35);
  const [chart, setChart] = useState([]);
  const [latest, setLatest] = useState(null);
  const [count, setCount] = useState(0);
  const [predicting, setPredicting] = useState(false);

  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const readingsRef = useRef([]);

  useEffect(() => {
    api.get("/patients").then((r) => setPatients(r.data));
  }, []);

  const connect = () => {
    const ws = new WebSocket(wsSensorUrl(sessionId));
    ws.onopen = () => { setConnected(true); toast.success("Sensor connected"); };
    ws.onclose = () => { setConnected(false); setStreaming(false); };
    ws.onerror = () => { setConnected(false); toast.error("WebSocket error"); };
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === "reading") {
        setLatest(msg);
        readingsRef.current.push(msg);
        setCount(readingsRef.current.length);
        setChart((prev) => {
          const next = [...prev, {
            t: new Date(msg.timestamp).toLocaleTimeString().split(" ")[0],
            accX: msg.acc_x, accY: msg.acc_y, accZ: msg.acc_z,
            gyroX: msg.gyro_x, gyroY: msg.gyro_y, gyroZ: msg.gyro_z,
          }];
          return next.slice(-MAX_POINTS);
        });
      }
    };
    wsRef.current = ws;
  };

  const disconnect = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    wsRef.current?.close();
    setStreaming(false);
    setConnected(false);
  };

  useEffect(() => () => disconnect(), []); // cleanup on unmount

  const toggleStream = () => {
    if (streaming) {
      clearInterval(timerRef.current);
      setStreaming(false);
      return;
    }
    if (!connected) { toast.error("Connect the sensor first"); return; }
    setStreaming(true);
    timerRef.current = setInterval(() => {
      const reading = makeReading(severity);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(reading));
      }
    }, 250);
  };

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

  const SensorTile = ({ label, value, unit }) => (
    <div className="bg-white rounded-xl border border-emerald-900/10 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold text-slate-800" data-testid={`sensor-${label.toLowerCase().replace(/[ .]/g, "-")}`}>
        {value != null ? Number(value).toFixed(2) : "—"}
      </p>
      <p className="text-[10px] text-muted-foreground">{unit}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900">Live Sensor Screening</h1>
          <p className="text-slate-600">Stream MPU6050 data and run the OA prediction engine.</p>
        </div>
        <span
          data-testid="sensor-connection-status"
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full ${connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
        >
          {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {connected ? "Sensor Connected" : "Disconnected"}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="text-sm font-medium text-slate-700">Patient</label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="mt-1.5 h-11 rounded-xl" data-testid="screening-patient-select">
              <SelectValue placeholder="Select patient" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.age}y</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {!connected ? (
          <Button className="rounded-xl h-11" onClick={connect} data-testid="connect-sensor-button">
            <RadioTower className="w-4 h-4 mr-2" /> Connect Sensor
          </Button>
        ) : (
          <>
            <Button className="rounded-xl h-11" variant={streaming ? "destructive" : "default"} onClick={toggleStream} data-testid="stream-toggle-button">
              {streaming ? <><Square className="w-4 h-4 mr-2" /> Stop</> : <><Play className="w-4 h-4 mr-2" /> Start Stream</>}
            </Button>
            <Button className="rounded-xl h-11" variant="outline" onClick={disconnect}>Disconnect</Button>
          </>
        )}
      </div>

      {connected && (
        <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Simulated movement severity (for demo device)</p>
            <span className="font-mono text-sm text-primary">{Math.round(severity * 100)}%</span>
          </div>
          <Slider value={[severity]} min={0} max={1} step={0.01} onValueChange={(v) => setSeverity(v[0])} data-testid="severity-slider" />
          <p className="text-xs text-muted-foreground mt-2">Higher severity simulates more knee instability / tremor. A real MPU6050 device sends data to this same session over WebSocket.</p>
        </div>
      )}

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        <SensorTile label="Acc X" value={latest?.acc_x} unit="m/s²" />
        <SensorTile label="Acc Y" value={latest?.acc_y} unit="m/s²" />
        <SensorTile label="Acc Z" value={latest?.acc_z} unit="m/s²" />
        <SensorTile label="Gyro X" value={latest?.gyro_x} unit="°/s" />
        <SensorTile label="Gyro Y" value={latest?.gyro_y} unit="°/s" />
        <SensorTile label="Gyro Z" value={latest?.gyro_z} unit="°/s" />
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

      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4 sticky bottom-4">
        <div className="flex items-center gap-2 text-slate-600">
          <Activity className="w-5 h-5 text-primary" />
          <span className="font-mono font-semibold" data-testid="reading-count">{count}</span> readings captured
        </div>
        <Button size="lg" className="rounded-xl h-12 px-8" onClick={runPrediction} disabled={predicting} data-testid="run-prediction-button">
          {predicting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-5 h-5 mr-2" /> Run OA Prediction</>}
        </Button>
      </div>
    </div>
  );
}
