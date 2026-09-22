import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { syncPending, getPending } from "@/lib/offline";
import { toast } from "sonner";
import { Settings as SettingsIcon, Upload, Database, Accessibility, CloudUpload, Loader2, CheckCircle2 } from "lucide-react";

export default function Settings() {
  const { user, elderly, setElderly } = useAuth();
  const [dataset, setDataset] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const fileRef = useRef(null);

  const canUpload = ["admin", "doctor"].includes(user?.role);

  const loadInfo = () => {
    api.get("/dataset/info").then((r) => setDataset(r.data));
    getPending().then((p) => setPending(p.length));
  };
  useEffect(() => { loadInfo(); }, []);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/dataset/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Dataset uploaded: ${data.row_count} rows`);
      loadInfo();
    } catch (err) {
      toast.error("Upload failed — use CSV or JSON");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doSync = async () => {
    setSyncing(true);
    const n = await syncPending();
    toast.success(n > 0 ? `Synced ${n} record(s)` : "Nothing to sync");
    loadInfo();
    setSyncing(false);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600">Manage dataset, accessibility, and offline sync.</p>
        </div>
      </div>

      {/* Accessibility */}
      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-6">
        <h3 className="font-heading font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Accessibility className="w-5 h-5 text-primary" /> Elderly-Friendly Mode
        </h3>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Larger text and bigger touch targets across the app.</p>
          <Switch checked={elderly} onCheckedChange={setElderly} data-testid="elderly-mode-switch" />
        </div>
      </div>

      {/* Dataset */}
      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-6">
        <h3 className="font-heading font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-primary" /> OA Prediction Dataset
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Upload your medical reference dataset (CSV or JSON). The prediction engine reads it during screening —
          no dataset is hardcoded. Replace it anytime with your trained ML model's reference data.
        </p>
        {dataset?.loaded ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3 mb-4" data-testid="dataset-status">
            <CheckCircle2 className="w-4 h-4" /> Loaded: <b>{dataset.filename}</b> ({dataset.row_count} rows)
          </div>
        ) : (
          <div className="text-sm text-slate-400 bg-muted rounded-xl p-3 mb-4" data-testid="dataset-status">
            No dataset uploaded — engine uses rule-based scoring.
          </div>
        )}
        {canUpload ? (
          <>
            <input ref={fileRef} type="file" accept=".csv,.json" onChange={upload} className="hidden" data-testid="dataset-file-input" />
            <Button className="rounded-xl" disabled={uploading} onClick={() => fileRef.current?.click()} data-testid="dataset-upload-button">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload Dataset
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Only doctors and admins can upload datasets.</p>
        )}
      </div>

      {/* Offline sync */}
      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-6">
        <h3 className="font-heading font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <CloudUpload className="w-5 h-5 text-primary" /> Offline Sync
        </h3>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600"><b data-testid="pending-count">{pending}</b> record(s) pending upload.</p>
          <Button variant="outline" className="rounded-xl" onClick={doSync} disabled={syncing} data-testid="sync-now-button">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sync Now"}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-6">
        <h3 className="font-heading font-semibold text-slate-800 mb-3">Account</h3>
        <p className="text-sm text-slate-600">Name: <b>{user?.name}</b></p>
        <p className="text-sm text-slate-600">Email: <b>{user?.email}</b></p>
        <p className="text-sm text-slate-600">Role: <b className="capitalize">{user?.role?.replace("_", " ")}</b></p>
      </div>
    </div>
  );
}
