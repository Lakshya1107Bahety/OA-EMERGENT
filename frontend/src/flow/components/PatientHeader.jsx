import React from "react";
import { UserRound, CloudOff, CloudCheck } from "lucide-react";

/** Patient context shown at the top of every step after Details. */
export default function PatientHeader({ patient }) {
  if (!patient) return null;
  const synced = !!patient.serverId;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-emerald-900/10 bg-white px-4 py-2.5 text-sm shadow-sm"
      data-testid="flow-patient-header">
      <span className="flex items-center gap-2 font-semibold text-slate-900">
        <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
        {patient.fullName}
      </span>
      <span className="text-slate-600">{patient.age} y · {patient.sex}</span>
      <span className="text-slate-600">{patient.village}{patient.block ? `, ${patient.block}` : ""}</span>
      <span className="text-slate-600">Affected: {patient.affectedSide}</span>
      <span className={`ml-auto flex items-center gap-1 text-xs ${synced ? "text-emerald-700" : "text-amber-700"}`}>
        {synced ? <CloudCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />}
        {synced ? "Saved to server" : "Saved on this device"}
      </span>
    </div>
  );
}
