import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAssessment } from "../AssessmentContext";
import { flowApi, isNetworkError, errorText } from "../api";
import { newId } from "../draftStore";
import FlowNav from "../components/FlowNav";
import { validate, computeBmi } from "../patientValidation";

/** @typedef {import("../types").Patient} Patient */

const EMPTY = {
  fullName: "", age: "", sex: "", village: "", block: "", phone: "",
  heightCm: "", weightKg: "", occupation: "", familyHistoryOA: "",
  diabetes: false, hypertension: false, symptomDurationMonths: "",
  affectedSide: "", painScore: "", priorInjuryOrSurgery: "",
};

function fromPatient(p) {
  if (!p) return EMPTY;
  return {
    fullName: p.fullName, age: String(p.age), sex: p.sex, village: p.village, block: p.block || "",
    phone: p.phone || "", heightCm: String(p.heightCm), weightKg: String(p.weightKg),
    occupation: p.occupation || "", familyHistoryOA: p.familyHistoryOA ? "yes" : "no",
    diabetes: p.comorbidities.diabetes, hypertension: p.comorbidities.hypertension,
    symptomDurationMonths: String(p.symptomDurationMonths), affectedSide: p.affectedSide,
    painScore: String(p.painScore), priorInjuryOrSurgery: p.priorInjuryOrSurgery || "",
  };
}

const ORDER = ["fullName", "age", "sex", "village", "phone", "heightCm", "weightKg", "familyHistoryOA",
  "symptomDurationMonths", "affectedSide", "painScore"];

const inputCls = (err) =>
  `mt-1.5 block w-full h-11 rounded-xl border bg-white px-3 text-base sm:text-sm text-slate-900 shadow-sm
   focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${err ? "border-red-500" : "border-slate-300"}`;

function Field({ id, label, required, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}{required && <span className="text-red-600" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-700" role="alert">{error}</p>}
    </div>
  );
}

