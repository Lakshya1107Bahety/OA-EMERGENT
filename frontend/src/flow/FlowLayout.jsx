import React, { useEffect, useRef } from "react";
import { Navigate, useNavigate, useParams, Link } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { AssessmentProvider, useAssessment } from "./AssessmentContext";
import { STEPS, STEP_IDS, canOpen, firstOpenStep, stepIndex, stepPath } from "./flowSteps";
import Stepper from "./components/Stepper";
import PatientHeader from "./components/PatientHeader";
import Step1PatientDetails from "./steps/Step1PatientDetails";
import Step2CameraCapture from "./steps/Step2CameraCapture";
import Step3ImuCapture from "./steps/Step3ImuCapture";
import Step4Multimodal from "./steps/Step4Multimodal";
import Step5RiskResults from "./steps/Step5RiskResults";

const SCREENS = {
  details: Step1PatientDetails,
  camera: Step2CameraCapture,
  imu: Step3ImuCapture,
  multimodal: Step4Multimodal,
  results: Step5RiskResults,
};

function FlowBody() {
  const { status, draft } = useAssessment();
  const { draftId, step } = useParams();
  const navigate = useNavigate();
  const headingRef = useRef(null);

  // Move focus to the step heading on every step change (keyboard/screen readers),
  // once the draft has loaded and the heading exists.
  useEffect(() => {
    if (status === "ready") headingRef.current?.focus();
  }, [step, status]);

  if (status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-slate-500" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading assessment…
      </div>
    );
  }
  if (status === "missing") {
    return (
      <div className="mx-auto max-w-md py-16 text-center" role="alert">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" aria-hidden="true" />
        <p className="mt-3 text-slate-700">This assessment isn't saved on this device.</p>
        <Link to="/app/assess/new" className="mt-4 inline-block font-semibold text-primary underline">Start a new assessment</Link>
      </div>
    );
  }

  // Guard: unknown step, or a step whose predecessors aren't done.
  if (!STEP_IDS.includes(step) || !canOpen(draft, step)) {
    return <Navigate to={stepPath(draftId, firstOpenStep(draft))} replace />;
  }

  const meta = STEPS[stepIndex(step)];
  const Screen = SCREENS[step];
  const go = (id) => navigate(stepPath(draftId, id));
  const i = stepIndex(step);
  const nav = {
    goBack: i > 0 ? () => go(STEP_IDS[i - 1]) : () => navigate("/app/dashboard"),
    goNext: i < STEP_IDS.length - 1 ? () => go(STEP_IDS[i + 1]) : null,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-4" data-testid={`flow-step-${step}`}>
      <Stepper draft={draft} current={step} onGo={go} />
      {step !== "details" && <PatientHeader patient={draft.patient} />}
      {draft.stale?.[step] && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900" role="status">
          Earlier information changed, so this step needs to be redone.
        </p>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Step {i + 1} of {STEPS.length}</p>
        <h1 ref={headingRef} tabIndex={-1} className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 focus:outline-none">
          {meta.title}
        </h1>
      </div>
      <Screen nav={nav} />
    </div>
  );
}

export default function FlowLayout() {
  const { draftId } = useParams();
  return (
    <AssessmentProvider draftId={draftId}>
      <FlowBody />
    </AssessmentProvider>
  );
}
