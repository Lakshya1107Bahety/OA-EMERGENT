import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { generateReport } from "@/lib/report";
import RiskBadge, { RISK_COLOR } from "@/components/RiskBadge";
import { toast } from "sonner";
import { Loader2, FileDown, Sparkles, ArrowLeft, Activity, Gauge, Scale, AlertTriangle } from "lucide-react";

function CircularMeter({ value, level }) {
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
          animate={{ strokeDashoffset: c - (value / 100) * c }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="font-heading text-5xl font-bold" style={{ color }}
        >
          {value}%
        </motion.span>
        <span className="text-sm text-slate-500 mt-1">OA Probability</span>
      </div>
    </div>
  );
}

const ScoreCard = ({ icon: Icon, label, value, suffix, testid }) => (
  <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-4 text-center" data-testid={testid}>
    <Icon className="w-6 h-6 text-primary mx-auto" />
    <p className="mt-2 font-heading text-2xl font-bold text-slate-900">{value}{suffix}</p>
    <p className="text-xs text-slate-600">{label}</p>
  </div>
);

export default function ScreeningResult() {
  const { screeningId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    api.get(`/screenings/${screeningId}`).then((r) => {
      setData(r.data);
      setAiSummary(r.data.ai_summary);
    }).catch(() => toast.error("Not found"));
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

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const r = data.result;

  return (
    <div className="max-w-5xl space-y-6">
      <Button variant="ghost" className="rounded-xl -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl text-amber-900 font-medium text-sm flex items-center gap-2" data-testid="disclaimer-banner">
        <AlertTriangle className="w-5 h-5 shrink-0" /> AI-assisted screening, not a medical diagnosis.
      </div>

      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-6">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="flex flex-col items-center">
            <CircularMeter value={r.oa_probability} level={r.risk_level} />
            <div className="mt-4 flex items-center gap-3">
              <RiskBadge level={r.risk_level} testid="result-risk-badge" />
              <span className="text-sm text-slate-500">Confidence {r.confidence}%</span>
            </div>
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
        <ScoreCard icon={Activity} label="Knee Stability" value={r.knee_stability_score} suffix="/100" testid="score-stability" />
        <ScoreCard icon={Scale} label="Movement Symmetry" value={r.movement_symmetry} suffix="%" testid="score-symmetry" />
        <ScoreCard icon={Gauge} label="Balance Score" value={r.balance_score} suffix="/100" testid="score-balance" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-slate-800 mb-4">Contributing Factors</h3>
          <div className="space-y-3">
            {r.contributing_factors.map((f) => (
              <div key={f.factor} data-testid={`factor-${f.factor.toLowerCase().replace(/[ /]/g, "-")}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700">{f.factor}</span>
                  <span className="font-semibold text-slate-800">{f.weight}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${f.weight}%` }} transition={{ duration: 0.8 }} />
                </div>
              </div>
            ))}
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
