import React, { useState, useEffect } from "react";
import { bleService } from "@/services/bleService";
import { exportIMUtoCSV } from "@/services/csvService";
import { Button } from "@/components/ui/button";
import { Bluetooth, BluetoothConnected, BluetoothOff, Download, Radio, AlertTriangle, Activity, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function BLEPanel({ onReading, readings = [] }) {
  const [status, setStatus] = useState(() => bleService.getStatus());
  const [connecting, setConnecting] = useState(false);
  const [latestPacket, setLatestPacket] = useState(null);

  useEffect(() => {
    const unsubReading = bleService.onReading((pkt) => {
      setLatestPacket(pkt);
      setStatus(bleService.getStatus());
      if (onReading) onReading(pkt);
    });

    const unsubDisc = bleService.onDisconnect(() => {
      setStatus(bleService.getStatus());
      toast.warning("OA_IMU disconnected.");
    });

    const interval = setInterval(() => {
      setStatus(bleService.getStatus());
    }, 1000);

    return () => {
      unsubReading();
      unsubDisc();
      clearInterval(interval);
    };
  }, [onReading]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await bleService.connect();
      setStatus(bleService.getStatus());
      toast.success(`Connected to ${res.deviceName} (50 Hz streaming active)`);
    } catch (err) {
      toast.error(err.message || "Could not connect to BLE device.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    bleService.disconnect();
    setStatus(bleService.getStatus());
    toast.info("Disconnected from OA_IMU.");
  };

  const handleExportCSV = () => {
    try {
      const { filename, count } = exportIMUtoCSV(readings.length > 0 ? readings : latestPacket ? [latestPacket] : []);
      toast.success(`Exported ${count} packets to ${filename}`);
    } catch (err) {
      toast.error(err.message || "Failed to export CSV.");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${status.connected ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"}`}>
            <Bluetooth className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-slate-900 dark:text-white text-lg">
                Wearable IMU Stream
              </h3>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                OA_IMU
              </span>
            </div>
            <p className="text-xs text-slate-500">
              ESP32 + MPU6050 6-DoF Wearable Kinematic Sensor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status.connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1.5"
            >
              <BluetoothOff className="w-4 h-4" />
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={connecting || !status.supported}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-sm"
            >
              {connecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Pairing...
                </>
              ) : (
                <>
                  <BluetoothConnected className="w-4 h-4" />
                  Connect OA_IMU (BLE)
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={readings.length === 0 && !latestPacket}
            className="gap-1.5"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {!status.supported && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Web Bluetooth Unsupported:</strong> BLE connection requires a compatible browser/device (Chrome, Edge, or Android Browser with Bluetooth enabled).
          </div>
        </div>
      )}

      {/* Sensor Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {/* Accel X */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-center">
          <span className="text-[11px] text-slate-500 font-medium block">AX (Accel X)</span>
          <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
            {latestPacket ? latestPacket.ax.toFixed(4) : "—"}
          </span>
          <span className="text-[10px] text-slate-400 block">g</span>
        </div>

        {/* Accel Y */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-center">
          <span className="text-[11px] text-slate-500 font-medium block">AY (Accel Y)</span>
          <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
            {latestPacket ? latestPacket.ay.toFixed(4) : "—"}
          </span>
          <span className="text-[10px] text-slate-400 block">g</span>
        </div>

        {/* Accel Z */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-center">
          <span className="text-[11px] text-slate-500 font-medium block">AZ (Accel Z)</span>
          <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
            {latestPacket ? latestPacket.az.toFixed(4) : "—"}
          </span>
          <span className="text-[10px] text-slate-400 block">g</span>
        </div>

        {/* Gyro X */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-center">
          <span className="text-[11px] text-slate-500 font-medium block">GX (Gyro X)</span>
          <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
            {latestPacket ? latestPacket.gx.toFixed(3) : "—"}
          </span>
          <span className="text-[10px] text-slate-400 block">°/s</span>
        </div>

        {/* Gyro Y */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-center">
          <span className="text-[11px] text-slate-500 font-medium block">GY (Gyro Y)</span>
          <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
            {latestPacket ? latestPacket.gy.toFixed(3) : "—"}
          </span>
          <span className="text-[10px] text-slate-400 block">°/s</span>
        </div>

        {/* Gyro Z */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-center">
          <span className="text-[11px] text-slate-500 font-medium block">GZ (Gyro Z)</span>
          <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
            {latestPacket ? latestPacket.gz.toFixed(3) : "—"}
          </span>
          <span className="text-[10px] text-slate-400 block">°/s</span>
        </div>
      </div>

      {/* Hardware Connection Info */}
      <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/40 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-600 dark:text-slate-400">
        <div>
          <span className="font-semibold text-slate-700 dark:text-slate-300">BLE UUID:</span>{" "}
          <span className="font-mono text-[11px]">12345678-1234-1234-1234-1234567890ab</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700 dark:text-slate-300">Packet Format:</span>{" "}
          <span className="font-mono text-[11px]">timestamp,ax,ay,az,gx,gy,gz</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700 dark:text-slate-300">Sampling:</span>{" "}
          <span className="font-mono font-bold text-emerald-600">50 Hz (20ms)</span>
        </div>
      </div>
    </div>
  );
}
