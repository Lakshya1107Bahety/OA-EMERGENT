import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import RiskBadge from "@/components/RiskBadge";
import { generateReport } from "@/lib/report";
import { toast } from "sonner";
import { Loader2, Activity, FileDown, ArrowLeft, Phone, MapPin, Briefcase } from "lucide-react";

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/patients/${id}`).then((r) => setData(r.data)).catch(() => toast.error("Patient not found"));
  }, [id]);

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const { patient, screenings } = data;

  return (
    <div className="max-w-4xl space-y-6">
      <Button variant="ghost" className="rounded-xl -ml-2" onClick={() => navigate("/app/patients")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center font-heading text-2xl font-bold text-primary">
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-slate-900">{patient.name}</h1>
              <p className="text-slate-600">{patient.age} years · {patient.gender} · BMI {patient.bmi ?? "—"}</p>
            </div>
          </div>
          <Button className="rounded-xl h-11" data-testid="start-screening-button" onClick={() => navigate(`/app/screening/${patient.id}`)}>
            <Activity className="w-4 h-4 mr-2" /> New Screening
          </Button>
        </div>
        <div className="mt-5 grid sm:grid-cols-3 gap-4 text-sm">
          <span className="flex items-center gap-2 text-slate-600"><Phone className="w-4 h-4 text-primary" /> {patient.phone || "—"}</span>
          <span className="flex items-center gap-2 text-slate-600"><MapPin className="w-4 h-4 text-primary" /> {patient.village || "—"}, {patient.district || "—"}</span>
          <span className="flex items-center gap-2 text-slate-600"><Briefcase className="w-4 h-4 text-primary" /> {patient.occupation || "—"}</span>
        </div>
        {patient.medical_history && (
          <p className="mt-4 text-sm text-slate-600 bg-muted rounded-xl p-3"><b>History:</b> {patient.medical_history}</p>
        )}
      </div>

      <div>
        <h2 className="font-heading text-xl font-bold text-slate-900 mb-3">Screening History</h2>
        {screenings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-emerald-900/10 p-8 text-center text-slate-500">
            No screenings yet.
          </div>
        ) : (
          <div className="space-y-3">
            {screenings.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-4 flex items-center justify-between gap-4" data-testid={`screening-row-${s.id}`}>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="font-heading text-2xl font-bold text-primary">{s.result?.oa_probability}%</p>
                    <RiskBadge level={s.result?.risk_level} />
                  </div>
                  <div className="text-sm text-slate-600">
                    <p>{new Date(s.created_at).toLocaleString()}</p>
                    <p>Stability {s.result?.knee_stability_score}/100 · {s.reading_count} readings</p>
                    <p className="text-xs mt-1">Review: <b className="capitalize">{s.review_status}</b></p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate(`/app/result/${s.id}`)} data-testid={`view-result-${s.id}`}>View</Button>
                  <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => generateReport(patient, s)} data-testid={`pdf-${s.id}`}>
                    <FileDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
