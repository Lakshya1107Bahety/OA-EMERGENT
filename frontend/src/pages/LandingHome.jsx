import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Radio, ArrowRight, ShieldCheck, Cpu, Activity, Layers, Database, Sparkles, HelpCircle, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import MedicalDisclaimer from "@/components/MedicalDisclaimer";

export default function LandingHome() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      {/* Top Disclaimer */}
      <MedicalDisclaimer />

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white p-8 md:p-12 shadow-xl border border-slate-800">
        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            Clinical Multimodal Screening Prototype
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            OA Sentinel
          </h1>

          <p className="text-xl sm:text-2xl text-slate-300 font-medium font-heading">
            Multimodal AI-Assisted Osteoarthritis Risk Screening
          </p>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            Synchronizing live optical gait kinematics with wearable ESP32 + MPU6050 6-DoF inertial telemetry. 
            Calibrated on a 51-participant clinical dataset for explainable prototype risk screening.
          </p>

          {/* Primary Action Button */}
          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Button
              onClick={() => navigate("/app/assessment")}
              size="lg"
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-8 py-6 rounded-2xl text-base shadow-lg shadow-emerald-500/20 gap-3 group"
            >
              START NEW ASSESSMENT
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            <Button
              onClick={() => navigate("/app/multimodal")}
              variant="outline"
              size="lg"
              className="border-slate-700 text-slate-200 hover:bg-slate-800 px-6 py-6 rounded-2xl text-base font-semibold"
            >
              Multimodal Live Stream
            </Button>
          </div>
        </div>

        {/* Decorative Grid Glow */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 5 Core Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 w-fit">
            <Camera className="w-5 h-5" />
          </div>
          <h4 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
            Camera + IMU
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Synchronized dual-stream capture using standard laptop/mobile webcam + wearable ESP32.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 w-fit">
            <Activity className="w-5 h-5" />
          </div>
          <h4 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
            Movement Analysis
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            MediaPipe skeleton pose extraction for knee flexion ROM, cadence, velocity, and gait asymmetry.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 w-fit">
            <HelpCircle className="w-5 h-5" />
          </div>
          <h4 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
            Explainable AI
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            SHAP-style mathematical feature contributions showing directional divergence from healthy cohort.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 w-fit">
            <HardDrive className="w-5 h-5" />
          </div>
          <h4 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
            Offline Capable
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Local browser storage, in-browser model inference, and local CSV export without cloud dependency.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 w-fit">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
            Patient-Centric
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Structured functional protocol (5m Walk, 5xSTS, Flexion) with personalized clinical risk profiling.
          </p>
        </div>
      </div>

      {/* System Pipeline Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm space-y-6">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
            System Dataflow Architecture
          </span>
          <h3 className="font-heading text-xl font-bold text-slate-900 dark:text-white mt-1">
            Multimodal End-to-End Processing Pipeline
          </h3>
        </div>

        {/* Pipeline Diagram Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
          {/* Step 1 */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 mx-auto flex items-center justify-center font-bold font-mono">
              1
            </div>
            <h5 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
              Dual Acquisition
            </h5>
            <p className="text-xs text-slate-500">
              Webcam (MediaPipe) + Wearable ESP32 (MPU6050 BLE 50Hz)
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 mx-auto flex items-center justify-center font-bold font-mono">
              2
            </div>
            <h5 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
              Feature Extraction
            </h5>
            <p className="text-xs text-slate-500">
              Joint angles, ROM, asymmetry % & IMU jerk, RMS, variance
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 mx-auto flex items-center justify-center font-bold font-mono">
              3
            </div>
            <h5 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
              Temporal Sync
            </h5>
            <p className="text-xs text-slate-500">
              Timestamp matching with error calculation (Δt ≤ 20ms)
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 mx-auto flex items-center justify-center font-bold font-mono">
              4
            </div>
            <h5 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
              Multimodal AI
            </h5>
            <p className="text-xs text-slate-500">
              Trained on 51 clinical subjects with normative banding
            </p>
          </div>

          {/* Step 5 */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 mx-auto flex items-center justify-center font-bold font-mono">
              5
            </div>
            <h5 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
              Risk Profile & SHAP
            </h5>
            <p className="text-xs text-slate-500">
              Prototype risk category & directional feature contributions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
