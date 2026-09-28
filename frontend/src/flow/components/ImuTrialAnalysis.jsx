import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Legend, Tooltip } from "recharts";
import { Activity, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { imuTrialStats, interpretImuTrial } from "../imuStats";

const G = 9.80665;
const ROWS = [
  ["accX", "Acc X", "g"], ["accY", "Acc Y", "g"], ["accZ", "Acc Z", "g"],
  ["gyroX", "Gyro X", "°/s"], ["gyroY", "Gyro Y", "°/s"], ["gyroZ", "Gyro Z", "°/s"],
];
const MAX_POINTS = 400;

/** Analysis of the latest IMU trial: real averages, the recorded signal, and what it means. */
export default function ImuTrialAnalysis({ trial }) {
  const st = useMemo(() => (trial ? imuTrialStats(trial.samples || []) : null), [trial]);
  const data = useMemo(() => {
    if (!trial?.samples?.length) return [];
    const s = trial.samples;
    const step = Math.max(1, Math.ceil(s.length / MAX_POINTS));
    const out = [];
    for (let i = 0; i < s.length; i += step) {
      const p = s[i];
      out.push({ t: +(p.t / 1000).toFixed(2), ax: +(p.ax / G).toFixed(3), ay: +(p.ay / G).toFixed(3), az: +(p.az / G).toFixed(3),
        gx: +p.gx.toFixed(1), gy: +p.gy.toFixed(1), gz: +p.gz.toFixed(1) });
    }
    return out;
  }, [trial]);
  if (!trial || !st) return null;
  const notes = interpretImuTrial(st, trial.summary);
  const cell = (v) => (v == null ? "—" : v);

  return (
    <section aria-labelledby="imu-trial-analysis" className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm space-y-4"
      data-testid="imu-trial-analysis">
      <div className="flex flex-wrap items-center gap-2">
        <Activity className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        <h2 id="imu-trial-analysis" className="font-heading text-lg font-semibold text-slate-900 mr-auto">
          IMU trial {trial.index} analysis{trial.accepted ? "" : " (not usable)"}
        </h2>
        <span className="font-mono text-xs text-slate-500">
          {st.durationSec}s · {st.samples} readings · {st.rateHz} readings/s
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[["Acceleration (g)", ["ax", "ay", "az"], ["#10B981", "#0F766E", "#F59E0B"]],
          ["Rotation (°/s)", ["gx", "gy", "gz"], ["#F97316", "#EF4444", "#0EA5E9"]]].map(([title, keys, colors]) => (
          <figure key={title} className="rounded-xl border border-slate-200 p-3">
            <figcaption className="text-sm font-semibold text-slate-700 mb-1">{title} · recorded trial</figcaption>
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} fontSize={11} unit="s" />
                  <YAxis fontSize={11} width={44} />
                  <Tooltip formatter={(v) => v} labelFormatter={(l) => `${l} s`} />
                  <Legend />
                  {keys.map((k, j) => (
                    <Line key={k} dataKey={k} stroke={colors[j]} isAnimationActive={false} strokeWidth={1.5}
                      dot={data.length <= 60 ? { r: 2 } : false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </figure>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Averages of the real readings in this trial</caption>
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th scope="col" className="py-2 pr-3 font-medium">Axis</th>
              <th scope="col" className="py-2 pr-3 font-medium text-right">Average</th>
              <th scope="col" className="py-2 pr-3 font-medium text-right">Min</th>
              <th scope="col" className="py-2 pr-3 font-medium text-right">Max</th>
              <th scope="col" className="py-2 font-medium text-right">Variation (SD)</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {ROWS.map(([k, label, unit]) => {
              const a = st.axes[k];
              return (
                <tr key={k} className="border-b border-slate-100">
                  <th scope="row" className="py-1.5 pr-3 text-left font-sans font-normal text-slate-700">{label} ({unit})</th>
                  <td className="py-1.5 pr-3 text-right font-semibold text-slate-900">{cell(a.mean)}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-600">{cell(a.min)}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-600">{cell(a.max)}</td>
                  <td className="py-1.5 text-right text-slate-600">{cell(a.sd)}</td>
                </tr>
              );
            })}
            <tr className="border-b border-slate-100 bg-slate-50">
              <th scope="row" className="py-1.5 pr-3 text-left font-sans font-normal text-slate-700">Total acceleration (g)</th>
              <td className="py-1.5 pr-3 text-right font-semibold text-slate-900">{cell(st.accMagnitude.mean)}</td>
              <td className="py-1.5 pr-3 text-right text-slate-600">{cell(st.accMagnitude.min)}</td>
              <td className="py-1.5 pr-3 text-right text-slate-600">{cell(st.accMagnitude.max)}</td>
              <td className="py-1.5 text-right text-slate-600">{cell(st.accMagnitude.sd)}</td>
            </tr>
            <tr className="bg-slate-50">
              <th scope="row" className="py-1.5 pr-3 text-left font-sans font-normal text-slate-700">Total rotation (°/s)</th>
              <td className="py-1.5 pr-3 text-right font-semibold text-slate-900">{cell(st.gyroMagnitude.mean)}</td>
              <td className="py-1.5 pr-3 text-right text-slate-600">{cell(st.gyroMagnitude.min)}</td>
              <td className="py-1.5 pr-3 text-right text-slate-600">{cell(st.gyroMagnitude.max)}</td>
              <td className="py-1.5 text-right text-slate-600">{cell(st.gyroMagnitude.sd)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul className="space-y-1.5 text-sm" aria-label="What this trial shows">
        {notes.map((n) => (
          <li key={n.text} className={`flex items-start gap-2 ${n.ok === null ? "text-slate-600" : n.ok ? "text-emerald-900" : "text-amber-900"}`}>
            {n.ok === null
              ? <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              : n.ok
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />}
            {n.text}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        Averages use only the real readings received in this trial. Acceleration is shown in g and rotation in °/s,
        the same units the ESP32 prints, so the numbers can be checked against its Serial Monitor.
      </p>
    </section>
  );
}
