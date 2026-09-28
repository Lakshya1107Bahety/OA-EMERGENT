import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { generateReport } from "@/lib/report";
import { scoreOf } from "@/lib/score";
import RiskBadge, { RISK_COLOR } from "@/components/RiskBadge";
import { toast } from "sonner";
import { Loader2, FileDown, Sparkles, ArrowLeft, Activity, Camera, Scale, AlertTriangle, Info } from "lucide-react";

function CircularMeter({ value, text, label, level }) {
  const size = 200, stroke = 16, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const color = RISK_COLOR[level] || "#10B981";
  return (
    <div className="relative" style={{ width: size, height: size }} data-testid="oa-probability-meter">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E2E8F0" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - ((value ?? 0) / 100) * c }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="font-heading text-5xl font-bold" style={{ color }}
        >
          {text}
        </motion.span>
        <span className="text-sm text-slate-500 mt-1 text-center px-6">{label}</span>
      </div>
    </div>
  );
}

const ScoreCard = ({ icon: Icon, label, value, suffix, testid }) => (
  <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-4 text-center" data-testid={testid}>
    <Icon className="w-6 h-6 text-primary mx-auto" />
    <p className="mt-2 font-heading text-2xl font-bold text-slate-900">{value ?? "—"}{value != null ? suffix : ""}</p>
    <p className="text-xs text-slate-600">{label}</p>
  </div>
);

