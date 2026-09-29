import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Bluetooth, FlaskConical, Play, Square, Unplug, Info, Usb, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectBLE, bleSupported, connectSerial, serialSupported } from "@/lib/ble";
import { useAssessment } from "../AssessmentContext";
import { USE_MOCK } from "../api";
import { imuTrialMetrics } from "../imuMetrics";
import { imuTrialStats, evenlySpaced } from "../imuStats";
import ImuTrialAnalysis from "../components/ImuTrialAnalysis";
import { startImuSimulator } from "../imuSimulator";
import FlowNav from "../components/FlowNav";
import TrialStrip from "../components/TrialStrip";
import SignalQuality from "../components/SignalQuality";
import SerialMonitor from "../components/SerialMonitor";
import { diagnose } from "../imuDiagnosis";

/** @typedef {import("../types").ImuTrial} ImuTrial */

const CHART_POINTS = 150;   // 3 s at 50 Hz
const MAX_TRIAL_MS = 20000; // auto-stop
const MIN_TRIAL_SEC = 3;    // shortest usable walk
const MIN_READINGS = 5;     // works even for slow (2 readings/s) sensors
const MONITOR_LINES = 200;
const EMPTY_STATS = { received: 0, decoded: 0, unrecognised: 0, truncated: 0 };

