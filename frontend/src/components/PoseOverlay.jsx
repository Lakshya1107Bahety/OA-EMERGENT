import React, { useEffect, useRef } from "react";
import { POSE_LANDMARKS } from "@/services/poseService";

const CONNECTIONS = [
  // Torso
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
  // Left Leg
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
  [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  [POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.LEFT_HEEL],
  [POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.LEFT_FOOT_INDEX],
  // Right Leg
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
  [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
  [POSE_LANDMARKS.RIGHT_ANKLE, POSE_LANDMARKS.RIGHT_HEEL],
  [POSE_LANDMARKS.RIGHT_ANKLE, POSE_LANDMARKS.RIGHT_FOOT_INDEX],
];

export default function PoseOverlay({ landmarks, width = 640, height = 480, showAngles = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length === 0) return;

    // Draw skeleton bones
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "#10b981"; // emerald

    CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];
      if (p1 && p2 && (p1.visibility ?? 1) > 0.3 && (p2.visibility ?? 1) > 0.3) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    });

    // Draw keypoints
    landmarks.forEach((pt, idx) => {
      if (!pt || (pt.visibility ?? 1) <= 0.3) return;
      const x = pt.x * width;
      const y = pt.y * height;

      // Color code joints
      const isKnee = idx === POSE_LANDMARKS.LEFT_KNEE || idx === POSE_LANDMARKS.RIGHT_KNEE;
      const isHip = idx === POSE_LANDMARKS.LEFT_HIP || idx === POSE_LANDMARKS.RIGHT_HIP;
      const isAnkle = idx === POSE_LANDMARKS.LEFT_ANKLE || idx === POSE_LANDMARKS.RIGHT_ANKLE;

      ctx.beginPath();
      ctx.arc(x, y, isKnee ? 6.5 : isHip || isAnkle ? 5.5 : 3.5, 0, 2 * Math.PI);

      if (isKnee) {
        ctx.fillStyle = "#f59e0b"; // amber for knees
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      } else if (isHip) {
        ctx.fillStyle = "#3b82f6"; // blue for hips
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      } else if (isAnkle) {
        ctx.fillStyle = "#06b6d4"; // cyan for ankles
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = "#10b981";
        ctx.fill();
      }
    });

    // Draw angle callouts for knees if available
    if (showAngles) {
      const drawAngleBadge = (kneePt, angleVal, label) => {
        if (!kneePt || angleVal == null) return;
        const kx = kneePt.x * width;
        const ky = kneePt.y * height;

        ctx.font = "bold 11px JetBrains Mono, monospace";
        const text = `${label}: ${angleVal}°`;
        const textWidth = ctx.measureText(text).width;

        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.roundRect(kx + 10, ky - 12, textWidth + 12, 22, 6);
        ctx.fill();

        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, kx + 16, ky + 3);
      };

      const rKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
      const lKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];

      if (rKnee && rKnee.angle != null) drawAngleBadge(rKnee, rKnee.angle, "R");
      if (lKnee && lKnee.angle != null) drawAngleBadge(lKnee, lKnee.angle, "L");
    }
  }, [landmarks, width, height, showAngles]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none w-full h-full object-cover"
      style={{ transform: "scaleX(-1)" }}
    />
  );
}
