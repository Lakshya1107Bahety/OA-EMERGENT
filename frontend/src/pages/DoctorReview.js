import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import RiskBadge from "@/components/RiskBadge";
import { toast } from "sonner";
import { Loader2, Stethoscope, Eye } from "lucide-react";

export default function DoctorReview() {
  const navigate = useNavigate();
  const [screenings, setScreenings] = useState(null);
  const [active, setActive] = useState(null);
  const [notes, setNotes] = useState("");
  const [risk, setRisk] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setScreenings(null);
    api.get("/screenings", { params: { review_status: "pending" } }).then((r) => setScreenings(r.data));
  };
  useEffect(() => { load(); }, []);

  const openReview = (s) => {
    setActive(s);
    setNotes(s.doctor_notes || "");
    setRisk(s.confirmed_risk_level || s.result?.risk_level || "");
    setFollowUp(s.follow_up_date || "");
  };

  const submit = async () => {
    if (!notes.trim()) { toast.error("Add clinical notes"); return; }
    setSaving(true);
    try {
      await api.post(`/screenings/${active.id}/review`, {
        notes, confirmed_risk_level: risk, follow_up_date: followUp, status: "reviewed",
      });
      toast.success("Review saved");
      setActive(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <Stethoscope className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900">Doctor Review</h1>
          <p className="text-slate-600">Review and confirm pending screenings.</p>
        </div>
      </div>

      {screenings === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : screenings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-emerald-900/10 p-12 text-center text-slate-500">
          No pending screenings. All caught up!
        </div>
      ) : (
        <div className="space-y-3" data-testid="review-list">
          {screenings.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4" data-testid={`review-card-${s.id}`}>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="font-heading text-2xl font-bold text-primary">{s.result?.oa_probability}%</p>
                  <RiskBadge level={s.result?.risk_level} />
                </div>
                <div className="text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">{s.patient_name}</p>
                  <p>{s.patient_village || "—"} · {new Date(s.created_at).toLocaleDateString()}</p>
                  <p className="text-xs">Stability {s.result?.knee_stability_score}/100 · Confidence {s.result?.confidence}%</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate(`/app/result/${s.id}`)} data-testid={`review-view-${s.id}`}>
                  <Eye className="w-4 h-4 mr-1" /> Details
                </Button>
                <Button size="sm" className="rounded-xl" onClick={() => openReview(s)} data-testid={`review-open-${s.id}`}>Review</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Review — {active?.patient_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Confirmed risk level</label>
              <Select value={risk} onValueChange={setRisk}>
                <SelectTrigger className="mt-1.5 h-11 rounded-xl" data-testid="review-risk-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["Low", "Moderate", "High", "Severe"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Follow-up date</label>
              <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} data-testid="review-followup-input" className="mt-1.5 h-11 rounded-xl" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Clinical notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} data-testid="review-notes-input" className="mt-1.5 rounded-xl" placeholder="Prescribe physiotherapy protocol, medication, referral..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setActive(null)}>Cancel</Button>
            <Button className="rounded-xl" onClick={submit} disabled={saving} data-testid="review-submit-button">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
