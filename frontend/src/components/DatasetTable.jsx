import React, { useState } from "react";
import { DATASET_MOVEMENT_LABELS } from "@/models/featureSchema";
import { exportDatasettoCSV } from "@/services/csvService";
import { Button } from "@/components/ui/button";
import { Play, Square, Download, Database, Tag, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";

export default function DatasetTable({ records = [], onStartRecord, onStopRecord, isRecording, activeLabel, onSelectLabel, onClear }) {
  const [filterLabel, setFilterLabel] = useState("all");

  const filteredRecords = filterLabel === "all"
    ? records
    : records.filter((r) => r.label === filterLabel);

  const handleExport = () => {
    try {
      const { filename, count } = exportDatasettoCSV(filteredRecords);
      toast.success(`Exported ${count} dataset rows to ${filename}`);
    } catch (err) {
      toast.error(err.message || "Failed to export CSV.");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-slate-900 dark:text-white text-base">
              Sensor Dataset Collection
            </h3>
            <p className="text-xs text-slate-500">
              6-DoF Kinematic IMU Telemetry Labeled for Multi-Task Training
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Movement Label Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <Tag className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
            <select
              value={activeLabel}
              onChange={(e) => onSelectLabel(e.target.value)}
              disabled={isRecording}
              className="bg-transparent border-0 text-slate-800 dark:text-slate-200 text-xs font-medium focus:ring-0 cursor-pointer pr-2"
            >
              {DATASET_MOVEMENT_LABELS.map((lbl) => (
                <option key={lbl.id} value={lbl.id} className="bg-white dark:bg-slate-900">
                  {lbl.label}
                </option>
              ))}
            </select>
          </div>

          {/* Recording Controls */}
          {isRecording ? (
            <Button onClick={onStopRecord} variant="destructive" size="sm" className="gap-1.5 font-semibold">
              <Square className="w-4 h-4" />
              Stop Recording
            </Button>
          ) : (
            <Button onClick={onStartRecord} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold">
              <Play className="w-4 h-4" />
              Start Recording
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredRecords.length === 0}
            className="gap-1.5"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>

          {records.length > 0 && onClear && (
            <Button variant="ghost" size="sm" onClick={onClear} className="text-slate-400 hover:text-rose-600 p-2">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Count Summary */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>Filter by label:</span>
          <select
            value={filterLabel}
            onChange={(e) => setFilterLabel(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
          >
            <option value="all">All Labels ({records.length})</option>
            {DATASET_MOVEMENT_LABELS.map((lbl) => (
              <option key={lbl.id} value={lbl.id}>
                {lbl.id} ({records.filter((r) => r.label === lbl.id).length})
              </option>
            ))}
          </select>
        </div>

        <span className="font-mono">
          Showing {filteredRecords.length} records
        </span>
      </div>

      {/* Dataset Table View */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto font-mono text-xs">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 sticky top-0">
            <tr>
              <th className="py-2.5 px-3">Timestamp (ms)</th>
              <th className="py-2.5 px-3">AX (g)</th>
              <th className="py-2.5 px-3">AY (g)</th>
              <th className="py-2.5 px-3">AZ (g)</th>
              <th className="py-2.5 px-3">GX (°/s)</th>
              <th className="py-2.5 px-3">GY (°/s)</th>
              <th className="py-2.5 px-3">GZ (°/s)</th>
              <th className="py-2.5 px-3">Movement Label</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {filteredRecords.length > 0 ? (
              filteredRecords.slice(-50).reverse().map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{r.timestamp}</td>
                  <td className="py-2 px-3 text-cyan-600">{typeof r.ax === "number" ? r.ax.toFixed(4) : r.ax}</td>
                  <td className="py-2 px-3 text-cyan-600">{typeof r.ay === "number" ? r.ay.toFixed(4) : r.ay}</td>
                  <td className="py-2 px-3 text-cyan-600">{typeof r.az === "number" ? r.az.toFixed(4) : r.az}</td>
                  <td className="py-2 px-3 text-purple-600">{typeof r.gx === "number" ? r.gx.toFixed(3) : r.gx}</td>
                  <td className="py-2 px-3 text-purple-600">{typeof r.gy === "number" ? r.gy.toFixed(3) : r.gy}</td>
                  <td className="py-2 px-3 text-purple-600">{typeof r.gz === "number" ? r.gz.toFixed(3) : r.gz}</td>
                  <td className="py-2 px-3 font-sans">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                      {r.label}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                  No dataset packets recorded yet. Select movement label and click "Start Recording" while OA_IMU is connected.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
