// PDF report for the OA Risk Results screen.
import jsPDF from "jspdf";
import { ACTIONS } from "./buildResults";

const BAND_RGB = { Low: [5, 150, 105], Moderate: [217, 119, 6], High: [220, 38, 38], "Not determined": [100, 116, 139] };

export function buildReportPdf(draft, user) {
  const { patient: p, multimodal: mm, report: r } = draft;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = 0;

  const ensure = (need) => { if (y + need > H - 60) { doc.addPage(); y = 50; } };
  const heading = (t) => { ensure(40); y += 14; doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.text(t, M, y); y += 14; };
  const para = (t, size = 10, color = [51, 65, 85]) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(t, W - 2 * M)) { ensure(14); doc.text(line, M, y); y += size + 4; }
  };
  const row = (k, v) => { ensure(14); doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100, 116, 139); doc.text(k, M, y); doc.setTextColor(15, 23, 42); doc.text(String(v), M + 170, y); y += 14; };

  // Header
  doc.setFillColor(4, 120, 87); doc.rect(0, 0, W, 64, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("OA Screening Report", M, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(new Date().toLocaleString(), W - M, 40, { align: "right" });
  y = 90;

  heading("Patient");
  row("Name", p.fullName);
  row("Age / sex", `${p.age} / ${p.sex}`);
  row("Village / block", `${p.village}${p.block ? `, ${p.block}` : ""}`);
  row("Height / weight / BMI", `${p.heightCm} cm / ${p.weightKg} kg / ${p.bmi}`);
  row("Affected side / pain", `${p.affectedSide} / ${p.painScore}/10`);
  row("Symptom duration", `${p.symptomDurationMonths} months`);

  // Band box
  heading("Result");
  const rgb = BAND_RGB[r.band] || BAND_RGB["Not determined"];
  ensure(70);
  doc.setFillColor(...rgb); doc.roundedRect(M, y, W - 2 * M, 56, 6, 6, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text(`${r.band}${mm?.bandSource === "imu" ? " (IMU, uncalibrated)" : ""}`, M + 14, y + 34);
  doc.setFontSize(12);
  doc.text(`Score: ${r.riskScore != null ? r.riskScore.toFixed(1) : "—"}`, W - M - 14, y + 34, { align: "right" });
  y += 70;
  row("Gait deviation", mm?.gaitDeviation != null ? `${mm.gaitDeviation.toFixed(1)} (${mm.gaitCalibrated ? "calibrated" : "not calibrated"})` : "not available");
  para("Gait deviation = share of reference walking trials (3,003 trials, 49 participants) that look more typical than this patient's gait. It is a descriptive measure, NOT an OA probability or diagnosis. Final diagnosis rests with the clinician.", 9, [180, 83, 9]);

  if (mm?.modalities) {
    heading("Per-modality findings");
    for (const m of mm.modalities) {
      const status = m.modality === "clinical" ? "listed, not scored" : m.calibrated ? "calibrated" : "uncalibrated";
      const demoTag = mm.demo?.[m.modality] ? ", DEMO/simulated" : "";
      para(`${m.modality.toUpperCase()} (${status}${demoTag}): ${m.headline}`, 10, [15, 23, 42]);
      for (const f of m.factors.slice(0, 5)) para(`   • ${f.label}: ${f.value}${f.zScore != null ? `, z ${f.zScore}` : ""}`, 9);
    }
  }

  heading("Top contributing factors");
  if (!r.topDrivers.length) para("None identified.");
  r.topDrivers.forEach((d, i) => para(`${i + 1}. ${d.label} (${d.modality}${d.modality !== "clinical" && !d.calibrated ? ", uncalibrated" : ""}): ${d.detail}`, 9));

  heading("Recommended next action");
  para(ACTIONS[r.recommendedAction] + (r.recommendedAction !== r.suggestedAction ? ` (changed by clinician; suggested: ${ACTIONS[r.suggestedAction]})` : ""), 11, [15, 23, 42]);
  para(r.actionRationale, 9);

  heading("Clinician notes");
  para(r.clinicianNotes || "—");

  heading("Sign-off");
  para(r.signOff ? `Signed by ${r.signOff.by} on ${new Date(r.signOff.at).toLocaleString()}` : "Not signed.");
  if (mm?.dataQuality?.flags?.length) {
    heading("Data-quality notes");
    mm.dataQuality.flags.forEach((f) => para(`• ${f}`, 9));
  }

  // Footer + see-through watermark naming exactly what is demo/simulated
  const mark = mm?.demo?.vision ? "DEMO DATA" : mm?.demo?.imu ? "SIMULATED IMU" : null;
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(`AI-assisted screening aid, not a diagnosis. Screening ID: ${r.screeningId || "not saved"} · Page ${i}/${pages}`, M, H - 24);
    if (mark) {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.12 }));
      doc.setFontSize(56); doc.setTextColor(109, 40, 217);
      doc.text(mark, W / 2, H / 2, { align: "center", angle: 30 });
      doc.restoreGraphicsState();
    }
  }
  return doc;
}

export function downloadReportPdf(draft, user) {
  const doc = buildReportPdf(draft, user);
  const safe = draft.patient.fullName.replace(/[^a-z0-9]+/gi, "_").slice(0, 30);
  doc.save(`OA_screening_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function printReportPdf(draft, user) {
  const doc = buildReportPdf(draft, user);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank", "noopener");
}
