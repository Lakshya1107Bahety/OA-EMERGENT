import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import CameraPanel from "@/components/CameraPanel";
import MedicalDisclaimer from "@/components/MedicalDisclaimer";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, CheckCircle2, Bone, Layers, RotateCcw, ShieldCheck } from "lucide-react";
import { patientStorageService } from "@/services/patientStorageService";
import { toast } from "sonner";

export default function CameraAnalysis() {
  const navigate = useNavigate();
  const [activePatient] = useState(() => {
    const id = patientStorageService.getActivePatientId();
    return patientStorageService.getPatient(id) || { id: "OA-DEMO-01", age: 48, sex: "Female" };
  });

  const [activeTest, setActiveTest] = useState("walk_5m");
  const [completedTrials, setCompletedTrials] = useState([]);
  const [lastSummary, setLastSummary] = useState(null);

  const handleTrialComplete = (summary) => {
    const trialWithMeta = {
      trial_index: completedTrials.length + 1,
      test_type: activeTest,
      timestamp: new Date().toISOString(),
      ...summary,
    };

    setCompletedTrials((prev) => [...prev, trialWithMeta]);
    setLastSummary(trialWithMeta);
    toast.success(`Biomechanical features saved for trial ${completedTrials.length + 1}.`);
  };

  const handleProceedToFusion = () => {
    if (completedTrials.length === 0) {
      toast.error("Complete at least one functional movement recording trial.");
      return;
    }
    // Save completed camera trials to local cache for multimodal assessment
    localStorage.setItem("oa_last_camera_trials", JSON.stringify(completedTrials));
    navigate("/app/multimodal");
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <MedicalDisclaimer compact={true} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
            Computer Vision Biomechanics
          </span>
          <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            Live Camera Analysis
          </h2>
          <p className="text-xs text-slate-500">
            Real-time human pose estimation extracting knee/hip angles, Range of Motion, and gait symmetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
            <span className="text-slate-500 mr-1.5">Subject:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{activePatient.id}</span>
          </div>

          <Button
            onClick={handleProceedToFusion}
            disabled={completedTrials.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 shadow-sm"
          >
            Proceed to Multimodal Sync
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Camera Live View */}
      <CameraPanel
        activeTestId={activeTest}
        onSelectTest={setActiveTest}
        onTrialComplete={handleTrialComplete}
      />

      {/* Extracted Biomechanical Features Table & Metric Cards */}
      {lastSummary && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h4 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
                Extracted Biomechanical Metrics (Trial #{lastSummary.trial_index})
              </h4>
            </div>

            <span className="font-mono text-xs text-slate-500">
              Duration: {lastSummary.duration_sec}s • Frames: {lastSummary.frames_captured}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-center">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-500 block">Right Knee ROM</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {lastSummary.right_knee_rom_deg}°
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-500 block">Left Knee ROM</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {lastSummary.left_knee_rom_deg}°
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-500 block">Knee ROM Asymmetry</span>
              <span className="font-mono text-base font-bold text-amber-600">
                {lastSummary.knee_rom_asymmetry_pct}%
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-500 block">Cadence</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {lastSummary.cadence_steps_min} spm
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-500 block">Trunk Lean</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {lastSummary.trunk_lean_deg}°
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-500 block">Walking Velocity</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                {lastSummary.walking_velocity} m/s
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
