import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { patientStorageService } from "@/services/patientStorageService";
import { Button } from "@/components/ui/button";
import { User, Activity, ArrowRight, ShieldCheck, CheckSquare, Sparkles, Scale, Info } from "lucide-react";
import MedicalDisclaimer from "@/components/MedicalDisclaimer";
import { toast } from "sonner";

export default function PatientAssessment() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [form, setForm] = useState({
    id: id || `OA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    age: 48,
    sex: "Female",
    height_cm: 168,
    weight_kg: 74,
    bmi: 26.2,
    affected_side: "Right",
    pain_score: 5,
    pain_duration: "6-12 months",
    previous_oa: false,
    previous_injury: "Meniscus tear",
    activity_level: "Moderately Active",
    functional_tests: ["walk_5m", "sit_to_stand_5x", "knee_flexion"],
  });

  // Calculate BMI on height or weight changes
  useEffect(() => {
    const h = Number(form.height_cm) / 100;
    const w = Number(form.weight_kg);
    if (h > 0 && w > 0) {
      const calcBMI = +(w / (h * h)).toFixed(1);
      setForm((prev) => ({ ...prev, bmi: calcBMI }));
    }
  }, [form.height_cm, form.weight_kg]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleTest = (testKey) => {
    setForm((prev) => {
      const current = prev.functional_tests || [];
      const updated = current.includes(testKey)
        ? current.filter((t) => t !== testKey)
        : [...current, testKey];
      return { ...prev, functional_tests: updated };
    });
  };

  const handleBegin = (e) => {
    e.preventDefault();
    if (!form.id.trim()) {
      toast.error("Please enter a Patient Identifier.");
      return;
    }

    patientStorageService.savePatient(form);
    toast.success(`Patient record ${form.id} initialized.`);
    navigate("/app/multimodal");
  };

  const getBMICategory = (bmi) => {
    if (bmi < 18.5) return { label: "Underweight", color: "text-blue-600" };
    if (bmi < 25) return { label: "Normal weight", color: "text-emerald-600 font-semibold" };
    if (bmi < 30) return { label: "Overweight", color: "text-amber-600 font-semibold" };
    return { label: "Obese (Higher joint stress)", color: "text-rose-600 font-bold" };
  };

  const bmiCat = getBMICategory(form.bmi);

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      <MedicalDisclaimer compact={true} />

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
            Intake & Biomechanical Context
          </span>
          <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Patient Screening Assessment
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Collects essential demographic and joint metrics for the multimodal fusion model. No unnecessary sensitive personal information is requested.
          </p>
        </div>

        <form onSubmit={handleBegin} className="space-y-6">
          {/* Section 1: Demographics */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
              1. Patient Demographics & Anthropometrics
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Patient ID / Reference
                </label>
                <input
                  type="text"
                  value={form.id}
                  onChange={(e) => handleChange("id", e.target.value)}
                  className="w-full text-sm font-mono px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Age (Years)
                </label>
                <input
                  type="number"
                  min="18"
                  max="105"
                  value={form.age}
                  onChange={(e) => handleChange("age", Number(e.target.value))}
                  className="w-full text-sm font-mono px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Sex / Biological Gender
                </label>
                <select
                  value={form.sex}
                  onChange={(e) => handleChange("sex", e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  min="100"
                  max="240"
                  value={form.height_cm}
                  onChange={(e) => handleChange("height_cm", Number(e.target.value))}
                  className="w-full text-sm font-mono px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  min="30"
                  max="220"
                  value={form.weight_kg}
                  onChange={(e) => handleChange("weight_kg", Number(e.target.value))}
                  className="w-full text-sm font-mono px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Body Mass Index (BMI)
                </label>
                <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    {form.bmi} kg/m²
                  </span>
                  <span className={`text-[11px] ${bmiCat.color}`}>
                    {bmiCat.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Clinical Joint Presentation */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
              2. Knee Clinical Profile & Pain Severity
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Affected Limb / Side
                </label>
                <select
                  value={form.affected_side}
                  onChange={(e) => handleChange("affected_side", e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Right">Right Knee</option>
                  <option value="Left">Left Knee</option>
                  <option value="Bilateral">Bilateral (Both Knees)</option>
                  <option value="None">None (Preventative Screening)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Pain Duration
                </label>
                <select
                  value={form.pain_duration}
                  onChange={(e) => handleChange("pain_duration", e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="None">None / Asymptomatic</option>
                  <option value="< 3 months">&lt; 3 months (Acute)</option>
                  <option value="3-6 months">3-6 months (Subacute)</option>
                  <option value="6-12 months">6-12 months (Early Chronic)</option>
                  <option value="1-3 years">1-3 years (Established)</option>
                  <option value="> 3 years">&gt; 3 years (Chronic)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Previous OA Diagnosis
                </label>
                <select
                  value={form.previous_oa ? "Yes" : "No"}
                  onChange={(e) => handleChange("previous_oa", e.target.value === "Yes")}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="No">No prior diagnosis</option>
                  <option value="Yes">Yes, previously diagnosed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Previous Knee Injury / Trauma
                </label>
                <select
                  value={form.previous_injury}
                  onChange={(e) => handleChange("previous_injury", e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="None">None / No prior knee trauma</option>
                  <option value="Meniscus tear">Meniscus tear / repair</option>
                  <option value="ACL tear">ACL / Cruciate ligament rupture</option>
                  <option value="Patellar dislocation">Patellar dislocation</option>
                  <option value="Tibial fracture">Tibial / Femoral fracture</option>
                  <option value="Other">Other joint injury</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Physical Activity Level
                </label>
                <select
                  value={form.activity_level}
                  onChange={(e) => handleChange("activity_level", e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Sedentary">Sedentary (Desk work, &lt; 3,000 steps/day)</option>
                  <option value="Lightly Active">Lightly Active (Occasional walks, 3k-6k steps)</option>
                  <option value="Moderately Active">Moderately Active (Regular exercise, 7k-10k steps)</option>
                  <option value="High">High / Athlete (&gt; 10k steps / intense sport)</option>
                </select>
              </div>
            </div>

            {/* Pain Slider */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Visual Analog Scale (VAS) Knee Pain Score:
                </span>
                <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                  {form.pain_score} / 10 ({form.pain_score === 0 ? "No pain" : form.pain_score <= 3 ? "Mild" : form.pain_score <= 6 ? "Moderate" : "Severe"})
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={form.pain_score}
                onChange={(e) => handleChange("pain_score", Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0 (No Pain)</span>
                <span>5 (Moderate)</span>
                <span>10 (Worst Pain)</span>
              </div>
            </div>
          </div>

          {/* Section 3: Functional Assessment Checklist */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
              3. Functional Movement Assessment Protocol
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {[
                { id: "walk_5m", label: "Walking (5m Gait)" },
                { id: "sit_to_stand_5x", label: "Sit-to-Stand (5xSTS)" },
                { id: "knee_flexion", label: "Knee Flexion ROM" },
                { id: "knee_extension", label: "Knee Extension" },
                { id: "step_movement", label: "Step Movement" },
                { id: "single_leg_stance", label: "Single-Leg Stance" },
              ].map((test) => {
                const checked = form.functional_tests?.includes(test.id);
                return (
                  <button
                    type="button"
                    key={test.id}
                    onClick={() => toggleTest(test.id)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      checked
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <span>{test.label}</span>
                    <CheckSquare className={`w-4 h-4 ${checked ? "text-emerald-600" : "text-slate-300"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <Button
              type="submit"
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-6 rounded-2xl text-base shadow-md gap-2"
            >
              Begin Assessment
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
