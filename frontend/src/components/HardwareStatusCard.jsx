import React from "react";
import { Cpu, Radio, Activity, Clock, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from "lucide-react";

export default function HardwareStatusCard({ status = {}, isDemo = false }) {
  const isConnected = status.connected ?? false;
  const esp32Status = isConnected ? "CONNECTED" : isDemo ? "DEMO MODE" : "DISCONNECTED";
  const mpuStatus = isConnected ? "CONNECTED" : isDemo ? "DEMO MODE" : "NOT DETECTED";
  const bleStatus = isConnected ? "CONNECTED" : isDemo ? "SIMULATED" : "DISCONNECTED";

  const rateHz = isConnected ? (status.samplingRateHz || 50) : isDemo ? 50 : 0;
  const packets = status.packetCount || 0;
  const lastPacket = status.lastTimestamp ? `${status.lastTimestamp} ms` : isConnected ? "Active" : "—";
  const lossPct = isConnected ? "0.2%" : "—";

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${isConnected ? "bg-emerald-500/10 text-emerald-600" : isDemo ? "bg-amber-500/10 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-slate-900 dark:text-white text-base">
              Hardware Diagnostic Status
            </h3>
            <p className="text-xs text-slate-500">
              ESP32 + MPU6050 Wearable Sensor Unit (GPIO21/22)
            </p>
          </div>
        </div>

        {isConnected ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            LIVE HARDWARE
          </span>
        ) : isDemo ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            DEMO MODE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            HARDWARE OFFLINE
          </span>
        )}
      </div>

      {/* Grid of hardware signals */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">ESP32 Core</span>
            {isConnected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <XCircle className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <p className={`mt-1 font-mono text-sm font-bold ${isConnected ? "text-emerald-700" : isDemo ? "text-amber-700" : "text-slate-500"}`}>
            {esp32Status}
          </p>
        </div>

        <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">MPU6050 (I2C)</span>
            {isConnected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <XCircle className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <p className={`mt-1 font-mono text-sm font-bold ${isConnected ? "text-emerald-700" : isDemo ? "text-amber-700" : "text-slate-500"}`}>
            {mpuStatus}
          </p>
        </div>

        <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">BLE GATT</span>
            <Radio className={`w-4 h-4 ${isConnected ? "text-emerald-600 animate-pulse" : "text-slate-400"}`} />
          </div>
          <p className={`mt-1 font-mono text-sm font-bold ${isConnected ? "text-emerald-700" : isDemo ? "text-amber-700" : "text-slate-500"}`}>
            {bleStatus}
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-slate-100 dark:border-slate-800">
        <div className="p-2">
          <span className="text-[11px] text-slate-500 block">Sampling Rate</span>
          <span className="font-mono text-base font-bold text-slate-800 dark:text-slate-200">
            {rateHz ? `${rateHz} Hz` : "0 Hz"}
          </span>
        </div>
        <div className="p-2">
          <span className="text-[11px] text-slate-500 block">Packets</span>
          <span className="font-mono text-base font-bold text-slate-800 dark:text-slate-200">
            {packets}
          </span>
        </div>
        <div className="p-2">
          <span className="text-[11px] text-slate-500 block">Packet Loss</span>
          <span className="font-mono text-base font-bold text-slate-800 dark:text-slate-200">
            {lossPct}
          </span>
        </div>
        <div className="p-2">
          <span className="text-[11px] text-slate-500 block">Last Packet</span>
          <span className="font-mono text-base font-bold text-slate-800 dark:text-slate-200 truncate block">
            {lastPacket}
          </span>
        </div>
      </div>
    </div>
  );
}
