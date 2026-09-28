import React from "react";
import { Signal, Timer, Link2, AlertTriangle } from "lucide-react";

/**
 * IMU link quality. Browsers do not expose Bluetooth signal strength (RSSI)
 * for a connected device, so packet rate and dropped samples stand in for it.
 */
export default function SignalQuality({ connected, rateHz, droppedPct, stalled, pairing }) {
  const rateOk = rateHz >= 1; // slow sensors (2 readings/s) are accepted for now
  const dropOk = droppedPct == null || droppedPct < 5;
  const Item = ({ icon: Icon, label, value, ok }) => (
    <div className={`rounded-xl border p-3 ${ok ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
      <p className="flex items-center gap-1.5 text-xs text-slate-600"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-bold ${ok ? "text-emerald-800" : "text-amber-800"}`}>{value}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="imu-quality" aria-live="polite">
      <Item icon={Signal} label="Link" ok={connected && !stalled}
        value={!connected ? "Not connected" : stalled ? "No data (stalled)" : "Receiving"} />
      <Item icon={Timer} label="Sample rate" ok={!connected || rateOk}
        value={connected ? `${rateHz.toFixed(0)} Hz ${rateOk ? "" : "(low)"}` : "—"} />
      <Item icon={AlertTriangle} label="Dropped samples" ok={dropOk}
        value={droppedPct == null ? "n/a" : `${droppedPct.toFixed(1)}%`} />
      <Item icon={Link2} label="Camera pairing" ok={pairing.startsWith("Paired") || pairing.startsWith("All")} value={pairing} />
    </div>
  );
}
