import jsPDF from "jspdf";
import QRCode from "qrcode";

export async function generateReport(patient, screening) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const r = screening.result || {};
  const W = doc.internal.pageSize.getWidth();
  const green = [16, 185, 129];

  // header
  doc.setFillColor(...green);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("JointCare AI", 40, 44);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Osteoarthritis Screening Report", W - 40, 44, { align: "right" });

  let y = 100;
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Patient Details", 40, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const details = [
    `Name: ${patient.name}`,
    `Age / Gender: ${patient.age} / ${patient.gender}`,
    `BMI: ${patient.bmi ?? "-"}`,
    `Village / District: ${patient.village ?? "-"} / ${patient.district ?? "-"}`,
    `Phone: ${patient.phone ?? "-"}`,
    `Date: ${new Date(screening.created_at).toLocaleString()}`,
  ];
  details.forEach((d) => { doc.text(d, 40, y); y += 18; });

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Screening Result", 40, y);
  y += 22;

  doc.setFillColor(236, 253, 245);
  doc.roundedRect(40, y - 14, W - 80, 90, 8, 8, "F");
  doc.setFontSize(28);
  doc.setTextColor(...green);
  doc.text(`${r.oa_probability}%`, 60, y + 24);
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text("OA Probability", 60, y + 44);

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Risk Level: ${r.risk_level}`, 220, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Confidence: ${r.confidence}%`, 220, y + 30);
  doc.text(`Knee Stability: ${r.knee_stability_score}/100`, 220, y + 48);
  doc.text(`Movement Symmetry: ${r.movement_symmetry}%   Balance: ${r.balance_score}/100`, 220, y + 66);

  y += 110;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Recommendation", 40, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(r.recommendation || "-", W - 80), 40, y);
  y += 34;
  doc.setFont("helvetica", "bold");
  doc.text("Follow-up", 40, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(r.follow_up || "-", W - 80), 40, y);

  if (screening.doctor_notes) {
    y += 34;
    doc.setFont("helvetica", "bold");
    doc.text("Doctor Notes", 40, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(screening.doctor_notes, W - 80), 40, y);
  }

  if (screening.movement_summary) {
    const m = screening.movement_summary;
    y += 34;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Functional Movement Assessment", 40, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Overall movement score: ${m.overall_score}/100  (${m.movement_risk_level} risk)`, 40, y);
    y += 16;
    doc.text(`Tests completed: ${m.test_count}  ·  Assessed: ${new Date(m.assessed_at).toLocaleString()}`, 40, y);
  }

  // QR code
  const qrPayload = JSON.stringify({
    id: screening.id, patient: patient.name, age: patient.age,
    oa: r.oa_probability, risk: r.risk_level, date: screening.created_at,
  });
  const qrData = await QRCode.toDataURL(qrPayload, { margin: 1, width: 120 });
  doc.addImage(qrData, "PNG", W - 140, 100, 100, 100);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Scan to verify", W - 122, 214);

  // footer disclaimer
  const H = doc.internal.pageSize.getHeight();
  doc.setFillColor(254, 243, 199);
  doc.rect(0, H - 40, W, 40, "F");
  doc.setTextColor(146, 64, 14);
  doc.setFontSize(10);
  doc.text("AI-assisted screening, not a medical diagnosis.", W / 2, H - 16, { align: "center" });

  doc.save(`JointCare_${patient.name.replace(/\s/g, "_")}.pdf`);
}