export default function ScreeningResult() {
  const { screeningId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!screeningId) { setError("No screening ID provided."); return; }
    api.get(`/screenings/${screeningId}`).then((r) => {
      setData(r.data);
      setAiSummary(r.data.ai_summary);
    }).catch(() => {
      toast.error("Screening not found or backend offline");
      setError("Could not load screening result. The backend may be offline.");
    });
  }, [screeningId]);

  const genSummary = async () => {
    setAiLoading(true);
    try {
      const { data: res } = await api.post(`/screenings/${screeningId}/ai-summary`);
      setAiSummary(res.ai_summary);
    } catch {
      toast.error("Could not generate AI summary");
    } finally {
      setAiLoading(false);
    }
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <AlertTriangle className="w-10 h-10 text-amber-500" />
      <p className="text-slate-600 text-sm max-w-xs">{error}</p>
      <button onClick={() => navigate(-1)} className="text-primary underline text-sm">Go back</button>
    </div>
  );

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const r = data.result;
  const score = scoreOf(r);
  const coverage = r.data_coverage || {};
  const factors = r.contributing_factors || [];

  return (
    <div className="max-w-5xl space-y-6">
      <Button variant="ghost" className="rounded-xl -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl text-amber-900 font-medium text-sm flex items-center gap-2" data-testid="disclaimer-banner">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        {score.legacy
          ? "Legacy result from the old, uncalibrated engine. The number is not a probability of osteoarthritis."
          : score.uncalibrated
            ? "IMU-only result. The irregularity index is NOT calibrated against reference data (provisional cut-offs). It is not a probability of osteoarthritis and not a diagnosis."
            : r.disclaimer || "AI-assisted screening, not a medical diagnosis."}
      </div>

      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-6">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="flex flex-col items-center">
            <CircularMeter value={score.value} text={score.text} label={score.label} level={r.risk_level} />
            <div className="mt-4 flex items-center gap-3">
              <RiskBadge level={r.risk_level} testid="result-risk-badge" />
            </div>
            {r.risk_basis && <p className="mt-2 text-xs text-slate-500 text-center max-w-xs" data-testid="risk-basis">{r.risk_basis}</p>}
          </div>
          <div>
            <p className="text-sm text-slate-500">{data.patient?.name} · {data.patient?.age}y · {new Date(data.created_at).toLocaleString()}</p>
            <h1 className="font-heading text-2xl font-bold text-slate-900 mt-1">Screening Result</h1>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Recommendation</p>
                <p className="text-sm text-slate-600">{r.recommendation}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Follow-up</p>
                <p className="text-sm text-slate-600">{r.follow_up}</p>
              </div>
            </div>
            <Button className="mt-5 rounded-xl" data-testid="download-report-button" onClick={() => generateReport(data.patient, data)}>
              <FileDown className="w-4 h-4 mr-2" /> Download PDF Report
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <ScoreCard icon={Camera} label="Camera gait trials scored" value={coverage.camera_trials ?? 0} suffix="" testid="score-camera-trials" />
        <ScoreCard icon={Scale} label="Knee ROM symmetry (camera)" value={r.movement_symmetry} suffix="%" testid="score-symmetry" />
        <ScoreCard icon={Activity} label="IMU samples (10 s test)" value={coverage.imu_samples ?? data.reading_count ?? 0} suffix="" testid="score-imu-samples" />
      </div>

      {data.movement_summary && (
        <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex items-center justify-between" data-testid="movement-summary-card">
          <div>
            <p className="text-sm font-semibold text-slate-700">Functional Movement Assessment</p>
            <p className="text-sm text-slate-500">{data.movement_summary.test_count} test(s) · {data.movement_summary.movement_risk_level} risk</p>
          </div>
          <span className="font-heading text-3xl font-bold text-secondary">{data.movement_summary.overall_score}%</span>
        </div>
      )}

      {r.engine_version && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5" data-testid="clinical-factors-card">
            <h3 className="font-heading font-semibold text-slate-800 mb-1">Clinical risk factors</h3>
            <p className="text-xs text-slate-500 mb-3">Known knee-OA risk factors present. Listed for the clinician; not included in the score.</p>
            {(r.clinical_risk_factors || []).length === 0 ? (
              <p className="text-sm text-slate-400">None recorded.</p>
            ) : (
              <ul className="space-y-1.5">
                {r.clinical_risk_factors.map((c) => (
                  <li key={c.factor} className="flex justify-between text-sm">
                    <span className="text-slate-700">{c.factor}</span>
                    <span className="font-semibold text-slate-800">{c.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5" data-testid="imu-summary-card">
            <h3 className="font-heading font-semibold text-slate-800 mb-1">IMU (10 s test)</h3>
            <p className="text-xs text-slate-500 mb-3">
              Not calibrated: there is no IMU reference cohort yet, so the irregularity index uses provisional cut-offs
              and is only used as the score when no camera gait trials exist.
            </p>
            {r.imu?.sample_count ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <span className="text-slate-600 font-semibold">Irregularity index</span>
                <span className="font-mono text-right font-semibold" data-testid="imu-irregularity-index">
                  {r.imu.irregularity_index != null ? `${r.imu.irregularity_index} (${r.imu.irregularity_tier})` : "—"}
                </span>
                {r.imu.irregularity_reason && (
                  <span className="col-span-2 text-xs text-amber-700">{r.imu.irregularity_reason}</span>
                )}
                <span className="text-slate-600">Samples</span>
                <span className="font-mono text-right">{r.imu.sample_count} @ {r.imu.sample_rate_hz} Hz</span>
                <span className="text-slate-600">Sensor units</span>
                <span className="font-mono text-right">{r.imu.units_detected}{r.imu.units_detected === "g" ? " → m/s²" : ""}</span>
                {Object.entries(r.imu.features || {}).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <span className="text-slate-600 capitalize">{k.replace(/_/g, " ")}</span>
                    <span className="font-mono text-right">{v ?? "—"}</span>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No IMU readings in this screening.</p>
            )}
          </div>
        </div>
      )}

      {r.method && (
        <p className="text-xs text-slate-500 flex gap-2" data-testid="method-note">
          <Info className="w-4 h-4 shrink-0" /> {r.method}
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-slate-800 mb-1">Most unusual gait measurements</h3>
          <p className="text-xs text-slate-500 mb-4">Z-score = how many standard deviations the patient's value is from the reference cohort mean.</p>
          {factors.length === 0 && <p className="text-sm text-slate-400">No camera gait measurements for this screening.</p>}
          <div className="space-y-3">
            {factors.map((f) => {
              const legacy = f.z_score == null;
              const width = legacy ? f.weight : Math.min(100, (Math.abs(f.z_score) / 3) * 100);
              return (
                <div key={f.factor} data-testid={`factor-${f.factor.toLowerCase().replace(/[ /]/g, "-")}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700">{f.factor}</span>
                    <span className="font-semibold text-slate-800">
                      {legacy ? `${f.weight} (legacy)` : `z ${f.z_score > 0 ? "+" : ""}${f.z_score} · ${f.patient_value} vs ${f.reference_mean}`}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${width}%` }} transition={{ duration: 0.8 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> AI Summary
            </h3>
            {!aiSummary && (
              <Button size="sm" className="rounded-xl" onClick={genSummary} disabled={aiLoading} data-testid="generate-ai-summary-button">
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate"}
              </Button>
            )}
          </div>
          {aiSummary ? (
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap" data-testid="ai-summary-text">{aiSummary}</p>
          ) : (
            <p className="text-sm text-slate-400">Generate a plain-language, AI-assisted summary of this screening for the healthcare worker.</p>
          )}
        </div>
      </div>
    </div>
  );
}
