import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Cpu, Camera, RefreshCw, GitMerge, BrainCircuit,
  Stethoscope, ShieldAlert, ArrowRight, ArrowDown,
  Layers, CheckCircle, Database, Server, Smartphone, Monitor
} from "lucide-react";
import MedicalDisclaimer from "@/components/MedicalDisclaimer";

export default function SystemArchitecture() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl lg:text-3xl font-bold text-slate-900">
              System Architecture & Pipeline
            </h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              Multimodal AI
            </Badge>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            End-to-end engineering pipeline: Dual-sensor synchronization, feature extraction, biomechanical deviance, and explainable OA risk assessment.
          </p>
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <MedicalDisclaimer />

      {/* Architecture Overview Diagram */}
      <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-gradient-to-b from-white to-slate-50/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            End-to-End Multimodal Dataflow
          </CardTitle>
          <CardDescription>
            How OA Sentinel captures, synchronizes, evaluates, and explains movement characteristics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 relative">
            {/* Stage 1 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Stage 1
                  </span>
                  <div className="flex gap-1">
                    <Cpu className="w-4 h-4 text-emerald-600" />
                    <Camera className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Dual Ingestion</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Wearable IMU (ESP32 + MPU6050 @ 50Hz) capturing Accel/Gyro + Laptop/Phone Camera (@ 30fps).
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                BLE GATT & WebRTC
              </div>
            </div>

            {/* Stage 2 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    Stage 2
                  </span>
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Sync & Filter</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Cross-modal millisecond timestamp alignment, 1-Euro jitter filter, and cubic spline 100Hz interpolation.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                Heel-strike epoch lock
              </div>
            </div>

            {/* Stage 3 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                    Stage 3
                  </span>
                  <GitMerge className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Feature Fusion</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Extracts 10 kinematic biomarkers: Knee ROM, Asymmetry, Stride Time, Cadence, and Lateral Trunk Lean.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                10-dim kinematic vector
              </div>
            </div>

            {/* Stage 4 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    Stage 4
                  </span>
                  <BrainCircuit className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Biomechanical AI</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Calibrated against 3,003 healthy trials (49 benchmark subjects). Calculates Mahalanobis deviation & risk tier.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                p90 & p97.5 cutoffs
              </div>
            </div>

            {/* Stage 5 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                    Stage 5
                  </span>
                  <Stethoscope className="w-4 h-4 text-rose-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Explainable XAI</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Joint contribution radar, clinical safety disclaimers, PDF export, and physician validation portal.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                Clinician Review & Safety
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deep-Dive Architectural Modules */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Module A */}
        <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Cpu className="w-5 h-5" />
              <CardTitle className="text-base">1. Hardware & Wearable Telemetry</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p className="text-xs text-slate-600 leading-relaxed">
              The wearable sensor node is an Espressif ESP32 dual-core microcontroller connected to an InvenSense MPU6050 via high-speed I2C (400 kHz).
            </p>
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Inertial Sensor:</span>
                <span className="font-mono text-slate-600">MPU6050 (3-axis Accel + 3-axis Gyro)</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Sampling Rate:</span>
                <span className="font-mono text-slate-600">50 Hz Hardware Timer</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Communication:</span>
                <span className="font-mono text-slate-600">Web Bluetooth (BLE) / WebSocket</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Battery & Form:</span>
                <span className="font-mono text-slate-600">3.7V 500mAh LiPo, shank strap</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Module B */}
        <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Camera className="w-5 h-5" />
              <CardTitle className="text-base">2. Computer Vision & Pose Tracking</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p className="text-xs text-slate-600 leading-relaxed">
              Monocular RGB video feeds from commodity webcams or mobile devices are processed locally using MediaPipe BlazePose to obtain 33 3D world landmark coordinates.
            </p>
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Pose Model:</span>
                <span className="font-mono text-slate-600">BlazePose GHUM 3D Landmark Model</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Resolution & FPS:</span>
                <span className="font-mono text-slate-600">1080p / 720p @ 30 fps</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Joint Angle Math:</span>
                <span className="font-mono text-slate-600">Vector dot products in sagittal plane</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Privacy Guarantee:</span>
                <span className="font-mono text-slate-600">100% On-device, frames never stored</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Module C */}
        <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <BrainCircuit className="w-5 h-5" />
              <CardTitle className="text-base">3. Biomechanical Reference Engine</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p className="text-xs text-slate-600 leading-relaxed">
              Rather than a black-box neural net prone to hallucinations, OA Sentinel uses a rigorous, calibrated multivariate biomechanical reference model trained on 3,003 validated trials.
            </p>
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Normative Cohort:</span>
                <span className="font-mono text-slate-600">49 benchmark subjects (51 enrolled)</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Deviance Scoring:</span>
                <span className="font-mono text-slate-600">Weighted Mahalanobis & Z-deviation</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Threshold Calibration:</span>
                <span className="font-mono text-slate-600">p90 = 88.08 | p97.5 = 96.37</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Fusion Weighting:</span>
                <span className="font-mono text-slate-600">70% Mean Score + 30% Abnormal Rate</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Module D */}
        <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <ShieldAlert className="w-5 h-5" />
              <CardTitle className="text-base">4. Safety & Human-in-the-Loop</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p className="text-xs text-slate-600 leading-relaxed">
              Designed from first principles as an AI-assisted screening decision support system under medical AI safety guidelines.
            </p>
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Regulatory Class:</span>
                <span className="font-mono text-slate-600">Research & Screening Prototype</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Physician Review:</span>
                <span className="font-mono text-slate-600">Required for clinical actionability</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Explainability (XAI):</span>
                <span className="font-mono text-slate-600">Transparent factor breakdown</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">Data Protection:</span>
                <span className="font-mono text-slate-600">Pseudonymized IDs & Local Caching</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
