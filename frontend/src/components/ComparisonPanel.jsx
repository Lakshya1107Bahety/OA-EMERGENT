import React from "react";
import { Camera, Radio, Layers, CheckCircle2, ShieldCheck } from "lucide-react";

export default function ComparisonPanel({ comparison = {} }) {
  const cam = comparison.camera || {
    knee_rom: 52.4,
    gait_symmetry: 81.6,
    stride_duration: 1.06,
    cadence: 122.5,
    trunk_stability: 91.2,
  };

  const imu = comparison.imu || {
    accel_rms: 1.04,
    angular_velocity: 28.5,
    smoothness: 84.2,
    jerk: 6.8,
    periodicity: 88.0,
  };

  const confidence = comparison.multimodal_confidence ?? 92.5;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-5">
      {/* Header and Multimodal Confidence */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-slate-900 dark:text-white text-base">
              Camera + Wearable IMU Multimodal Fusion
            </h3>
            <p className="text-xs text-slate-500">
              Synchronized Kinematic Agreement & Confidence Metrics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 text-xs">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Multimodal Confidence: <strong>{confidence}%</strong></span>
        </div>
      </div>

      {/* Side-by-side Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Camera Biomechanics Column */}
        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
            <Camera className="w-4 h-4" />
            <span>Camera Movement Stream</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[11px] text-slate-500 block">Knee ROM</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {cam.knee_rom != null ? `${cam.knee_rom}°` : "—"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[11px] text-slate-500 block">Gait Symmetry</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {cam.gait_symmetry != null ? `${cam.gait_symmetry}%` : "—"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[11px] text-slate-500 block">Stride Duration</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {cam.stride_duration != null ? `${cam.stride_duration}s` : "—"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[11px] text-slate-500 block">Gait Cadence</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {cam.cadence != null ? `${cam.cadence} spm` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* IMU Kinematics Column */}
        <div className="rounded-xl border border-blue-200/80 dark:border-blue-800/60 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-semibold text-sm">
            <Radio className="w-4 h-4" />
            <span>ESP32 IMU Sensor Stream</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
              <span className="text-[11px] text-slate-500 block">Acceleration RMS</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {imu.accel_rms != null ? `${imu.accel_rms} g` : "—"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
              <span className="text-[11px] text-slate-500 block">Angular Velocity</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {imu.angular_velocity != null ? `${imu.angular_velocity}°/s` : "—"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
              <span className="text-[11px] text-slate-500 block">Movement Smoothness</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {imu.smoothness != null ? `${imu.smoothness}%` : "—"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
              <span className="text-[11px] text-slate-500 block">Spectral Jerk</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {imu.jerk != null ? `${imu.jerk}` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
