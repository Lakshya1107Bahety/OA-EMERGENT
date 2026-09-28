import React, { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import PoseOverlay from "./PoseOverlay";
import { PoseFeatureAccumulator, POSE_LANDMARKS } from "@/services/poseService";
import { FUNCTIONAL_TESTS } from "@/models/featureSchema";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Play, Square, Activity, Timer, RefreshCw, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

// Small JPEG of the current video frame, stored with each trial (no video is kept).
function captureThumbnail(video) {
  try {
    if (!video || !video.videoWidth) return undefined;
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = Math.round((160 * video.videoHeight) / video.videoWidth);
    c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.6);
  } catch {
    return undefined;
  }
}

export default function CameraPanel({
  onTrialComplete, onFrameSnapshot, activeTestId = "walk_5m", onSelectTest,
  hideTestSelector = false, overlayGuide = null,
}) {
  const videoRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const accumulatorRef = useRef(null);
  const timerIntervalRef = useRef(null);
  // Ref mirror of isRecording so the RAF detection loop always reads the latest value
  const isRecordingRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [landmarks, setLandmarks] = useState(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [liveMetrics, setLiveMetrics] = useState({
    rightKnee: null,
    leftKnee: null,
    rightHip: null,
    leftHip: null,
    trunkLean: null,
    symmetry: null,
  });

  const selectedTest = FUNCTIONAL_TESTS.find((t) => t.id === activeTestId) || FUNCTIONAL_TESTS[0];

  // Initialize MediaPipe PoseLandmarker
  const initMediaPipe = useCallback(async () => {
    setLoadingModel(true);
    try {
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      let landmarker;
      try {
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      } catch {
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      }
      landmarkerRef.current = landmarker;
      setModelReady(true);
      return true;
    } catch (err) {
      console.error("MediaPipe initialization error:", err);
      toast.error("Could not load pose estimation model.");
      return false;
    } finally {
      setLoadingModel(false);
    }
  }, []);

  // Start webcam
  const startCamera = async () => {
    if (!modelReady && !landmarkerRef.current) {
      const ok = await initMediaPipe();
      if (!ok) return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        startDetectionLoop();
        toast.success("Webcam stream initialized.");
      }
    } catch (err) {
      console.error("Webcam error:", err);
      toast.error(err.name === "NotAllowedError" ? "Camera access denied. Please grant webcam permissions." : "Webcam not available.");
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (isRecording) stopRecording();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setLandmarks(null);
  };

  // Detection Loop
  const startDetectionLoop = () => {
    let lastTime = -1;

    const detect = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (video && landmarker && video.readyState >= 2) {
        if (video.currentTime !== lastTime) {
          lastTime = video.currentTime;
          const nowMs = performance.now();
          const results = landmarker.detectForVideo(video, nowMs);

          if (results.landmarks && results.landmarks.length > 0) {
            const lms = results.landmarks[0];
            const worldLms = results.worldLandmarks && results.worldLandmarks.length > 0 ? results.worldLandmarks[0] : null;
            setLandmarks(lms);

            // If recording, feed into accumulator (use ref — not state — to avoid stale closure)
            if (accumulatorRef.current && isRecordingRef.current) {
              const snap = accumulatorRef.current.pushFrame(lms, nowMs, worldLms);
              if (snap) {
                setLiveMetrics({
                  rightKnee: snap.right_knee_angle,
                  leftKnee: snap.left_knee_angle,
                  rightHip: snap.right_hip_angle,
                  leftHip: snap.left_hip_angle,
                  trunkLean: snap.trunk_lean_deg,
                  symmetry: snap.symmetry_pct,
                });

                if (onFrameSnapshot) {
                  onFrameSnapshot(snap);
                }
              }
            }
          } else {
            setLandmarks(null);
          }
        }
      }
      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
  };

  // Start trial recording
  const startRecording = () => {
    if (!cameraActive) {
      toast.error("Enable webcam first.");
      return;
    }

    accumulatorRef.current = new PoseFeatureAccumulator(selectedTest.id);
    isRecordingRef.current = true;
    setIsRecording(true);
    setRecordingSeconds(0);

    const startTime = Date.now();
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 500);

    toast.info(`Recording ${selectedTest.name}...`);
  };

  // Stop trial recording
  const stopRecording = () => {
    if (!isRecording) return;
    clearInterval(timerIntervalRef.current);
    isRecordingRef.current = false;
    setIsRecording(false);

    if (accumulatorRef.current) {
      const summary = accumulatorRef.current.finalize(recordingSeconds);
      summary.thumbnail = captureThumbnail(videoRef.current);
      toast.success(`Completed ${selectedTest.name}: ${summary.frames_captured} frames processed.`);
      if (onTrialComplete) {
        onTrialComplete(summary);
      }
    }
  };

  useEffect(() => {
    // The <video> element is always rendered, so capture it now; by cleanup
    // time videoRef.current may already be null and the camera would stay on.
    const video = videoRef.current;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearInterval(timerIntervalRef.current);
      if (video?.srcObject) {
        const stream = video.srcObject;
        stream.getTracks().forEach((track) => track.stop());
      }
      landmarkerRef.current?.close?.();
    };
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
      {/* Test Selector and Mode Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-600" />
          <h3 className="font-heading font-bold text-slate-900 dark:text-white text-base">
            Live Functional Motion Tracking
          </h3>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200">
            MediaPipe Pose Engine
          </span>
        </div>

        <div className={`flex items-center gap-2 ${hideTestSelector ? "hidden" : ""}`}>
          {FUNCTIONAL_TESTS.map((test) => (
            <button
              key={test.id}
              onClick={() => onSelectTest ? onSelectTest(test.id) : null}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedTest.id === test.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              {test.name.split(" ")[0]} ({test.id === "walk_5m" ? "5m Walk" : test.id === "sit_to_stand_5x" ? "5xSTS" : "Flexion"})
            </button>
          ))}
        </div>
      </div>

      {/* Video Viewport Container */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 shadow-inner flex items-center justify-center">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
          playsInline
          muted
        />

        {showSkeleton && landmarks && (
          <PoseOverlay landmarks={landmarks} width={640} height={480} showAngles={true} />
        )}

        {cameraActive && overlayGuide}

        {/* Prototype Inference Mode Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700 text-white text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Prototype Inference Mode
        </div>

        {/* Test Guidance Prompt */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button
            onClick={() => setShowSkeleton(!showSkeleton)}
            className="p-1.5 rounded-lg bg-slate-900/80 text-white hover:bg-slate-800 text-xs flex items-center gap-1 border border-slate-700"
            title="Toggle Skeleton Overlay"
          >
            {showSkeleton ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
            <span className="text-[11px]">Skeleton</span>
          </button>
        </div>

        {/* Off State Placeholder */}
        {!cameraActive && (
          <div className="text-center p-6 space-y-3 z-10">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center border border-slate-700">
              <Camera className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Camera Feed Inactive</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Enable webcam to capture functional motion, joint flexion angles, and gait asymmetry.
              </p>
            </div>
            <Button
              onClick={startCamera}
              disabled={loadingModel}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 mt-2"
            >
              {loadingModel ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading MediaPipe...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Enable Webcam
                </>
              )}
            </Button>
          </div>
        )}

        {/* Recording Active HUD */}
        {isRecording && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-950/80 backdrop-blur-md border border-rose-600 text-rose-200 text-xs font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            RECORDING TRIAL: {recordingSeconds}s
          </div>
        )}
      </div>

      {/* Control Buttons & Real-Time Angles */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {cameraActive ? (
            <>
              {isRecording ? (
                <Button onClick={stopRecording} variant="destructive" size="sm" className="gap-2 font-semibold">
                  <Square className="w-4 h-4" />
                  Stop Recording ({recordingSeconds}s)
                </Button>
              ) : (
                <Button onClick={startRecording} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-sm">
                  <Play className="w-4 h-4" />
                  Start {selectedTest.name.split(" ")[0]} Test
                </Button>
              )}

              <Button onClick={stopCamera} variant="outline" size="sm" className="gap-1.5 text-slate-600">
                <CameraOff className="w-4 h-4" />
                Disable Camera
              </Button>
            </>
          ) : (
            <p className="text-xs text-slate-500">Camera off. Use <strong>Enable Webcam</strong> above to start.</p>
          )}
        </div>

        {/* Real-time Angle Badges */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs" aria-live="off">
          <div className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
            <span className="text-[10px] text-amber-600 block font-sans">R Knee</span>
            {liveMetrics.rightKnee != null ? `${liveMetrics.rightKnee}°` : "—"}
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
            <span className="text-[10px] text-amber-600 block font-sans">L Knee</span>
            {liveMetrics.leftKnee != null ? `${liveMetrics.leftKnee}°` : "—"}
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-violet-900 dark:text-violet-200">
            <span className="text-[10px] text-violet-600 block font-sans">R Hip</span>
            {liveMetrics.rightHip != null ? `${liveMetrics.rightHip}°` : "—"}
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-violet-900 dark:text-violet-200">
            <span className="text-[10px] text-violet-600 block font-sans">L Hip</span>
            {liveMetrics.leftHip != null ? `${liveMetrics.leftHip}°` : "—"}
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200">
            <span className="text-[10px] text-blue-600 block font-sans">Trunk Lean</span>
            {liveMetrics.trunkLean != null ? `${liveMetrics.trunkLean}°` : "—"}
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
            <span className="text-[10px] text-emerald-600 block font-sans">Symmetry</span>
            {liveMetrics.symmetry != null ? `${liveMetrics.symmetry}%` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