function Choice({ name, legend, options, value, onChange, error, required }) {
  return (
    <fieldset id={name} tabIndex={-1} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined}
      className="focus:outline-none">
      <legend className="text-sm font-medium text-slate-800">
        {legend}{required && <span className="text-red-600" aria-hidden="true"> *</span>}
      </legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map(([v, l]) => (
          <label key={v} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm
            focus-within:ring-2 focus-within:ring-primary ${value === v ? "border-primary bg-accent font-semibold" : "border-slate-300 bg-white"}`}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="accent-emerald-600" />
            {l}
          </label>
        ))}
      </div>
      {error && <p id={`${name}-error`} className="mt-1 text-xs font-medium text-red-700" role="alert">{error}</p>}
    </fieldset>
  );
}

export default function Step1PatientDetails({ nav }) {
  const { draft, update } = useAssessment();
  const [f, setF] = useState(() => fromPatient(draft.patient));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  const bmi = useMemo(() => computeBmi(f.heightCm, f.weightKg), [f.heightCm, f.weightKg]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e && e.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));
  const aria = (k) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${k}-error` : undefined });

  const next = async () => {
    const e = validate(f);
    setErrors(e);
    const first = ORDER.find((k) => e[k]);
    if (first) {
      formRef.current?.querySelector(`#${first}`)?.focus();
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const prev = draft.patient;
    /** @type {Patient} */
    const patient = {
      localId: prev?.localId || newId(),
      serverId: prev?.serverId,
      fullName: f.fullName.trim(),
      age: Number(f.age),
      sex: f.sex,
      village: f.village.trim(),
      block: f.block.trim() || undefined,
      phone: f.phone.replace(/\D/g, "").slice(-10) || undefined,
      heightCm: Number(f.heightCm),
      weightKg: Number(f.weightKg),
      bmi,
      occupation: f.occupation.trim() || undefined,
      familyHistoryOA: f.familyHistoryOA === "yes",
      comorbidities: { diabetes: !!f.diabetes, hypertension: !!f.hypertension },
      symptomDurationMonths: Number(f.symptomDurationMonths),
      affectedSide: f.affectedSide,
      painScore: Number(f.painScore),
      priorInjuryOrSurgery: f.priorInjuryOrSurgery.trim() || undefined,
      createdAt: prev?.createdAt || new Date().toISOString(),
      sync: prev?.sync || "local",
    };
    const { serverId: _a, sync: _b, ...cmpNew } = patient;
    const changed = !prev || JSON.stringify(cmpNew) !== JSON.stringify((({ serverId, sync, ...r }) => r)(prev));

    // Create (or update) the patient record now; it is referenced by every later step.
    setBusy(true);
    try {
      if (!patient.serverId) patient.serverId = await flowApi.createPatient(patient);
      else if (changed) await flowApi.updatePatient(patient.serverId, patient);
      patient.sync = "synced";
    } catch (err) {
      if (isNetworkError(err)) {
        patient.sync = "local";
        toast.warning("No connection: patient saved on this device and will be uploaded later.");
      } else {
        setBusy(false);
        toast.error(`Couldn't save the patient: ${errorText(err)}`);
        return;
      }
    }
    setBusy(false);
    update("details", { patient }, { complete: true, invalidate: changed });
    nav.goNext();
  };

  return (
    <form ref={formRef} noValidate onSubmit={(e) => { e.preventDefault(); next(); }} className="space-y-5">
      <section aria-labelledby="sec-identity" className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm">
        <h2 id="sec-identity" className="font-heading text-lg font-semibold text-slate-900">Identity & contact</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="fullName" label="Full name" required error={errors.fullName}>
            <input id="fullName" autoComplete="off" className={inputCls(errors.fullName)} value={f.fullName} onChange={set("fullName")} {...aria("fullName")} />
          </Field>
          <Field id="age" label="Age (years)" required error={errors.age}>
            <input id="age" inputMode="numeric" className={inputCls(errors.age)} value={f.age} onChange={set("age")} {...aria("age")} />
          </Field>
          <Choice name="sex" legend="Sex" required value={f.sex} onChange={set("sex")} error={errors.sex}
            options={[["female", "Female"], ["male", "Male"], ["other", "Other"]]} />
          <Field id="phone" label="Phone" error={errors.phone} hint="Optional, 10 digits.">
            <input id="phone" inputMode="tel" autoComplete="off" className={inputCls(errors.phone)} value={f.phone} onChange={set("phone")} {...aria("phone")} />
          </Field>
          <Field id="village" label="Village" required error={errors.village}>
            <input id="village" className={inputCls(errors.village)} value={f.village} onChange={set("village")} {...aria("village")} />
          </Field>
          <Field id="block" label="Block / Tehsil">
            <input id="block" className={inputCls(false)} value={f.block} onChange={set("block")} />
          </Field>
          <Field id="occupation" label="Occupation">
            <input id="occupation" className={inputCls(false)} value={f.occupation} onChange={set("occupation")} placeholder="Farmer, weaver…" />
          </Field>
        </div>
      </section>

      <section aria-labelledby="sec-body" className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm">
        <h2 id="sec-body" className="font-heading text-lg font-semibold text-slate-900">Body measurements</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field id="heightCm" label="Height (cm)" required error={errors.heightCm}>
            <input id="heightCm" inputMode="decimal" className={inputCls(errors.heightCm)} value={f.heightCm} onChange={set("heightCm")} {...aria("heightCm")} />
          </Field>
          <Field id="weightKg" label="Weight (kg)" required error={errors.weightKg}>
            <input id="weightKg" inputMode="decimal" className={inputCls(errors.weightKg)} value={f.weightKg} onChange={set("weightKg")} {...aria("weightKg")} />
          </Field>
          <Field id="bmi" label="BMI (automatic)">
            <output id="bmi" htmlFor="heightCm weightKg" aria-live="polite" data-testid="bmi-output"
              className="mt-1.5 flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-slate-800">
              {bmi ?? "—"}
            </output>
          </Field>
        </div>
      </section>

      <section aria-labelledby="sec-clinical" className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm">
        <h2 id="sec-clinical" className="font-heading text-lg font-semibold text-slate-900">Clinical history</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Choice name="familyHistoryOA" legend="Family history of OA" required value={f.familyHistoryOA} onChange={set("familyHistoryOA")}
            error={errors.familyHistoryOA} options={[["yes", "Yes"], ["no", "No"]]} />
          <fieldset>
            <legend className="text-sm font-medium text-slate-800">Comorbidities</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {[["diabetes", "Diabetes"], ["hypertension", "Hypertension"]].map(([k, l]) => (
                <label key={k} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm focus-within:ring-2 focus-within:ring-primary">
                  <input id={k} type="checkbox" checked={!!f[k]} onChange={set(k)} className="accent-emerald-600 h-4 w-4" /> {l}
                </label>
              ))}
            </div>
          </fieldset>
          <Field id="symptomDurationMonths" label="Symptom duration (months)" required error={errors.symptomDurationMonths} hint="0 if no knee symptoms.">
            <input id="symptomDurationMonths" inputMode="decimal" className={inputCls(errors.symptomDurationMonths)} value={f.symptomDurationMonths}
              onChange={set("symptomDurationMonths")} {...aria("symptomDurationMonths")} />
          </Field>
          <Choice name="affectedSide" legend="Affected side" required value={f.affectedSide} onChange={set("affectedSide")}
            error={errors.affectedSide} options={[["left", "Left"], ["right", "Right"], ["bilateral", "Both"]]} />
          <div className="sm:col-span-2">
            <Choice name="painScore" legend="Knee pain today (0 = none, 10 = worst)" required value={f.painScore}
              onChange={set("painScore")} error={errors.painScore}
              options={Array.from({ length: 11 }, (_, i) => [String(i), String(i)])} />
          </div>
          <div className="sm:col-span-2">
            <Field id="priorInjuryOrSurgery" label="Prior knee injury or surgery" hint="Leave empty if none.">
              <input id="priorInjuryOrSurgery" className={inputCls(false)} value={f.priorInjuryOrSurgery} onChange={set("priorInjuryOrSurgery")}
                placeholder="e.g. ligament tear 2019, arthroscopy 2021" />
            </Field>
          </div>
        </div>
      </section>

      <FlowNav onBack={nav.goBack} onNext={next} busy={busy} nextLabel="Save & continue to camera" />
    </form>
  );
}