export default function Step3ImuCapture({ nav }) {
  const { draft, update } = useAssessment();
  const cameraUsable = draft.cameraTrials.filter((t) => t.accepted);
  const required = Math.min(cameraUsable.length, draft.trialsRequired);
  const trials = draft.imu?.trials || [];
  const usable = trials.filter((t) => t.accepted);

  const [device, setDevice] = useState(draft.imu?.device || null);
  const [connected, setConnected] = useState(false);
  const [chart, setChart] = useState([]);
  const [rate, setRate] = useState(0);
  const [stalled, setStalled] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const connRef = useRef(null);
  const liveRef = useRef([]);
  const lastPacketRef = useRef(0);
  const arrivalsRef = useRef([]);
  const recRef = useRef(null); // { startedAt, t0, dev0, samples: [] }
  const stopRef = useRef(null); // latest stopTrial, for the auto-stop timer
  const rawRef = useRef([]);
  const rawIdRef = useRef(0);
  const statsRef = useRef({ ...EMPTY_STATS });
  const lastBadRef = useRef("");
  const connectedAtRef = useRef(0);
  const [rawLines, setRawLines] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [profile, setProfile] = useState(null);
  const [sinceConnect, setSinceConnect] = useState(0);

  // Every packet as received (BLE or USB), for the serial monitor and diagnosis.
  const onRaw = (text, ok, meta = {}) => {
    const st = statsRef.current;
    st.received += 1;
    if (ok) st.decoded += 1;
    else if (!meta.info) {
      st.unrecognised += 1;
      if (meta.truncated) st.truncated += 1;
      lastBadRef.current = text.slice(0, 80);
    }
    rawRef.current.push({ id: ++rawIdRef.current, time: new Date().toLocaleTimeString(), text, ok, info: !!meta.info, truncated: !!meta.truncated });
    if (rawRef.current.length > MONITOR_LINES) rawRef.current.shift();
  };

  const resetMonitor = () => {
    rawRef.current = [];
    statsRef.current = { ...EMPTY_STATS };
    lastBadRef.current = "";
    setRawLines([]);
    setStats(EMPTY_STATS);
  };

  // One handler for BLE and simulator readings (already in m/s^2 and deg/s).
  const onReading = (r) => {
    const now = performance.now();
    lastPacketRef.current = now;
    arrivalsRef.current.push(now);
    const s = { ax: r.acc_x, ay: r.acc_y, az: r.acc_z, gx: r.gyro_x, gy: r.gyro_y, gz: r.gyro_z };
    liveRef.current.push(s);
    if (liveRef.current.length > CHART_POINTS) liveRef.current.shift();
    const rec = recRef.current;
    if (rec) {
      if (rec.dev0 == null && r.device_ms != null) rec.dev0 = r.device_ms;
      const t = r.device_ms != null && rec.dev0 != null ? r.device_ms - rec.dev0 : now - rec.t0;
      rec.samples.push({ t, ...s });
      if (r.device_ms != null) rec.lastDev = r.device_ms;
    }
  };

  // Chart + quality refresh (throttled, independent of the data rate).
  useEffect(() => {
    const iv = setInterval(() => {
      const now = performance.now();
      arrivalsRef.current = arrivalsRef.current.filter((t) => now - t <= 1000);
      setRate(arrivalsRef.current.length);
      setStalled(connected && now - lastPacketRef.current > 1500);
      setChart(liveRef.current.map((s, i) => ({ i, ...s })));
      setRawLines(rawRef.current.slice());
      setStats({ ...statsRef.current });
      if (connected) setSinceConnect(now - connectedAtRef.current);
      if (recRef.current) {
        const ms = now - recRef.current.t0;
        setElapsed(ms / 1000);
        if (ms >= MAX_TRIAL_MS) stopRef.current?.();
      }
    }, 150);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // Disconnect when leaving the step.
  useEffect(() => () => connRef.current?.disconnect?.(), []);

  const saveImu = (nextTrials, dev = device) =>
    update("imu", { imu: { device: dev, trials: nextTrials } }, { invalidate: true });

  const onLost = () => { setConnected(false); recRef.current = null; setRecording(false); toast.warning("IMU disconnected."); };

  const attach = (conn, source) => {
    connRef.current = conn;
    const dev = { name: conn.deviceName, source, connectedAt: new Date().toISOString() };
    connectedAtRef.current = performance.now();
    lastPacketRef.current = 0;
    liveRef.current = [];
    setSinceConnect(0);
    setProfile(conn.profile || null);
    setDevice(dev);
    setConnected(true);
    toast.success(`Connected to ${conn.deviceName}`);
  };

  const connectDevice = async () => {
    if (!bleSupported()) { toast.error("Web Bluetooth needs Chrome or Edge on Windows, Mac or Android."); return; }
    resetMonitor();
    try {
      attach(await connectBLE({ onReading, onRaw, onDisconnect: onLost }), "ble");
    } catch (e) {
      if (e?.name !== "NotFoundError") toast.error(e.message || "Bluetooth connection failed");
    }
  };

  const connectUsb = async () => {
    if (!serialSupported()) { toast.error("USB connection needs Chrome or Edge on a computer (not a phone)."); return; }
    resetMonitor();
    try {
      attach(await connectSerial({ onReading, onRaw, onDisconnect: onLost }), "usb");
    } catch (e) {
      if (e?.name !== "NotFoundError") toast.error(e.message || "USB connection failed");
    }
  };

  const connectSimulator = () => {
    if (!USE_MOCK && !window.confirm("Use the simulator? This screening will be marked as SIMULATED (demo) data.")) return;
    resetMonitor();
    setProfile(null);
    const stop = startImuSimulator(onReading);
    connRef.current = { disconnect: stop };
    const dev = { name: "IMU simulator", source: "simulator", connectedAt: new Date().toISOString() };
    setDevice(dev);
    setConnected(true);
    toast.info("Simulator connected. Recordings will be marked as demo data.");
  };

  const disconnect = () => {
    connRef.current?.disconnect?.();
    connRef.current = null;
    setConnected(false);
    recRef.current = null;
    setRecording(false);
  };

  const nextIndex = usable.length + 1;
  const pairedCamera = cameraUsable[nextIndex - 1];

  const startTrial = () => {
    if (!connected || stalled) {
      toast.error("No IMU data is arriving. See the message above the serial monitor for what to check.");
      return;
    }
    recRef.current = { startedAt: new Date().toISOString(), t0: performance.now(), dev0: null, samples: [] };
    setElapsed(0);
    setRecording(true);
  };

  function stopTrial() {
    const rec = recRef.current;
    recRef.current = null;
    setRecording(false);
    if (!rec) return;
    // Without the ESP32's own clock, readings are stamped when they reach the
    // browser, and Bluetooth delivers them in bursts. The sensor samples at a
    // steady rate, so spread the readings evenly over the recorded span.
    if (rec.dev0 == null) rec.samples = evenlySpaced(rec.samples);
    const st = imuTrialStats(rec.samples);
    // Cadence etc. only when the sensor is fast enough to resolve steps.
    const m = st.gaitMeasurable
      ? imuTrialMetrics(rec.samples)
      : { cadenceSpm: null, strideTimeCvPct: null, stepSymmetryPct: null, sampleRateHz: st.rateHz };
    const durMs = rec.samples.length ? rec.samples.at(-1).t : 0;
    let droppedPct = null;
    if (rec.dev0 != null && rec.lastDev != null && rec.samples.length > 1) {
      const expected = Math.round((rec.lastDev - rec.dev0) / 20) + 1;
      droppedPct = Math.max(0, (1 - rec.samples.length / expected) * 100);
    }
    const longEnough = durMs / 1000 >= MIN_TRIAL_SEC && rec.samples.length >= MIN_READINGS;
    const accepted = longEnough && st.moving;
    /** @type {ImuTrial & {accepted: boolean}} */
    const trial = {
      index: nextIndex,
      startedAt: rec.startedAt,
      durationSec: +(durMs / 1000).toFixed(1),
      samples: rec.samples,
      quality: {
        sampleRateHz: st.rateHz,
        droppedPct: droppedPct == null ? null : +droppedPct.toFixed(1),
        unitsDetected: "m/s^2",
        pairing: pairedCamera ? "paired" : "unpaired",
      },
      summary: { cadenceSpm: m.cadenceSpm, strideTimeCvPct: m.strideTimeCvPct, stepSymmetryPct: m.stepSymmetryPct, moving: st.moving },
      pairedCameraIndex: pairedCamera?.index ?? null,
      accepted,
    };
    saveImu([...trials, trial]);
    if (accepted) toast.success(`IMU trial ${trial.index} recorded: ${rec.samples.length} readings${m.cadenceSpm ? ` · cadence ${m.cadenceSpm} steps/min` : ""}.`);
    else toast.error(!longEnough
      ? `IMU trial not usable: only ${(durMs / 1000).toFixed(1)} s / ${rec.samples.length} readings. Record at least ${MIN_TRIAL_SEC} seconds of walking.`
      : "IMU trial not usable: no walking movement detected. The patient must walk during the trial.");
  }

  stopRef.current = stopTrial;

  const remove = (t) => {
    // Re-number remaining usable trials so pairing stays 1:1 with camera trials.
    let k = 0;
    const kept = trials.filter((x) => x !== t).map((x) => (x.accepted ? { ...x, index: ++k, pairedCameraIndex: cameraUsable[k - 1]?.index ?? null } : x));
    saveImu(kept);
  };

  const next = () => {
    if (usable.length < required) return;
    disconnect();
    update("imu", {}, { complete: true, invalidate: false });
    nav.goNext();
  };

  const lastDrop = usable.at(-1)?.quality.droppedPct ?? null;
  const pairing = usable.length >= required
    ? `All ${required} paired`
    : pairedCamera ? `Paired with camera trial ${pairedCamera.index}` : "No camera trial left";

  const problem = diagnose({ connected, source: device?.source, stats, sinceConnectMs: sinceConnect, sample: lastBadRef.current });

  const stripTrials = trials.map((t) => ({
    ...t,
    isDemo: device?.source === "simulator",
    detail: t.accepted
      ? `${t.samples?.length ?? 0} readings · ${t.durationSec}s${t.summary.cadenceSpm != null ? ` · ${t.summary.cadenceSpm} spm` : ""} · cam #${t.pairedCameraIndex ?? "—"}`
      : "Not usable",
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Strap the ESP32 sensor just below the knee of the <strong>{draft.patient.affectedSide}</strong> leg
          {draft.patient.affectedSide === "bilateral" ? " (right leg if both)" : ""}. Record one IMU walk for each of
          the <strong>{required}</strong> camera trials. IMU trials are <em>paired</em> with camera trials by number;
          they are separate walks, not time-synchronised recordings.
        </p>
      </div>

      <section aria-labelledby="imu-device" className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="imu-device" className="font-heading text-lg font-semibold text-slate-900 flex-1">
            Device {device ? <span className="font-normal text-slate-600">· {device.name}{device.source === "simulator" ? " (demo)" : ""}</span> : null}
          </h2>
          {!connected ? (
            <>
              <Button className="rounded-xl h-11" onClick={connectDevice} data-testid="imu-connect">
                <Bluetooth className="mr-2 h-4 w-4" aria-hidden="true" /> Connect ESP32 (Bluetooth)
              </Button>
              <Button variant="outline" className="rounded-xl h-11" onClick={connectUsb} data-testid="imu-connect-usb">
                <Usb className="mr-2 h-4 w-4" aria-hidden="true" /> Connect via USB cable
              </Button>
              <Button variant="outline" className="rounded-xl h-11" onClick={connectSimulator} data-testid="imu-simulator">
                <FlaskConical className="mr-2 h-4 w-4" aria-hidden="true" /> Use simulator
              </Button>
            </>
          ) : (
            <Button variant="outline" className="rounded-xl h-11" onClick={disconnect}>
              <Unplug className="mr-2 h-4 w-4" aria-hidden="true" /> Disconnect
            </Button>
          )}
        </div>

        <SignalQuality connected={connected} rateHz={rate} droppedPct={lastDrop} stalled={stalled} pairing={pairing} />

        {problem && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" data-testid="imu-diagnosis">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="font-semibold">{problem.title}</p>
              <ul className="mt-1 list-disc pl-5 space-y-0.5 break-words">
                {problem.tips.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2" aria-label="Live IMU signals">
          {[["Accelerometer (m/s²)", ["ax", "ay", "az"], ["#10B981", "#0F766E", "#F59E0B"]],
            ["Gyroscope (°/s)", ["gx", "gy", "gz"], ["#F97316", "#EF4444", "#0EA5E9"]]].map(([title, keys, colors]) => (
            <figure key={title} className="rounded-xl border border-slate-200 p-3">
              <figcaption className="text-sm font-semibold text-slate-700 mb-1">{title}</figcaption>
              <div style={{ width: "100%", height: 170 }}>
                <ResponsiveContainer>
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="i" hide />
                    <YAxis fontSize={11} width={40} />
                    <Legend />
                    {keys.map((k, j) => <Line key={k} dataKey={k} stroke={colors[j]} dot={false} isAnimationActive={false} strokeWidth={1.5} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!recording ? (
            <Button className="rounded-xl h-11" onClick={startTrial} disabled={!connected || usable.length >= required} data-testid="imu-start-trial">
              <Play className="mr-2 h-4 w-4" aria-hidden="true" />
              {usable.length >= required ? "All trials recorded" : `Start IMU trial ${nextIndex} (pairs with camera #${pairedCamera?.index ?? "—"})`}
            </Button>
          ) : (
            <Button variant="destructive" className="rounded-xl h-11" onClick={stopTrial} data-testid="imu-stop-trial">
              <Square className="mr-2 h-4 w-4" aria-hidden="true" /> Stop trial ({elapsed.toFixed(1)} s)
            </Button>
          )}
          {recording && <p className="text-sm text-slate-600" role="status">Recording… the patient walks the same path as camera trial {pairedCamera?.index}. Auto-stops at 20 s.</p>}
        </div>

        {device?.source !== "simulator" && (
          <SerialMonitor lines={rawLines} stats={stats} profile={connected ? profile : null}
            onClear={() => { rawRef.current = []; setRawLines([]); }} />
        )}
      </section>

      <ImuTrialAnalysis trial={trials.at(-1)} />

      <section aria-labelledby="imu-trials" className="rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm">
        <h2 id="imu-trials" className="sr-only">Recorded IMU trials</h2>
        <TrialStrip trials={stripTrials} required={required} onRemove={recording ? null : remove} label="IMU trial" />
        <p className="mt-3 text-xs text-slate-500">
          spm = steps per minute · CV = stride-time variability. Descriptive only: IMU values are not calibrated against reference data.
        </p>
      </section>

      <FlowNav onBack={() => { disconnect(); nav.goBack(); }} onNext={next} nextDisabled={usable.length < required || recording}
        hint={usable.length < required ? `${required - usable.length} more usable IMU trial(s) needed` : null}
        nextLabel="Continue to analysis" />
    </div>
  );
}
