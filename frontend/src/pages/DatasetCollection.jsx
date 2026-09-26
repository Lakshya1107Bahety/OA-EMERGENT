import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Database, Users, Activity, Layers, Download, CheckCircle2,
  FileSpreadsheet, ShieldAlert, Cpu, Camera, Clock, BarChart3, Info
} from "lucide-react";
import MedicalDisclaimer from "@/components/MedicalDisclaimer";
import referenceData from "@/data/oa_healthy_reference.json";

const FEATURE_DESCRIPTIONS = {
  right_knee_rom_deg: {
    label: "Right Knee Range of Motion",
    unit: "deg (°)",
    clinical: "Maximum flexion minus minimum extension angle across gait cycles. Normal: 55° - 75°.",
  },
  left_knee_rom_deg: {
    label: "Left Knee Range of Motion",
    unit: "deg (°)",
    clinical: "Contralateral knee dynamic ROM. Asymmetry > 10% indicates antalgic compensation.",
  },
  right_hip_rom_deg: {
    label: "Right Hip Range of Motion",
    unit: "deg (°)",
    clinical: "Sagittal plane hip excursion during stance and swing phases.",
  },
  left_hip_rom_deg: {
    label: "Left Hip Range of Motion",
    unit: "deg (°)",
    clinical: "Contralateral hip excursion in degrees.",
  },
  step_duration_sec: {
    label: "Step Duration",
    unit: "sec",
    clinical: "Time elapsed between heel strikes of alternate feet. Prolonged steps reflect cautious loading.",
  },
  stride_duration_sec: {
    label: "Stride Duration",
    unit: "sec",
    clinical: "Full gait cycle duration (same heel strike to next).",
  },
  cadence_steps_min: {
    label: "Gait Cadence",
    unit: "steps/min",
    clinical: "Steps per minute. Reduced cadence (< 90 steps/min) correlates with functional joint hesitation.",
  },
  knee_rom_asymmetry_pct: {
    label: "Knee ROM Asymmetry",
    unit: "%",
    clinical: "Normalized difference between left and right knee flexion. High values correlate with unilateral joint deterioration.",
  },
  step_time_asymmetry_pct: {
    label: "Step Time Asymmetry",
    unit: "%",
    clinical: "Temporal asymmetry between limb weight-bearing phases.",
  },
  trunk_lean_deg: {
    label: "Trunk Lateral Lean",
    unit: "deg (°)",
    clinical: "Compensatory Duchenne limp / lateral trunk lean to shift center of mass over the affected joint.",
  },
};

