import {
  bilateralKnee, bilateralHip, postureAlignment, hipCenterY, midpoint, LM, clamp,
} from "@/lib/pose";

export const MOVEMENT_TESTS = [
  { id: "sit_to_stand", name: "Sit-to-Stand (30s)", duration: 30, mode: "countdown",
    desc: "Stand up and sit down as many times as you can in 30 seconds. Counts repetitions, posture and knee stability." },
  { id: "single_leg_balance", name: "Single-Leg Balance", duration: 30, mode: "countdown",
    desc: "Stand on one leg. Measures how long balance is held and body sway." },
  { id: "tug", name: "Timed Up & Go (TUG)", duration: 0, mode: "stopwatch",
    desc: "Stand, walk 3m, turn, return and sit. Press Stop when seated. Measures total time." },
  { id: "squat", name: "Squat / Knee Flexion", duration: 15, mode: "countdown",
    desc: "Perform slow squats. Calculates knee flexion angle, hip angle, depth and left-right symmetry." },
  { id: "gait", name: "Walking / Gait", duration: 20, mode: "countdown",
    desc: "Walk in place or across the frame. Detects stride, cadence, limp and posture alignment." },
];

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}
function range(arr) { return arr.length ? Math.max(...arr) - Math.min(...arr) : 0; }

export function createAccumulator(testId) {
  const s = {
    reps: 0, phase: "up", minY: Infinity, maxY: -Infinity, symSamples: [],
    xs: [], kneeMin: Infinity, hipAtDepth: null, symAtDepth: 100,
    ankleL: [], ankleR: [], postures: [], frames: 0,
    live: { kneeL: null, kneeR: null, hipAngle: null, posture: null, reps: 0, extra: "" },
  };

  function push(lms) {
    if (!lms) return s.live;
    s.frames += 1;
    const knee = bilateralKnee(lms);
    const hip = bilateralHip(lms);
    const posture = postureAlignment(lms);
    const hy = hipCenterY(lms);
    const hipC = midpoint(lms[LM.LEFT_HIP], lms[LM.RIGHT_HIP]);

    s.live.kneeL = knee.left; s.live.kneeR = knee.right;
    s.live.hipAngle = hip.avg; s.live.posture = posture;
    if (knee.symmetry != null) s.symSamples.push(knee.symmetry);

    if (testId === "sit_to_stand") {
      if (hy != null) {
        s.minY = Math.min(s.minY, hy); s.maxY = Math.max(s.maxY, hy);
        const rng = s.maxY - s.minY;
        if (rng > 0.06) {
          const standThresh = s.minY + 0.4 * rng;
          const sitThresh = s.minY + 0.6 * rng;
          if (s.phase === "down" && hy < standThresh) { s.reps += 1; s.phase = "up"; }
          else if (s.phase === "up" && hy > sitThresh) { s.phase = "down"; }
        }
      }
      s.live.reps = s.reps;
      s.live.extra = `${s.reps} reps`;
    } else if (testId === "single_leg_balance") {
      if (hipC) s.xs.push(hipC.x);
      const sway = +(stdev(s.xs) * 1000).toFixed(1);
      s.live.extra = `Sway ${sway}`;
    } else if (testId === "squat") {
      if (knee.avg != null) {
        s.kneeMin = Math.min(s.kneeMin, knee.avg);
        if (knee.avg <= s.kneeMin + 3) { s.hipAtDepth = hip.avg; s.symAtDepth = knee.symmetry ?? s.symAtDepth; }
        if (s.phase === "up" && knee.avg < 120) s.phase = "down";
        else if (s.phase === "down" && knee.avg > 160) { s.reps += 1; s.phase = "up"; }
      }
      s.live.reps = s.reps;
      s.live.extra = `Min knee ${isFinite(s.kneeMin) ? s.kneeMin.toFixed(0) : "--"}°`;
    } else if (testId === "gait") {
      const al = lms[LM.LEFT_ANKLE], ar = lms[LM.RIGHT_ANKLE];
      if (al) s.ankleL.push(al.x);
      if (ar) s.ankleR.push(ar.x);
      if (posture != null) s.postures.push(posture);
      s.live.extra = `Posture ${posture ?? "--"}`;
    }
    return s.live;
  }

  function finalize(elapsedSec) {
    const avgSym = s.symSamples.length ? +(s.symSamples.reduce((a, b) => a + b, 0) / s.symSamples.length).toFixed(1) : 0;

    if (testId === "sit_to_stand") {
      const repScore = clamp((s.reps / 14) * 100);
      const quality = +clamp(0.7 * repScore + 0.3 * avgSym).toFixed(1);
      return {
        quality_score: quality,
        metrics: { repetitions: s.reps, knee_symmetry: avgSym, completion_time_s: elapsedSec,
          posture_quality: +clamp(avgSym).toFixed(1) },
      };
    }
    if (testId === "single_leg_balance") {
      const sway = +(stdev(s.xs) * 1000).toFixed(1);
      const durScore = clamp((elapsedSec / 30) * 100);
      const swayScore = clamp(100 - sway * 3);
      const quality = +clamp(0.5 * durScore + 0.5 * swayScore).toFixed(1);
      return { quality_score: quality, metrics: { balance_duration_s: elapsedSec, body_sway_index: sway } };
    }
    if (testId === "tug") {
      const quality = +clamp(100 - Math.max(0, elapsedSec - 8) * 6).toFixed(1);
      return { quality_score: quality, metrics: { total_time_s: elapsedSec } };
    }
    if (testId === "squat") {
      const minKnee = isFinite(s.kneeMin) ? +s.kneeMin.toFixed(1) : 180;
      const depth = +clamp(((160 - minKnee) / (160 - 70)) * 100).toFixed(1);
      const symmetry = +clamp(s.symAtDepth).toFixed(1);
      const quality = +clamp(0.6 * depth + 0.4 * symmetry).toFixed(1);
      return {
        quality_score: quality,
        metrics: { knee_flexion_angle: minKnee, hip_angle: s.hipAtDepth, squat_depth_percent: depth,
          lr_symmetry: symmetry, repetitions: s.reps },
      };
    }
    if (testId === "gait") {
      const strideL = +range(s.ankleL).toFixed(3);
      const strideR = +range(s.ankleR).toFixed(3);
      const maxStride = Math.max(strideL, strideR, 0.0001);
      const strideSym = +clamp(100 - (Math.abs(strideL - strideR) / maxStride) * 100).toFixed(1);
      // cadence via sign changes of L-R ankle x difference
      let crossings = 0;
      const n = Math.min(s.ankleL.length, s.ankleR.length);
      for (let i = 1; i < n; i++) {
        const prev = s.ankleL[i - 1] - s.ankleR[i - 1];
        const cur = s.ankleL[i] - s.ankleR[i];
        if (prev < 0 !== cur < 0) crossings += 1;
      }
      const steps = crossings;
      const cadence = elapsedSec > 0 ? +((steps / elapsedSec) * 60).toFixed(0) : 0;
      const posture = s.postures.length ? +(s.postures.reduce((a, b) => a + b, 0) / s.postures.length).toFixed(1) : 0;
      const limp = strideSym < 70;
      const cadenceScore = clamp((cadence / 100) * 100);
      const quality = +clamp(0.4 * strideSym + 0.3 * posture + 0.3 * cadenceScore).toFixed(1);
      return {
        quality_score: quality,
        metrics: { stride_symmetry: strideSym, cadence_steps_per_min: cadence, walking_speed_index: cadenceScore,
          posture_alignment: posture, limp_detected: limp },
      };
    }
    return { quality_score: 0, metrics: {} };
  }

  return { push, finalize };
}
