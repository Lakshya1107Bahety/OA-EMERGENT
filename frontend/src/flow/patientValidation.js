// Validation rules for the Patient Details step (kept separate so they can be unit-tested).

const num = (v) => (v === "" || v == null ? NaN : Number(v));

export function computeBmi(heightCm, weightKg) {
  const h = num(heightCm) / 100, w = num(weightKg);
  return h > 0 && w > 0 ? +(w / (h * h)).toFixed(1) : null;
}

/** Returns { field: message } for every invalid field. */
export function validate(f) {
  const e = {};
  if (f.fullName.trim().length < 2) e.fullName = "Enter the patient's full name.";
  const age = num(f.age);
  if (!Number.isInteger(age) || age < 18 || age > 110) e.age = "Age must be a whole number from 18 to 110.";
  if (!f.sex) e.sex = "Select sex.";
  if (f.village.trim().length < 2) e.village = "Enter the village.";
  if (f.phone && !/^[6-9]\d{9}$/.test(f.phone.replace(/\D/g, "").slice(-10)))
    e.phone = "Enter a 10-digit mobile number, or leave it empty.";
  const h = num(f.heightCm);
  if (!(h >= 100 && h <= 220)) e.heightCm = "Height must be 100–220 cm.";
  const w = num(f.weightKg);
  if (!(w >= 25 && w <= 250)) e.weightKg = "Weight must be 25–250 kg.";
  if (!f.familyHistoryOA) e.familyHistoryOA = "Answer yes or no.";
  const dur = num(f.symptomDurationMonths);
  if (!(dur >= 0 && dur <= 600)) e.symptomDurationMonths = "Enter months (0 if no symptoms).";
  if (!f.affectedSide) e.affectedSide = "Select the affected side.";
  const pain = num(f.painScore);
  if (!Number.isInteger(pain) || pain < 0 || pain > 10) e.painScore = "Choose a pain score from 0 to 10.";
  return e;
}
