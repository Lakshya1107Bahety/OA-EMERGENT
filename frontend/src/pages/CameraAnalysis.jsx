import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import CameraPanel from "@/components/CameraPanel";
import MedicalDisclaimer from "@/components/MedicalDisclaimer";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, CheckCircle2, RotateCcw, AlertTriangle, Loader2, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { patientStorageService } from "@/services/patientStorageService";
import { inferenceService } from "@/services/inferenceService";
import { api } from "@/lib/api";
import { normalizeCameraResults } from "@/lib/oaApi";
import { toast } from "sonner";

// Risk level styling config
const RISK_CONFIG = {
  LOW:      { icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200",    badge: "bg-emerald-100 text-emerald-800" },
  MODERATE: { icon: ShieldAlert,  color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",        badge: "bg-amber-100 text-amber-800" },
  HIGH:     { icon: ShieldX,      color: "text-red-600",     bg: "bg-red-50 border-red-200",            badge: "bg-red-100 text-red-800" },
};

// Unmeasured camera values are null: show that instead of a number.
const fmt = (v, unit) => (v == null ? "not measured" : `${v}${unit}`);

function getRiskConfig(riskLevel = "") {
  const key = riskLevel.toUpperCase().includes("HIGH") ? "HIGH"
            : riskLevel.toUpperCase().includes("MOD")  ? "MODERATE"
            : "LOW";
  return RISK_CONFIG[key];
}

export default function CameraAnalysis() {
  const navigate = useNavigate();
  const [activePatient] = useState(() => {
    const id = patientStorageService.getActivePatientId();
    return patientStorageService.getPatient(id) || { id: "OA-DEMO-01", age: 48, sex: "Female", bmi: 24.5 };
  });

  const [activeTest, setActiveTest] = useState("walk_5m");
  const [completedTrials, setCompletedTrials] = useState([]);
  const [lastSummary, setLastSummary] = useState(null);
  const [isMatching, setIsMatching] = useState(false);

  // Risk analysis state
  const [riskResult, setRiskResult] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState("");

  const handleTrialComplete = async (summary) => {
    setIsMatching(true);
    setRiskResult(null);
    setRiskError("");
    let finalSummary = { ...summary };
    const isNotWalking = !summary.frames_captured || summary.frames_captured < 5;

    try {
      if (isNotWalking) {
        // Never substitute another participant's trial for this patient's data.
        toast.error("No walking movement detected, so this trial was not recorded. Please repeat the walk in view of the camera.");
        return;
      } else {
        const matched = await inferenceService.fetchDatasetMatch(activePatient, summary);
        if (matched) {
          finalSummary = {
            ...finalSummary,
            _source: "live_camera_analyzed",
            _matched_participant: matched._matched_participant,
            _matched_trial: matched._matched_trial,
            _matched_age: matched._matched_age,
            _matched_bmi: matched._matched_bmi,
            _matched_gender: matched._matched_gender,
          };
        }
      }
    } catch (err) {
      console.error("Dataset match error:", err);
    } finally {
      setIsMatching(false);
    }

    const trialWithMeta = {
      trial_index: completedTrials.length + 1,
      test_type: activeTest,
      timestamp: new Date().toISOString(),
      ...finalSummary,
    };

    setCompletedTrials((prev) => [...prev, trialWithMeta]);
    setLastSummary(trialWithMeta);

    // Save to localStorage for other pages
    const allTrials = [...completedTrials, trialWithMeta];
    localStorage.setItem("oa_last_camera_trials", JSON.stringify(allTrials));

    // === Automatically run OA Risk Analysis ===
    await runRiskAnalysis(trialWithMeta);
  };

  const runRiskAnalysis = async (trial) => {
    setRiskLoading(true);
    setRiskError("");
    setRiskResult(null);
    try {
      // Build patient payload
      const patient = {
        patient_id: activePatient.id,
        age: activePatient.age,
        gender: activePatient.sex || activePatient.gender,
        height_cm: activePatient.height_cm ?? null,
        mass_kg: activePatient.weight_kg ?? null,
      };

      // Normalize the trial into the format /oa/analyze expects
      const camera_results = normalizeCameraResults([trial], activePatient.id);

      const { data } = await api.post("/oa/analyze", {
        patient,
        camera_results,
        patient_id: activePatient.id,
      });

      if (data?.success && data?.result) {
        setRiskResult(data.result);
        toast.success(`Risk Analysis complete: ${data.result.risk_level || data.result.screening_level}`);
      } else {
        throw new Error(data?.error || "Analysis returned no result");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "OA analysis failed";
      setRiskError(msg);
      toast.error("Risk analysis failed — " + msg);
    } finally {
      setRiskLoading(false);
    }
  };

  const handleProceedToFusion = () => {
    if (completedTrials.length === 0) {
      toast.error("Complete at least one functional movement recording trial.");
      return;
    }
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
            <span className="text-slate-400 ml-2">({activePatient.age || 48}yo · BMI {activePatient.bmi || 24.5})</span>
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

      {/* Extracted Biomechanical Features Table */}
      {lastSummary && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h4 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
                Extracted Biomechanical Metrics (Trial #{lastSummary.trial_index})
              </h4>
            </div>
            <div className="flex items-center gap-2">
              {lastSummary._source === "dataset_matched_not_walking" ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Strict Dataset Match (Participant #{lastSummary._matched_participant} · {lastSummary._matched_trial})
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Live Camera · Calibrated to 3003 Cohort
                </span>
              )}
              <span className="font-mono text-xs text-slate-500">
                Duration: {lastSummary.duration_sec}s • Frames: {lastSummary.frames_captured}
              </span>
            </div>
          </div>

          {lastSummary._source === "dataset_matched_not_walking" && (
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-900 dark:text-amber-200">
              <strong>No walking movement detected (0 frames).</strong> Instead of synthetic defaults, values were strictly matched from the 3003-trial clinical dataset for a {lastSummary._matched_gender === "F" ? "Female" : "Male"} subject (Age: {lastSummary._matched_age}, BMI: {lastSummary._matched_bmi}) — Participant #{lastSummary._matched_participant}, Trial {lastSummary._matched_trial}.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-center">
            {[
              { label: "Right Knee ROM", value: fmt(lastSummary.right_knee_rom_deg, "°"), color: "text-slate-900 dark:text-white" },
              { label: "Left Knee ROM",  value: fmt(lastSummary.left_knee_rom_deg, "°"),  color: "text-slate-900 dark:text-white" },
              { label: "Knee ROM Asymmetry", value: fmt(lastSummary.knee_rom_asymmetry_pct, "%"), color: "text-amber-600" },
              { label: "Cadence",        value: fmt(lastSummary.cadence_steps_min, " spm"), color: "text-slate-900 dark:text-white" },
              { label: "Trunk Lean",     value: fmt(lastSummary.trunk_lean_deg, "°"),       color: "text-slate-900 dark:text-white" },
              { label: "Walking Velocity", value: fmt(lastSummary.walking_velocity, " m/s"), color: "text-slate-900 dark:text-white" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-[11px] text-slate-500 block">{label}</span>
                <span className={`font-mono text-base font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ OA Risk Analysis Results ============ */}
      {(riskLoading || riskResult || riskError) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 animate-in fade-in">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Activity className="w-5 h-5 text-emerald-600" />
            <h4 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
              OA Risk Analysis — Trained Dataset Model
            </h4>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
              3003-trial Isolation Forest
            </span>
          </div>

          {/* Loading */}
          {riskLoading && (
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="text-sm font-medium">Running OA screening against trained dataset model…</span>
            </div>
          )}

          {/* Error */}
          {riskError && !riskLoading && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-800 dark:text-red-300">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Risk analysis failed</p>
                <p className="mt-0.5 opacity-80">{riskError}</p>
              </div>
            </div>
          )}

          {/* Results */}
          {riskResult && !riskLoading && (() => {
            const level = riskResult.risk_level || riskResult.screening_level || "LOW";
            const cfg = getRiskConfig(level);
            const Icon = cfg.icon;
            const prob = riskResult.deviation_score ?? "—";
            const gait = riskResult.gait || {};
            const trials = riskResult.trials_analyzed ?? "—";
            const flagged = gait.trials_flagged_atypical ?? "—";
            const imputed = gait.features_imputed ?? "—";
            const symmetry = riskResult.movement_symmetry ?? "—";
            const findings = riskResult.findings || "";

            return (
              <div className="space-y-4">
                {/* Risk Level Banner */}
                <div className={`flex items-center justify-between p-4 rounded-xl border ${cfg.bg}`}>
                  <div className="flex items-center gap-3">
                    <Icon className={`w-8 h-8 ${cfg.color}`} />
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Gait deviation level</p>
                      <p className={`text-2xl font-black font-heading ${cfg.color}`}>{level}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Gait deviation (0–100)</p>
                    <p className={`text-3xl font-black font-mono ${cfg.color}`}>
                      {typeof prob === "number" ? prob.toFixed(1) : prob}
                    </p>
                  </div>
                </div>

                {/* Metric Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  {[
                    { label: "Trials Analyzed", value: trials },
                    { label: "Trials Flagged Atypical", value: flagged },
                    { label: "Measurements Not Captured", value: imputed },
                    { label: "Knee ROM Symmetry", value: typeof symmetry === "number" ? `${symmetry}%` : symmetry },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[11px] text-slate-500 block">{label}</span>
                      <span className="font-mono text-base font-bold text-slate-900 dark:text-white">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Findings */}
                {findings && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300">
                    <p className="font-semibold text-slate-800 dark:text-white mb-1">Findings</p>
                    <p className="whitespace-pre-wrap">{typeof findings === "string" ? findings : JSON.stringify(findings, null, 2)}</p>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 text-center italic">
                  Gait deviation = share of reference walking trials (3,003 trials, 49 participants) that look more typical than this gait. It measures how atypical the gait is, not the probability of OA, and is not a diagnosis.
                </p>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}