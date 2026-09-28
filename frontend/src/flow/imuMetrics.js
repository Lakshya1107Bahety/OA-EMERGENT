// Descriptive gait metrics from one knee-worn IMU trial. Not calibrated
// against reference data; shown to the clinician as context.
//   cadence            steps/min, from the stride period (autocorrelation of gyro magnitude)
//   stride-time CV     variability of stride times between detected strides
//   step symmetry      step vs stride regularity of acceleration (Moe-Nilssen);
//                      approximate with a single sensor on one leg

const MIN_MOVING_DPS = 15; // mean angular velocity below this = not walking

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

function smooth(a, w = 5) {
  const out = new Array(a.length);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i];
    if (i >= w) sum -= a[i - w];
    out[i] = sum / Math.min(i + 1, w);
  }
  return out;
}

/** Normalised autocorrelation at integer lag. */
function acAt(x, lag) {
  let s = 0;
  for (let i = 0; i + lag < x.length; i++) s += x[i] * x[i + lag];
  return s / (x.length - lag);
}

/**
 * Fundamental period of a repeating signal. Uses the biased autocorrelation
 * (long lags with little overlapping data are down-weighted) and takes the
 * FIRST local peak that reaches 80% of the highest one, so a multiple of the
 * true period is never chosen over the period itself.
 */
function periodLag(x, lo, hi) {
  const n = x.length;
  hi = Math.min(hi, Math.floor(n / 2));
  let e = 0;
  for (const v of x) e += v * v;
  if (!(e > 0) || hi <= lo) return null;
  const r = [];
  for (let lag = lo - 1; lag <= hi + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += x[i] * x[i + lag];
    r.push(s / e);
  }
  const at = (lag) => r[lag - lo + 1];
  let max = -Infinity;
  for (let lag = lo; lag <= hi; lag++) max = Math.max(max, at(lag));
  for (let lag = lo; lag <= hi; lag++) {
    if (at(lag) >= at(lag - 1) && at(lag) >= at(lag + 1) && at(lag) >= 0.8 * max) return { lag, value: at(lag) };
  }
  return null;
}

function bestLag(x, lo, hi) {
  const a0 = acAt(x, 0);
  if (!(a0 > 0)) return null;
  let best = null;
  for (let lag = lo; lag <= hi && lag < x.length - 10; lag++) {
    const v = acAt(x, lag) / a0;
    if (!best || v > best.value) best = { lag, value: v };
  }
  return best;
}

/**
 * @param {import("./types").ImuSample[]} samples  t in ms from trial start
 * @returns {import("./types").ImuTrial["summary"] & {sampleRateHz: number}}
 */
export function imuTrialMetrics(samples) {
  const empty = { cadenceSpm: null, strideTimeCvPct: null, stepSymmetryPct: null, moving: false, sampleRateHz: 0 };
  if (!samples || samples.length < 50) return empty;

  const dts = [];
  for (let i = 1; i < samples.length; i++) {
    const d = samples[i].t - samples[i - 1].t;
    if (d > 0) dts.push(d);
  }
  dts.sort((a, b) => a - b);
  const dtMs = dts.length ? dts[Math.floor(dts.length / 2)] : 20;
  const fs = 1000 / dtMs;

  const gyro = samples.map((s) => Math.hypot(s.gx, s.gy, s.gz));
  const acc = samples.map((s) => Math.hypot(s.ax, s.ay, s.az));
  const moving = mean(gyro) >= MIN_MOVING_DPS;
  const base = { ...empty, moving, sampleRateHz: +fs.toFixed(1) };
  if (!moving) return base;

  // Stride period: strongest repetition of gyro magnitude between 0.7 and 2.0 s.
  const g = smooth(gyro);
  const gm = mean(g);
  const gc = g.map((v) => v - gm);
  const stride = periodLag(gc, Math.round(0.7 * fs), Math.round(2.0 * fs));
  if (!stride || stride.value < 0.2) return base; // no clear rhythm
  const strideSec = stride.lag / fs;
  const cadenceSpm = +((2 * 60) / strideSec).toFixed(1);

  // Stride-time variability: gyro peaks at least 60% of a stride apart.
  const thr = gm + 0.5 * sd(g);
  const minGap = Math.round(0.6 * stride.lag);
  const peaks = [];
  for (let i = 1; i < g.length - 1; i++) {
    if (g[i] > thr && g[i] >= g[i - 1] && g[i] > g[i + 1] && (!peaks.length || i - peaks.at(-1) >= minGap)) peaks.push(i);
  }
  const intervals = peaks.slice(1).map((p, i) => (p - peaks[i]) / fs);
  const strideTimeCvPct = intervals.length >= 3 ? +((sd(intervals) / mean(intervals)) * 100).toFixed(1) : null;

  // Step symmetry: acceleration regularity at one step vs one stride.
  const am = mean(acc);
  const ac = smooth(acc, 3).map((v) => v - am);
  const a0 = acAt(ac, 0);
  let stepSymmetryPct = null;
  if (a0 > 0) {
    const s1 = bestLag(ac, Math.round(0.3 * stride.lag), Math.round(0.7 * stride.lag));
    const s2 = acAt(ac, stride.lag) / a0;
    // Only meaningful when strides clearly repeat; otherwise the ratio is noise.
    if (s1 && s1.value > 0 && s2 >= 0.5) stepSymmetryPct = +(Math.min(s1.value, s2) / Math.max(s1.value, s2) * 100).toFixed(1);
  }

  return { ...base, cadenceSpm, strideTimeCvPct, stepSymmetryPct };
}
