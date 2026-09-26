import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, Image as ImageIcon, X, CheckCircle2, RefreshCw, FileSearch, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function XRayUploadModal({ isOpen, onClose, onAnalysisComplete }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reportResult, setReportResult] = useState(null);
  const inputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    if (selected.type.startsWith("image/")) {
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
    setReportResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      if (dropped.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(dropped));
      }
      setReportResult(null);
    }
  };

  const runDocumentAI = async () => {
    if (!file) {
      toast.error("Please select an X-ray or medical report document.");
      return;
    }

    setAnalyzing(true);
    // Simulates multi-modal feature extraction on document / radiologic image
    setTimeout(() => {
      const result = {
        filename: file.name,
        type: file.type.includes("pdf") ? "Clinical Lab Report" : "Knee Radiograph (X-Ray)",
        findings: [
          { feature: "Joint Space Narrowing (JSN)", value: "Mild to Moderate medial compartment reduction", confidence: 91 },
          { feature: "Subchondral Sclerosis", value: "Subtle cortical thickening on tibial plateau", confidence: 84 },
          { feature: "Osteophytosis", value: "Minor marginal tibial osteophytes detected", confidence: 88 },
          { feature: "Kellgren-Lawrence Prototype Band", value: "Grade 2 (Mild OA pattern indicator)", confidence: 85 },
        ],
        summary: "Radiological / document findings correlate with biomechanical ROM asymmetry and medial joint stress observed in kinematics.",
        disclaimer: "Document & X-ray AI extraction is an experimental screening aid and does not constitute a radiological report.",
      };

      setReportResult(result);
      setAnalyzing(false);
      toast.success("Document analyzed successfully.");
      if (onAnalysisComplete) onAnalysisComplete(result);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <FileSearch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-slate-900 dark:text-white text-base">
                Upload Medical Reports & X-Rays
              </h3>
              <p className="text-xs text-slate-500">
                AI Document & Radiographic Joint Feature Extraction
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-50/60 dark:bg-slate-800/40 space-y-2"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 shadow-sm border border-slate-200 dark:border-slate-700 mx-auto flex items-center justify-center">
            <UploadCloud className="w-6 h-6 text-emerald-600" />
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {file ? file.name : "Click or drag medical reports & knee X-rays here"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Supports PNG, JPG, DICOM preview, or PDF medical summary reports
            </p>
          </div>
        </div>

        {/* Image Preview if available */}
        {previewUrl && (
          <div className="relative rounded-xl overflow-hidden max-h-48 border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center">
            <img src={previewUrl} alt="Uploaded Knee Radiograph" className="max-h-48 object-contain" />
          </div>
        )}

        {/* Action Button */}
        {file && !reportResult && (
          <Button
            onClick={runDocumentAI}
            disabled={analyzing}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing Document Features...
              </>
            ) : (
              <>
                <FileSearch className="w-4 h-4" />
                Analyze Document with Multimodal AI
              </>
            )}
          </Button>
        )}

        {/* AI Report Findings */}
        {reportResult && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {reportResult.type} Analysis
              </span>
              <span className="text-[11px] font-mono text-slate-500">{reportResult.filename}</span>
            </div>

            <div className="space-y-2 text-xs">
              {reportResult.findings.map((f, i) => (
                <div key={i} className="flex justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{f.feature}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{f.value}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 leading-relaxed">
              <strong>Multimodal Correlation:</strong> {reportResult.summary}
            </p>

            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-[11px] flex items-start gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
              <span>{reportResult.disclaimer}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
