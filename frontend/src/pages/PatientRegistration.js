import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { queueOffline } from "@/lib/offline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

const VILLAGES = ["Guwahati", "Dibrugarh", "Silchar", "Tezpur", "Jorhat", "Nagaon", "Tinsukia", "Barpeta", "Other"];

export default function PatientRegistration() {
  const navigate = useNavigate();
  const [f, setF] = useState({
    name: "", age: "", gender: "", height_cm: "", weight_kg: "",
    occupation: "", village: "", district: "", phone: "", medical_history: "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const bmi = (() => {
    const h = parseFloat(f.height_cm) / 100;
    const w = parseFloat(f.weight_kg);
    if (h > 0 && w > 0) return (w / (h * h)).toFixed(1);
    return null;
  })();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      ...f,
      age: parseInt(f.age, 10),
      height_cm: f.height_cm ? parseFloat(f.height_cm) : null,
      weight_kg: f.weight_kg ? parseFloat(f.weight_kg) : null,
      bmi: bmi ? parseFloat(bmi) : null,
    };
    try {
      const { data } = await api.post("/patients", payload);
      toast.success("Patient registered");
      navigate(`/app/patients/${data.id}`);
    } catch (err) {
      if (!navigator.onLine) {
        await queueOffline("patient", payload);
        toast.warning("Offline — patient saved locally, will sync later");
        navigate("/app/patients");
      } else {
        toast.error(formatApiError(err.response?.data?.detail) || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Register Patient</h1>
          <p className="text-sm text-slate-600">Enter patient details to begin screening.</p>
        </div>
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <Label>Full name *</Label>
            <Input required value={f.name} onChange={set("name")} data-testid="patient-name-input" className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={f.phone} onChange={set("phone")} data-testid="patient-phone-input" className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label>Age *</Label>
            <Input required type="number" min="1" value={f.age} onChange={set("age")} data-testid="patient-age-input" className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label>Gender *</Label>
            <Select value={f.gender} onValueChange={(v) => setF({ ...f, gender: v })}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl" data-testid="patient-gender-select"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Height (cm)</Label>
            <Input type="number" value={f.height_cm} onChange={set("height_cm")} data-testid="patient-height-input" className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label>Weight (kg)</Label>
            <Input type="number" value={f.weight_kg} onChange={set("weight_kg")} data-testid="patient-weight-input" className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label>BMI (auto)</Label>
            <Input readOnly value={bmi || ""} placeholder="—" data-testid="patient-bmi-value" className="mt-1.5 h-11 rounded-xl bg-muted" />
          </div>
          <div>
            <Label>Occupation</Label>
            <Input value={f.occupation} onChange={set("occupation")} data-testid="patient-occupation-input" className="mt-1.5 h-11 rounded-xl" placeholder="Farmer, weaver..." />
          </div>
          <div>
            <Label>Village</Label>
            <Select value={f.village} onValueChange={(v) => setF({ ...f, village: v })}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl" data-testid="patient-village-select"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {VILLAGES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>District</Label>
            <Input value={f.district} onChange={set("district")} data-testid="patient-district-input" className="mt-1.5 h-11 rounded-xl" />
          </div>
        </div>
        <div>
          <Label>Medical history</Label>
          <Textarea value={f.medical_history} onChange={set("medical_history")} data-testid="patient-history-input" className="mt-1.5 rounded-xl" rows={3} placeholder="Previous injuries, diabetes, joint pain history..." />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={loading} data-testid="patient-submit-button" className="h-11 rounded-xl px-6">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Register & continue"}
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => navigate("/app/patients")}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
