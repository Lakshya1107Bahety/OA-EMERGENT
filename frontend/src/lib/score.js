// How a screening result's score is shown across the app.
// Engine 2.0 results carry `deviation_score` (gait deviation percentile vs the
// reference walking cohort) or no score at all when no camera gait trials were
// recorded. Results saved by the old engine only have `oa_probability`, which
// was an uncalibrated score; it is shown but marked as legacy.
export function scoreOf(result) {
  const r = result || {};
  if (typeof r.deviation_score === "number") {
    return { value: r.deviation_score, text: r.deviation_score.toFixed(1), label: "Gait deviation", legacy: false };
  }
  if (!r.engine_version && typeof r.oa_probability === "number") {
    return { value: r.oa_probability, text: String(r.oa_probability), label: "Legacy score (uncalibrated)", legacy: true };
  }
  return { value: null, text: "—", label: "No calibrated score", legacy: false };
}
