import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle, FileDown, Printer, Save, CheckCircle2,
  Camera, RadioTower, Stethoscope, PenLine, CloudOff, BadgeCheck, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { queueOffline } from "@/lib/offline";
import { useAssessment } from "../AssessmentContext";
import { flowApi, isNetworkError, errorText } from "../api";
import { ACTIONS, buildReport } from "../buildResults";
import { downloadReportPdf, printReportPdf } from "../report";
import { deleteDraft } from "../draftStore";
import FlowNav from "../components/FlowNav";
import CalibrationBadge from "../components/CalibrationBadge";
import CadenceCheck from "../components/CadenceCheck";

const BAND = {
  Low: { cls: "bg-emerald-600", ring: "ring-emerald-200", text: "text-emerald-700", icon: ShieldCheck, label: "Low" },
  Moderate: { cls: "bg-amber-500", ring: "ring-amber-200", text: "text-amber-700", icon: AlertTriangle, label: "Moderate" },
  High: { cls: "bg-red-600", ring: "ring-red-200", text: "text-red-700", icon: AlertOctagon, label: "High" },
  "Not determined": { cls: "bg-slate-500", ring: "ring-slate-200", text: "text-slate-700", icon: HelpCircle, label: "Not determined" },
};
const MOD_ICON = { vision: Camera, imu: RadioTower, clinical: Stethoscope };
const MOD_NAME = { vision: "Camera gait", imu: "IMU", clinical: "Clinical" };

/** Horizontal scale 0-100 with the calibrated cut-offs at 90 and 97.5. */
function DeviationScale({ value }) {
  const pos = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="mt-3" aria-hidden="true">
      <div className="relative h-3 rounded-full" style={{ background: "linear-gradient(90deg,#059669 0%,#059669 90%,#f59e0b 90%,#f59e0b 97.5%,#dc2626 97.5%)" }}>
        {value != null && <span className="absolute -top-1.5 h-6 w-1.5 -translate-x-1/2 rounded bg-slate-900 ring-2 ring-white" style={{ left: `${pos}%` }} />}
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-slate-500">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: "90%" }}>90</span>
        <span className="absolute right-0">100</span>
      </div>
    </div>
  );
}

