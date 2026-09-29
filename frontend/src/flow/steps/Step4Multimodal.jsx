import React, { useCallback, useEffect, useState } from "react";
import { Loader2, CloudOff, RefreshCw, Camera, Stethoscope, RadioTower, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssessment } from "../AssessmentContext";
import { flowApi, isNetworkError, errorText } from "../api";
import { buildMultimodal } from "../buildResults";
import FlowNav from "../components/FlowNav";
import CalibrationBadge from "../components/CalibrationBadge";
import CadenceCheck from "../components/CadenceCheck";

const ICONS = { clinical: Stethoscope, vision: Camera, imu: RadioTower };
const TITLES = { clinical: "Clinical intake", vision: "Camera gait (vision)", imu: "IMU wearable" };
const ROLE = {
  vision: "Sets the risk band (calibrated against 3,003 reference walking trials).",
  imu: "Shown for context. Sets the band only if there is no camera score.",
  clinical: "Listed for the clinician. Not weighted into the score.",
};

export default function Step4Multimodal({ nav }) {
  const { draft, update } = useAssessment();
  const mm = draft.multimodal;
  const [status, setStatus] = useState(mm && !draft.stale?.multimodal ? mm.status : "idle");
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setStatus("processing");
    setError("");
    try {
      let d = draft;
      // Patient saved only on this device (offline in step 1): upload it first.
      if (!d.patient.serverId) {
        const serverId = await flowApi.createPatient(d.patient);
        d = { ...d, patient: { ...d.patient, serverId, sync: "synced" } };
        update("details", { patient: d.patient }, { invalidate: false });
      }
      const result = await flowApi.analyze(d);
      update("multimodal", { multimodal: buildMultimodal(result, d) }, { complete: true });
      setStatus("done");
    } catch (err) {
      if (isNetworkError(err)) {
        update("multimodal", { multimodal: { status: "offline", isDemo: false } }, { complete: true });
        setStatus("offline");
      } else {
        setError(errorText(err));
        setStatus("error");
      }
    }
  }, [draft, update]);

  // Run automatically on arrival (or when earlier steps changed).
  useEffect(() => {
    if (status === "idle") run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = draft.multimodal;
  const done = status === "done" && current?.status === "done";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong>Gait deviation is not an OA probability.</strong> It is the share of reference walking trials that look
          more typical than this patient's gait. The reference cohort contains no diagnosed OA patients.
        </p>
      </div>

      {status === "processing" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white p-10 text-center shadow-sm" role="status" data-testid="mm-processing">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="font-semibold text-slate-800">Analysing clinical, camera and IMU data…</p>
          <p className="text-sm text-slate-500">
            Scoring {draft.cameraTrials.filter((t) => t.accepted).length} camera trials against the reference cohort and
            {" "}{(draft.imu?.trials || []).filter((t) => t.accepted).length} IMU trials. If the server was asleep this can take up to a minute.
          </p>
        </div>
      )}

      {status === "offline" && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-950" role="status" data-testid="mm-offline">
          <p className="flex items-center gap-2 font-semibold"><CloudOff className="h-4 w-4" aria-hidden="true" /> No connection: analysis pending</p>
          <p className="mt-1">All captured data is saved on this device. The analysis runs on the server when you save the screening
            and the connection returns. You can continue; the results page will show the band as pending.</p>
          <Button variant="outline" className="mt-3 rounded-xl" onClick={run}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Try again</Button>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900" role="alert">
          <p className="font-semibold">Analysis failed</p>
          <p className="mt-1">{error}</p>
          <Button variant="outline" className="mt-3 rounded-xl" onClick={run}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Retry</Button>
        </div>
      )}

      {done && (
        <>
          <section aria-labelledby="mm-headline" className="grid gap-4 rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm sm:grid-cols-3" data-testid="mm-summary">
            <div className="sm:col-span-1">
              <h2 id="mm-headline" className="text-sm font-medium text-slate-600">Gait deviation</h2>
              <p className="mt-1 font-heading text-4xl font-bold text-slate-900" data-testid="mm-gait-deviation">
                {current.gaitDeviation != null ? current.gaitDeviation.toFixed(1) : "—"}
              </p>
              <div className="mt-1"><CalibrationBadge calibrated={current.gaitCalibrated} demo={!!current.demo?.vision} /></div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Risk band</p>
              <p className="mt-1 font-heading text-2xl font-bold text-slate-900">{current.band}</p>
              <p className="text-xs text-slate-500">From: {current.bandSource === "vision" ? "camera gait (calibrated)" : current.bandSource === "imu" ? "IMU (uncalibrated)" : "no score"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Data quality</p>
              <p className="mt-1 text-sm text-slate-800">{current.dataQuality.usableCameraTrials} camera · {current.dataQuality.usableImuTrials} IMU trials</p>
              <p className="text-xs text-slate-500">{current.dataQuality.missingMeasurements} camera measurement(s) not captured</p>
            </div>
          </section>

          <CadenceCheck check={current.cadenceCheck} />

          <div className="grid gap-4 lg:grid-cols-3">
            {current.modalities.map((m) => {
              const Icon = ICONS[m.modality];
              return (
                <section key={m.modality} aria-labelledby={`mm-${m.modality}`} className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm" data-testid={`mm-${m.modality}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 id={`mm-${m.modality}`} className="flex items-center gap-2 font-heading font-semibold text-slate-900">
                      <Icon className="h-4 w-4 text-primary" aria-hidden="true" /> {TITLES[m.modality]}
                    </h3>
                    <CalibrationBadge calibrated={m.calibrated} demo={!!current.demo?.[m.modality]} notScored={m.modality === "clinical"} />
                  </div>
                  <p className="mt-2 font-semibold text-slate-800">{m.headline}</p>
                  <p className="mt-1 text-xs text-slate-500">{ROLE[m.modality]}</p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {m.factors.length === 0 && <li className="text-slate-400">Nothing to report.</li>}
                    {m.factors.map((f) => (
                      <li key={f.label} className="flex justify-between gap-3">
                        <span className="text-slate-600">{f.label}</span>
                        <span className="text-right font-mono text-slate-900">{f.value}{f.zScore != null ? ` · z ${f.zScore > 0 ? "+" : ""}${f.zScore}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          {current.dataQuality.flags.length > 0 && (
            <section aria-labelledby="mm-flags" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <h3 id="mm-flags" className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4" aria-hidden="true" /> Calibration & data-quality notes</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">{current.dataQuality.flags.map((f) => <li key={f}>{f}</li>)}</ul>
            </section>
          )}
          <p className="text-xs text-slate-500">
            No fusion weights or confidence percentage are shown: there is no outcome data to calibrate them, so any such number would be invented.
          </p>
        </>
      )}

      <FlowNav onBack={nav.goBack} onNext={() => nav.goNext()}
        nextDisabled={!(done || status === "offline")} busy={status === "processing"}
        nextLabel="View OA risk results" />
    </div>
  );
}
