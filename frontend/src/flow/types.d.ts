// State schema for the Screening Flow (Details -> Camera -> IMU -> Multimodal -> Results).
// Type-only: used from JavaScript via JSDoc, e.g. /** @type {import("./types").Patient} */.
// The build ignores this file, so it cannot affect Vercel.

export type StepId = "details" | "camera" | "imu" | "multimodal" | "results";
export type Sex = "female" | "male" | "other";
export type Side = "left" | "right" | "bilateral";
export type RiskBand = "Low" | "Moderate" | "High" | "Not determined";
export type SyncState = "local" | "queued" | "synced" | "error";
export type NextAction = "re-screen" | "physiotherapy" | "radiograph" | "refer-orthopaedics";

export interface Patient {
  localId: string;               // created in step 1, referenced everywhere downstream
  serverId?: string;             // backend id once saved
  fullName: string;
  age: number;                   // 18-110
  sex: Sex;
  village: string;
  block?: string;
  phone?: string;                // 10 digits
  heightCm: number;
  weightKg: number;
  bmi: number;                   // computed, read-only
  occupation?: string;
  familyHistoryOA: boolean;
  comorbidities: { diabetes: boolean; hypertension: boolean };
  symptomDurationMonths: number;
  affectedSide: Side;
  painScore: number;             // 0-10 VAS
  priorInjuryOrSurgery?: string;
  createdAt: string;
  sync: SyncState;
}

/** The 10 gait measurements the calibrated model uses; null = not measured. */
export interface PoseFeatures {
  right_knee_rom_deg: number | null;
  left_knee_rom_deg: number | null;
  right_hip_rom_deg: number | null;
  left_hip_rom_deg: number | null;
  step_duration_sec: number | null;
  stride_duration_sec: number | null;
  cadence_steps_min: number | null;
  knee_rom_asymmetry_pct: number | null;
  step_time_asymmetry_pct: number | null;
  trunk_lean_deg: number | null;
}

export interface CameraTrial {
  index: number;                 // 1..N, paired with ImuTrial.index
  startedAt: string;
  durationSec: number;
  framesCaptured: number;
  features: PoseFeatures;
  missingFeatures: number;
  thumbnail?: string;            // small JPEG data URL; no video is stored
  accepted: boolean;             // false = no walking detected, not usable
  isDemo: boolean;
}

/** One IMU sample in m/s^2 and deg/s. t = ms (device clock when available). */
export interface ImuSample { t: number; ax: number; ay: number; az: number; gx: number; gy: number; gz: number }

export interface ImuTrial {
  index: number;                 // n-th usable IMU trial ("paired, not time-synced")
  pairedCameraIndex: number | null; // CameraTrial.index it pairs with
  accepted: boolean;             // false = too short or no walking; not sent for analysis
  startedAt: string;
  durationSec: number;
  samples: ImuSample[];
  quality: {
    sampleRateHz: number;
    droppedPct: number | null;   // null when the device sends no clock
    unitsDetected: "g" | "m/s^2" | null;
    pairing: "paired" | "unpaired";
  };
  summary: {
    cadenceSpm: number | null;       // steps per minute
    strideTimeCvPct: number | null;  // stride-time variability
    stepSymmetryPct: number | null;  // approximate with one sensor
    moving: boolean;
  };
}

export interface ImuRecording {
  device: { name: string; source: "ble" | "simulator"; connectedAt: string };
  trials: ImuTrial[];
}

export interface ModalityResult {
  modality: "clinical" | "vision" | "imu";
  calibrated: boolean;
  headline: string;
  value: number | null;
  factors: { label: string; value: string; zScore?: number }[];
}

export interface MultimodalResult {
  engineVersion: string;
  status: "idle" | "processing" | "done" | "error" | "offline";
  error?: string;
  gaitDeviation: number | null;  // share of reference walking trials that look more typical. NOT an OA probability.
  gaitCalibrated: boolean;       // only these count toward "Screenings with a calibrated gait score"
  band: RiskBand;
  bandSource: "vision" | "imu" | null;
  modalities: ModalityResult[];
  dataQuality: { usableCameraTrials: number; usableImuTrials: number; missingMeasurements: number; flags: string[] };
  raw?: unknown;                 // backend result, kept for the report
  analyzedAt?: string;
  isDemo: boolean;               // any modality contains demo/simulated data
  demo: { vision: boolean; imu: boolean; clinical: boolean };
}

export interface OARiskReport {
  band: RiskBand;
  riskScore: number | null;      // = gait deviation (or uncalibrated IMU index when no camera)
  topDrivers: { label: string; detail: string; modality: ModalityResult["modality"]; calibrated: boolean }[];
  recommendedAction: NextAction;
  actionRationale: string;
  clinicianNotes: string;
  signOff?: { by: string; userId: string; at: string };
  screeningId?: string;          // after Save
  sync: SyncState;
}

export interface AssessmentDraft {
  draftId: string;
  createdAt: string;
  updatedAt: string;
  completed: Record<StepId, boolean>;
  stale: Partial<Record<StepId, boolean>>;
  trialsRequired: number;        // default 5
  patient?: Patient;
  cameraTrials: CameraTrial[];
  imu?: ImuRecording;
  multimodal?: MultimodalResult;
  report?: OARiskReport;
}
