import React, { useEffect, useRef, useState } from "react";
import { Terminal, Pause, Play, Eraser } from "lucide-react";

/**
 * Live view of what the IMU actually sends, like the Arduino Serial Monitor:
 * every packet as received, marked as decoded, not recognised, or cut off.
 */
export default function SerialMonitor({ lines, stats, profile, onClear }) {
  const [paused, setPaused] = useState(false);
  const [shown, setShown] = useState(lines);
  const boxRef = useRef(null);

  useEffect(() => { if (!paused) setShown(lines); }, [lines, paused]);
  useEffect(() => {
    const el = boxRef.current;
    if (el && !paused) el.scrollTop = el.scrollHeight;
  }, [shown, paused]);

  const Stat = ({ label, value, warn }) => (
    <span className={`rounded-lg px-2 py-1 font-mono ${warn ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
      {label}: <strong>{value}</strong>
    </span>
  );

  return (
    <section aria-labelledby="serial-monitor" className="rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 text-xs">
        <h3 id="serial-monitor" className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 mr-auto">
          <Terminal className="h-4 w-4" aria-hidden="true" /> Serial monitor
          {profile && <span className="font-normal text-slate-500">· {profile}</span>}
        </h3>
        <Stat label="Received" value={stats.received} />
        <Stat label="Decoded" value={stats.decoded} warn={stats.received > 0 && stats.decoded === 0} />
        <Stat label="Not recognised" value={stats.unrecognised} warn={stats.unrecognised > 0} />
        {stats.truncated > 0 && <Stat label="Cut off" value={stats.truncated} warn />}
        <button type="button" onClick={() => setPaused((p) => !p)}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={onClear}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Eraser className="h-3.5 w-3.5" aria-hidden="true" /> Clear
        </button>
      </div>
      <div ref={boxRef} className="h-56 overflow-y-auto bg-slate-950 p-3 font-mono text-[11px] leading-5" data-testid="serial-monitor"
        role="log" aria-live="off" aria-label="Raw packets from the IMU">
        {shown.length === 0 ? (
          <p className="text-slate-500">Nothing received yet.</p>
        ) : shown.map((l) => (
          <div key={l.id} className={l.ok ? "text-emerald-300" : l.info ? "text-sky-300" : "text-amber-300"}>
            <span className="text-slate-500">{l.time} </span>
            {l.text}
            {!l.ok && !l.info && <span className="text-red-400">{l.truncated ? "  ← cut off at 20 bytes" : "  ← not recognised"}</span>}
          </div>
        ))}
      </div>
      <p className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">
        Green = decoded sensor reading · blue = device status message · yellow = data the app could not read.
      </p>
    </section>
  );
}