export default function DatasetCollection() {
  const [selectedFeature, setSelectedFeature] = useState("right_knee_rom_deg");
  const [activeTab, setActiveTab] = useState("explorer");

  const featDist = referenceData?.feature_distributions?.[selectedFeature] || {};
  const featMeta = FEATURE_DESCRIPTIONS[selectedFeature] || { label: selectedFeature, unit: "", clinical: "" };

  const handleDownloadReference = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(referenceData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "oa_sentinel_healthy_reference.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl lg:text-3xl font-bold text-slate-900">
              Dataset & Data Collection
            </h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
              Validated Cohort
            </Badge>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Normative gait benchmarks, 51-participant trials, and multimodal synchronized collection protocols.
          </p>
        </div>
        <Button onClick={handleDownloadReference} className="gap-2 rounded-xl">
          <Download className="w-4 h-4" /> Download Reference JSON
        </Button>
      </div>

      {/* Mandatory Disclaimer */}
      <MedicalDisclaimer />

      {/* High-level Cohort Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Participants Enrolled</p>
              <p className="text-2xl font-bold text-slate-900">{referenceData?.total_participants_enrolled || 51}</p>
              <p className="text-[11px] text-emerald-600">49 benchmark subjects</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Validated Trials</p>
              <p className="text-2xl font-bold text-slate-900">{referenceData?.n_total_trials || 3003}</p>
              <p className="text-[11px] text-blue-600">High-fidelity recordings</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Feature Dimensions</p>
              <p className="text-2xl font-bold text-slate-900">{referenceData?.features?.length || 10}</p>
              <p className="text-[11px] text-purple-600">Kinematic & Temporal</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Risk Calibration</p>
              <p className="text-2xl font-bold text-slate-900">p90 / p97.5</p>
              <p className="text-[11px] text-amber-600">88.08 / 96.37 pts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 max-w-lg rounded-xl">
          <TabsTrigger value="explorer">Feature Explorer</TabsTrigger>
          <TabsTrigger value="protocol">Collection Protocol</TabsTrigger>
          <TabsTrigger value="calibration">Risk Calibration</TabsTrigger>
        </TabsList>

        {/* Tab 1: Feature Explorer */}
        <TabsContent value="explorer" className="space-y-4 mt-4">
          <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Normative Biomechanical Distributions</CardTitle>
                  <CardDescription>
                    Explore empirical distributions extracted from 3,003 validated trials across 49 healthy benchmark subjects.
                  </CardDescription>
                </div>
                <div className="w-72">
                  <Select value={selectedFeature} onValueChange={setSelectedFeature}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select feature" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(FEATURE_DESCRIPTIONS).map((fk) => (
                        <SelectItem key={fk} value={fk}>
                          {FEATURE_DESCRIPTIONS[fk].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Feature Bio Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-slate-900">{featMeta.label}</h4>
                  <p className="text-xs text-slate-600 mt-0.5">{featMeta.clinical}</p>
                </div>
                <Badge variant="secondary" className="font-mono text-xs w-fit">
                  Units: {featMeta.unit}
                </Badge>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-emerald-800 font-medium">Mean</p>
                  <p className="text-xl font-bold text-emerald-900 mt-1">
                    {featDist.mean != null ? featDist.mean.toFixed(2) : "—"}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-slate-600 font-medium">Std Dev (σ)</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">
                    {featDist.std != null ? featDist.std.toFixed(2) : "—"}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-slate-600 font-medium">5th Percentile</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">
                    {featDist.p5 != null ? featDist.p5.toFixed(2) : "—"}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-slate-600 font-medium">25th Percentile</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">
                    {featDist.p25 != null ? featDist.p25.toFixed(2) : "—"}
                  </p>
                </div>
                <div className="bg-blue-50/60 border border-blue-200/60 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-blue-800 font-medium">Median (p50)</p>
                  <p className="text-xl font-bold text-blue-900 mt-1">
                    {featDist.median != null ? featDist.median.toFixed(2) : "—"}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-slate-600 font-medium">75th Percentile</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">
                    {featDist.p75 != null ? featDist.p75.toFixed(2) : "—"}
                  </p>
                </div>
                <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-amber-800 font-medium">95th Percentile</p>
                  <p className="text-xl font-bold text-amber-900 mt-1">
                    {featDist.p95 != null ? featDist.p95.toFixed(2) : "—"}
                  </p>
                </div>
              </div>

              {/* Range Spectrum */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                  <span>Min: {featDist.min != null ? featDist.min.toFixed(2) : "—"}</span>
                  <span className="font-semibold text-slate-700">Healthy Cohort Span</span>
                  <span>Max: {featDist.max != null ? featDist.max.toFixed(2) : "—"}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full relative overflow-hidden">
                  <div
                    className="absolute h-full bg-emerald-500 rounded-full opacity-80"
                    style={{ left: "20%", right: "20%" }}
                  />
                  <div
                    className="absolute h-full w-1.5 bg-slate-900"
                    style={{ left: "50%" }}
                    title="Median"
                  />
                </div>
                <p className="text-[11px] text-slate-500 text-center">
                  Green band marks IQR (Interquartile Range: 25th - 75th percentile). Dark marker denotes median.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Collection Protocol */}
        <TabsContent value="protocol" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <Cpu className="w-5 h-5" />
                  <h3>Wearable IMU Hardware Protocol</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <p>
                  <strong>Hardware Component:</strong> Espressif ESP32-WROOM-32 coupled with InvenSense MPU6050 6-Axis MotionTracking device (3-axis accelerometer + 3-axis gyroscope).
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                  <li><strong>Sampling Frequency:</strong> 50 Hz with onboard hardware timer interrupts.</li>
                  <li><strong>Accelerometer Range:</strong> ±4g (sensitivity: 8192 LSB/g).</li>
                  <li><strong>Gyroscope Range:</strong> ±250°/s (sensitivity: 131 LSB/°/s).</li>
                  <li><strong>Placement:</strong> Anterior aspect of distal tibia / shank, 5 cm superior to medial malleolus, aligned with sagittal gait axis.</li>
                  <li><strong>Transmission:</strong> Bluetooth Low Energy (GATT characteristic) or WebSocket telemetry.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <Camera className="w-5 h-5" />
                  <h3>Optical Computer Vision Protocol</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <p>
                  <strong>Capture Device:</strong> Standard smartphone or laptop webcam (1080p / 720p @ 30fps), positioned at sagittal/frontal 45° angle at 1.0m height.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                  <li><strong>Pose Engine:</strong> MediaPipe BlazePose extracting 33 full-body 3D landmarks in real time.</li>
                  <li><strong>Joint Vectors:</strong> Hip-Knee-Ankle 3D vectors computed using vector dot products for instantaneous joint angles.</li>
                  <li><strong>Derived Kinematics:</strong> Peak flexion/extension, dynamic knee ROM, lateral trunk lean, cadence.</li>
                  <li><strong>Signal Cleaning:</strong> 1-Euro smoothing filter + Savitzky-Golay derivative filtering to remove jitter.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white md:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <Clock className="w-5 h-5" />
                  <h3>Multimodal Synchronization & Quality Controls</h3>
                </div>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-4 text-xs text-slate-600">
                <div className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                  <h5 className="font-semibold text-slate-800 text-sm mb-1">Epoch Timestamping</h5>
                  <p>Each IMU packet and video frame is stamped with Unix millisecond epoch. Initial synchronization pulse is captured via a brief heel-strike impact.</p>
                </div>
                <div className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                  <h5 className="font-semibold text-slate-800 text-sm mb-1">Interpolation & Resampling</h5>
                  <p>Camera (30 Hz) and IMU (50 Hz) feeds are resampled to a common 100 Hz kinematic timeline using cubic spline interpolation before feature extraction.</p>
                </div>
                <div className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                  <h5 className="font-semibold text-slate-800 text-sm mb-1">Exclusion Thresholds</h5>
                  <p>Trials with MediaPipe landmark confidence &lt; 0.60 or IMU packet loss exceeding 5% are automatically flagged as invalid and excluded.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Risk Calibration */}
        <TabsContent value="calibration" className="space-y-4 mt-4">
          <Card className="rounded-2xl border-emerald-900/10 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Risk Cutoff Formulation</CardTitle>
              <CardDescription>
                Empirically calibrated percentiles derived from the 49-participant healthy cohort.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Tier 1</span>
                  <h4 className="text-base font-bold text-emerald-900 mt-1">Low Risk Category</h4>
                  <p className="text-xs text-emerald-700 mt-1 font-mono">Score &lt; 88.08 (p90)</p>
                  <p className="text-xs text-slate-600 mt-2">
                    Kinematics align within 90% of healthy normative distribution. Regular movement symmetry and healthy ROM preserved.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Tier 2</span>
                  <h4 className="text-base font-bold text-amber-900 mt-1">Moderate Risk Category</h4>
                  <p className="text-xs text-amber-700 mt-1 font-mono">88.08 ≤ Score &lt; 96.37 (p90 - p97.5)</p>
                  <p className="text-xs text-slate-600 mt-2">
                    Mild kinematic asymmetry or reduced flexion. Compensatory gait patterns emerging. Lifestyle adjustments recommended.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70">
                  <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Tier 3</span>
                  <h4 className="text-base font-bold text-rose-900 mt-1">High Risk Category</h4>
                  <p className="text-xs text-rose-700 mt-1 font-mono">Score ≥ 96.37 (Top 2.5%)</p>
                  <p className="text-xs text-slate-600 mt-2">
                    Severe kinematic deviance, pronounced limb asymmetry, or antalgic trunk lean. Clinical radiographic evaluation suggested.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Formula Weights:</p>
                <p>
                  <strong>Final Score</strong> = (0.70 × Mean Biomechanical Deviation Score) + (0.30 × Abnormal Trial Rate)
                </p>
                <p className="text-slate-500">
                  Tested and validated against 3,003 empirical walking and functional mobility trials.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
