import React from "react";
import { toast } from "sonner";
import { Info, FlaskConical } from "lucide-react";
import CameraPanel from "@/components/CameraPanel";
import { Button } from "@/components/ui/button";
import { useAssessment } from "../AssessmentContext";
import { USE_MOCK } from "../api";
import FlowNav from "../components/FlowNav";
import TrialStrip from "../components/TrialStrip";

/** @typedef {import("../types").CameraTrial} CameraTrial */

const FEATURE_KEYS = [
  "right_knee_rom_deg", "left_knee_rom_deg", "right_hip_rom_deg", "left_hip_rom_deg",
  "step_duration_sec", "stride_duration_sec", "cadence_steps_min",
  "knee_rom_asymmetry_pct", "step_time_asymmetry_pct", "trunk_lean_deg",
];
const MIN_MEASURED = 6; // same rule as the backend model (MIN_MEASURED_FEATURES)
const MIN_FRAMES = 5;

/** Demo-only trial (mock mode): values near the reference cohort, clearly marked. */
function demoFeatures() {
  const j = (m, sd) => +(m + (Math.random() - 0.5) * sd).toFixed(2);
  return {
    right_knee_rom_deg: j(62, 20), left_knee_rom_deg: j(60, 20), right_hip_rom_deg: j(68, 20),
    left_hip_rom_deg: j(72, 20), step_duration_sec: j(0.55, 0.1), stride_duration_sec: j(1.1, 0.2),
    cadence_steps_min: j(110, 20), knee_rom_asymmetry_pct: j(18, 10), step_time_asymmetry_pct: j(15, 10),
    trunk_lean_deg: j(5, 3),
  };
}

const WalkGuide = () => (
  <div className="pointer-events-none absolute inset-0 flex items-end justify-center" aria-hidden="true">
    <div className="absolute inset-y-[8%] left-[30%] right-[30%] rounded-[40%] border-2 border-dashed border-emerald-300/70" />
    <div className="absolute bottom-[10%] left-[8%] right-[8%] border-t-2 border-dashed border-emerald-300/70" />
    <p className="relative mb-2 rounded-lg bg-slate-900/75 px-3 py-1 text-xs font-medium text-white">
      Whole body inside the outline · walk along the line, side-on to the camera
    </p>
  </div>
);

export default function Step2CameraCapture({ nav }) {
  const { draft, update } = useAssessment();
  const trials = draft.cameraTrials;
  const required = draft.trialsRequired;
  const usable = trials.filter((t) => t.accepted).length;

  const save = (next, trialsRequired = required) =>
    update("camera", { cameraTrials: next, trialsRequired }, { invalidate: true });

  const addTrial = (summary, isDemo = false) => {
    const features = {};
    for (const k of FEATURE_KEYS) features[k] = summary[k] ?? null;
    const missing = FEATURE_KEYS.filter((k) => features[k] == null).length;
    const walking = isDemo || (summary.frames_captured || 0) >= MIN_FRAMES;
    const accepted = walking && FEATURE_KEYS.length - missing >= MIN_MEASURED;
    /** @type {CameraTrial} */
    const trial = {
      index: (trials.at(-1)?.index || 0) + 1,
      startedAt: new Date(Date.now() - (summary.duration_sec || 0) * 1000).toISOString(),
      durationSec: summary.duration_sec || 0,
      framesCaptured: summary.frames_captured || 0,
      features,
      missingFeatures: missing,
      thumbnail: summary.thumbnail,
      accepted,
      isDemo,
    };
    save([...trials, trial]);
    if (accepted) toast.success(`Trial ${trial.index} recorded (${10 - missing}/10 measurements).`);
    else toast.error(walking
      ? `Trial ${trial.index} not usable: only ${10 - missing}/10 measurements captured. Walk fully in view and try again.`
      : `Trial ${trial.index} not usable: no walking detected. Repeat the walk in view of the camera.`);
  };

  const remove = (t) => save(trials.filter((x) => x !== t));

  const next = () => {
    if (usable < required) return;
    update("camera", {}, { complete: true, invalidate: false });
    nav.goNext();
  };

  const withDetail = trials.map((t) => ({
    ...t,
    detail: t.accepted ? `${10 - t.missingFeatures}/10 measured · ${t.durationSec}s` : "Not usable",
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">How to record a walking trial</p>
          <ol className="mt-1 list-decimal pl-5 space-y-0.5">
            <li>Place the phone/laptop at hip height, 3–4 m away, side-on to the walking path.</li>
            <li>Tap <strong>Enable Webcam</strong>, then <strong>Start 5-Meter Test</strong>.</li>
            <li>Patient walks at a comfortable pace across the frame; tap <strong>Stop Recording</strong> at the end.</li>
            <li>Repeat until {required} usable trials are recorded. Only the measurements and one small snapshot per trial are kept, never video.</li>
          </ol>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="trialsRequired" className="text-sm font-medium text-slate-800">Trials required</label>
        <select id="trialsRequired" value={required} onChange={(e) => save(trials, Number(e.target.value))}
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        {USE_MOCK && (
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => addTrial({ ...demoFeatures(), frames_captured: 60, duration_sec: 6 }, true)}
            data-testid="add-demo-trial">
            <FlaskConical className="mr-2 h-4 w-4" aria-hidden="true" /> Add demo trial
          </Button>
        )}
      </div>

      <CameraPanel activeTestId="walk_5m" hideTestSelector overlayGuide={<WalkGuide />} onTrialComplete={(s) => addTrial(s)} />

      <section aria-labelledby="camera-trials" className="rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm">
        <h2 id="camera-trials" className="sr-only">Recorded trials</h2>
        <TrialStrip trials={withDetail} required={required} onRemove={remove} />
      </section>

      <FlowNav onBack={nav.goBack} onNext={next} nextDisabled={usable < required}
        hint={usable < required ? `${required - usable} more usable trial(s) needed` : null}
        nextLabel="Continue to IMU" />
    </div>
  );
}
