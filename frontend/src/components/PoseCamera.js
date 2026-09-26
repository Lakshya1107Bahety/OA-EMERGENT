import React, { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { Loader2, CameraOff, Camera } from "lucide-react";

export default function PoseCamera({ onLandmarks, active = true }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const cbRef = useRef(onLandmarks);
  const lastVideoTime = useRef(-1);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => { cbRef.current = onLandmarks; }, [onLandmarks]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        let landmarker;
        try {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_lite.task", delegate: "GPU" },
            runningMode: "VIDEO", numPoses: 1,
          });
        } catch (e) {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_lite.task", delegate: "CPU" },
            runningMode: "VIDEO", numPoses: 1,
          });
        }
        if (cancelled) return;
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setStatus("ready");
        loop();
      } catch (e) {
        if (!cancelled) { setStatus("error"); setErrMsg(e?.message || "Camera/model unavailable"); }
      }
    }

    function loop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !canvas || !landmarker) { rafRef.current = requestAnimationFrame(loop); return; }
      if (video.videoWidth && canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      if (video.currentTime !== lastVideoTime.current && video.readyState >= 2) {
        lastVideoTime.current = video.currentTime;
        const res = landmarker.detectForVideo(video, performance.now());
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (res.landmarks && res.landmarks.length) {
          const lms = res.landmarks[0];
          const du = new DrawingUtils(ctx);
          du.drawConnectors(lms, PoseLandmarker.POSE_CONNECTIONS, { color: "#10B981", lineWidth: 4 });
          du.drawLandmarks(lms, { color: "#047857", fillColor: "#ECFDF5", radius: 4, lineWidth: 2 });
          if (cbRef.current) cbRef.current(lms);
        } else if (cbRef.current) {
          cbRef.current(null);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    init();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const v = videoRef.current;
      if (v?.srcObject) v.srcObject.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close?.();
    };
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900 aspect-video" data-testid="pose-camera">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
        playsInline muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Loading AI pose model…</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2 p-4 text-center">
          <CameraOff className="w-8 h-8" />
          <p className="text-sm">Camera unavailable</p>
          <p className="text-xs text-slate-300">{errMsg}</p>
        </div>
      )}
      {status === "ready" && (
        <span className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600/80 px-3 py-1.5 rounded-full">
          <Camera className="w-3.5 h-3.5" /> Live · Skeleton tracking
        </span>
      )}
    </div>
  );
}