export default function Step5RiskResults({ nav }) {
  const { draft, update } = useAssessment();
  const { user } = useAuth();
  const mm = draft.multimodal;
  const pending = !mm || mm.status !== "done";
  const [saving, setSaving] = useState(false);

  // Build (or refresh) the report from the analysis, keeping clinician input.
  const report = useMemo(() => {
    if (pending) {
      return {
        band: "Not determined", riskScore: null, topDrivers: [], recommendedAction: draft.report?.recommendedAction || "re-screen",
        suggestedAction: "re-screen", actionRationale: "Analysis pending: it runs on the server when the screening is uploaded.",
        clinicianNotes: draft.report?.clinicianNotes || "", signOff: draft.report?.signOff,
        screeningId: draft.report?.screeningId, sync: draft.report?.sync || "local",
      };
    }
    return buildReport(mm, draft.patient, draft.report);
  }, [mm, pending, draft.patient, draft.report]);

  useEffect(() => {
    if (!draft.report || draft.stale?.results) update("results", { report }, { invalidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setReport = (patch) => update("results", { report: { ...report, ...patch } }, { invalidate: false });
  const saved = !!report.screeningId || report.sync === "queued";
  const canSign = user && ["doctor", "admin"].includes(user.role);
  const band = BAND[report.band] || BAND["Not determined"];
  const BandIcon = band.icon;
  const withReport = { ...draft, report };

  const sign = () => {
    if (!canSign) return;
    setReport({ signOff: { by: user.name, userId: user.id, at: new Date().toISOString() } });
    toast.success(`Signed by ${user.name}`);
  };

  const saveScreening = async () => {
    setSaving(true);
    try {
      if (!draft.patient.serverId || pending) throw Object.assign(new Error("offline"), { offline: true });
      const doc = await flowApi.saveScreening(draft, report);
      let next = { ...report, screeningId: doc.id, sync: "synced" };
      if (report.signOff) {
        await flowApi.signOff(doc.id, report);
        next = { ...next, signOffSynced: true };
      }
      update("results", { report: next }, { complete: true, invalidate: false });
      toast.success("Screening saved. Dashboard figures are updated.");
    } catch (err) {
      if (err.offline || isNetworkError(err)) {
        await queueOffline("assessment", { draftId: draft.draftId });
        update("results", { report: { ...report, sync: "queued" } }, { complete: true, invalidate: false });
        toast.warning("No connection: screening saved on this device and will upload automatically.");
      } else {
        toast.error(`Couldn't save: ${errorText(err)}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Disclaimer */}
      {mm?.isDemo && (
        <p className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Contains simulated data
        </p>
      )}

      {/* Band + score */}
      <section aria-labelledby="res-band" className={`grid gap-5 rounded-2xl bg-white p-5 shadow-sm ring-2 ${band.ring} lg:grid-cols-5`} data-testid="results-band">
        <div className={`flex items-center gap-4 rounded-xl ${band.cls} p-5 text-white lg:col-span-2`}>
          <BandIcon className="h-12 w-12 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-90">OA risk band</p>
            <h2 id="res-band" className="font-heading text-3xl font-bold" data-testid="results-band-value">{band.label}</h2>
            <p className="text-xs opacity-90">
              {pending ? "Analysis pending" : mm.bandSource === "vision" ? "From calibrated camera gait" : mm.bandSource === "imu" ? "From IMU (uncalibrated)" : "No score available"}
            </p>
          </div>
        </div>
        <div className="lg:col-span-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <p className="text-sm text-slate-600">Risk score (gait deviation)</p>
              <p className="font-heading text-4xl font-bold text-slate-900" data-testid="results-score">
                {report.riskScore != null ? report.riskScore.toFixed(1) : "—"}
                <span className="ml-1 text-base font-medium text-slate-500">/ 100</span>
              </p>
            </div>
            {!pending && <CalibrationBadge calibrated={mm.bandSource === "vision" && mm.gaitCalibrated}
              demo={!!mm.demo?.[mm.bandSource === "imu" ? "imu" : "vision"]} />}
          </div>
          {!pending && mm.bandSource === "vision" && <DeviationScale value={report.riskScore} />}
          <p className="mt-2 text-sm text-slate-600">
            {pending
              ? "No connection when analysing. The score is computed on the server when the screening is uploaded."
              : mm.bandSource === "vision"
                ? `Gait less typical than ${report.riskScore.toFixed(1)}% of 3,003 reference walking trials. Low ≤ 90 · Moderate ≤ 97.5 · High > 97.5.`
                : mm.bandSource === "imu"
                  ? "No camera score: the band comes from the IMU irregularity index, which has provisional (uncalibrated) cut-offs."
                  : "No usable data to score."}
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Drivers */}
        <section aria-labelledby="res-drivers" className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm lg:col-span-3">
          <h2 id="res-drivers" className="font-heading text-lg font-semibold text-slate-900">Top contributing factors</h2>
          <p className="text-xs text-slate-500">Ranked by distance from the reference, then by modality</p>
          <ol className="mt-3 space-y-2" data-testid="results-drivers">
            {report.topDrivers.length === 0 && <li className="text-sm text-slate-400">{pending ? "Available after analysis." : "No notable factors."}</li>}
            {report.topDrivers.map((d, i) => {
              const Icon = MOD_ICON[d.modality];
              return (
                <li key={`${d.label}-${i}`} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{d.label}</p>
                    <p className="text-sm text-slate-600">{d.detail}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                    <Icon className="h-3 w-3" aria-hidden="true" /> {MOD_NAME[d.modality]}{!d.calibrated && d.modality !== "clinical" ? " · uncal." : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Per-modality */}
        <section aria-labelledby="res-modalities" className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 id="res-modalities" className="font-heading text-lg font-semibold text-slate-900">Per-modality breakdown</h2>
          <ul className="mt-3 space-y-3">
            {(mm?.modalities || []).map((m) => {
              const Icon = MOD_ICON[m.modality];
              return (
                <li key={m.modality} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon className="h-4 w-4 text-primary" aria-hidden="true" />{MOD_NAME[m.modality]}</p>
                    <CalibrationBadge calibrated={m.calibrated} demo={!!mm.demo?.[m.modality]} notScored={m.modality === "clinical"} />
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{m.headline}</p>
                </li>
              );
            })}
            {pending && <li className="text-sm text-slate-400">Available after analysis.</li>}
          </ul>
          {!pending && (
            <p className="mt-3 text-xs text-slate-500">
              {mm.dataQuality.usableCameraTrials} camera · {mm.dataQuality.usableImuTrials} IMU trials analysed.
            </p>
          )}
          {!pending && mm.cadenceCheck && <div className="mt-3"><CadenceCheck check={mm.cadenceCheck} /></div>}
        </section>
      </div>

      {/* Action + notes + sign-off */}
      <section aria-labelledby="res-action" className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h2 id="res-action" className="font-heading text-lg font-semibold text-slate-900">Recommended next action</h2>
          <fieldset className="mt-2" disabled={saved}>
            <legend className="sr-only">Next action</legend>
            <div className="grid gap-2 sm:grid-cols-4">
              {Object.entries(ACTIONS).map(([k, label]) => (
                <label key={k} className={`relative flex min-h-[52px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm focus-within:ring-2 focus-within:ring-primary
                  ${report.recommendedAction === k ? "border-primary bg-accent font-semibold" : "border-slate-300 bg-white"}`}>
                  <input type="radio" name="nextAction" value={k} checked={report.recommendedAction === k}
                    onChange={() => setReport({ recommendedAction: k })} className="accent-emerald-600" />
                  {label}
                  {report.suggestedAction === k && <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 text-[10px] font-bold text-white">Suggested</span>}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-2 text-sm text-slate-600" data-testid="results-rationale">{report.actionRationale}</p>
        </div>

        <div>
          <label htmlFor="clinicianNotes" className="text-sm font-medium text-slate-800">Clinician notes</label>
          <textarea id="clinicianNotes" rows={4} disabled={saved} value={report.clinicianNotes}
            onChange={(e) => setReport({ clinicianNotes: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:bg-slate-50"
            placeholder="Examination findings, context, plan…" />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3" data-testid="results-signoff">
          {report.signOff ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <BadgeCheck className="h-5 w-5" aria-hidden="true" /> Signed by {report.signOff.by} · {new Date(report.signOff.at).toLocaleString()}
            </p>
          ) : (
            <>
              <Button type="button" variant="outline" className="rounded-xl" onClick={sign} disabled={!canSign || saved} data-testid="results-sign">
                <PenLine className="mr-2 h-4 w-4" aria-hidden="true" /> Sign off as {user?.name || "clinician"}
              </Button>
              {!canSign && <p className="text-xs text-slate-500">Sign-off requires a doctor account (e.g. Dr. Lakshya).</p>}
            </>
          )}
        </div>
      </section>

      {/* Output actions */}
      <section aria-label="Report actions" className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm">
        <Button type="button" variant="outline" className="rounded-xl h-11" onClick={() => downloadReportPdf(withReport, user)} data-testid="results-pdf">
          <FileDown className="mr-2 h-4 w-4" aria-hidden="true" /> Download PDF
        </Button>
        <Button type="button" variant="outline" className="rounded-xl h-11" onClick={() => printReportPdf(withReport, user)}>
          <Printer className="mr-2 h-4 w-4" aria-hidden="true" /> Print
        </Button>
        <div className="flex-1" />
        {report.screeningId ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700" role="status" data-testid="results-saved">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Saved · <Link to="/app/dashboard" className="underline">Dashboard</Link> ·
            <Link to="/app/assess/new" onClick={() => deleteDraft(draft.draftId)} className="underline">New assessment</Link>
          </p>
        ) : report.sync === "queued" ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-sky-700" role="status" data-testid="results-queued">
            <CloudOff className="h-5 w-5" aria-hidden="true" /> Saved on this device · uploads when online
          </p>
        ) : (
          <Button type="button" className="rounded-xl h-11 px-6" onClick={saveScreening} disabled={saving} data-testid="results-save">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
            Save screening
          </Button>
        )}
      </section>

      <FlowNav onBack={saved ? null : nav.goBack} />
    </div>
  );
}
