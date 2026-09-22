// Pose helpers for MediaPipe Tasks Vision (BlazePose 33-landmark model).
// Landmark indices: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT: 31, RIGHT_FOOT: 32,
};

// Angle (degrees) at point b formed by a-b-c.
export function angle(a, b, c) {
  if (!a || !b || !c) return null;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAb = Math.hypot(ab.x, ab.y);
  const magCb = Math.hypot(cb.x, cb.y);
  if (magAb === 0 || magCb === 0) return null;
  let cos = dot / (magAb * magCb);
  cos = Math.max(-1, Math.min(1, cos));
  return +(Math.acos(cos) * (180 / Math.PI)).toFixed(1);
}

export function kneeAngle(lms, side = "LEFT") {
  return angle(lms[LM[`${side}_HIP`]], lms[LM[`${side}_KNEE`]], lms[LM[`${side}_ANKLE`]]);
}

export function hipAngle(lms, side = "LEFT") {
  return angle(lms[LM[`${side}_SHOULDER`]], lms[LM[`${side}_HIP`]], lms[LM[`${side}_KNEE`]]);
}

// Average visible knee/hip angles across both sides.
export function bilateralKnee(lms) {
  const l = kneeAngle(lms, "LEFT");
  const r = kneeAngle(lms, "RIGHT");
  if (l != null && r != null) return { left: l, right: r, avg: +((l + r) / 2).toFixed(1), symmetry: +(100 - Math.min(100, Math.abs(l - r))).toFixed(1) };
  const v = l ?? r;
  return { left: l, right: r, avg: v, symmetry: v != null ? 100 : null };
}

export function bilateralHip(lms) {
  const l = hipAngle(lms, "LEFT");
  const r = hipAngle(lms, "RIGHT");
  const vals = [l, r].filter((x) => x != null);
  return { left: l, right: r, avg: vals.length ? +(vals.reduce((a, b) => a + b) / vals.length).toFixed(1) : null };
}

// Vertical posture alignment: how vertical the shoulder->hip line is (100 = upright).
export function postureAlignment(lms) {
  const sh = midpoint(lms[LM.LEFT_SHOULDER], lms[LM.RIGHT_SHOULDER]);
  const hp = midpoint(lms[LM.LEFT_HIP], lms[LM.RIGHT_HIP]);
  if (!sh || !hp) return null;
  const dx = Math.abs(sh.x - hp.x);
  const dy = Math.abs(sh.y - hp.y) || 0.0001;
  const lean = Math.atan(dx / dy) * (180 / Math.PI);
  return +Math.max(0, 100 - lean * 2.5).toFixed(1);
}

export function midpoint(a, b) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function hipCenterY(lms) {
  const m = midpoint(lms[LM.LEFT_HIP], lms[LM.RIGHT_HIP]);
  return m ? m.y : null;
}

export function clamp(v, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}
