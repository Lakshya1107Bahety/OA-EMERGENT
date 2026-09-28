import React, { useEffect, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { getBackendStatus, onBackendStatus, wakeBackend } from "@/lib/api";

// Shows while the free-tier backend is starting up, or when it cannot be reached.
export default function BackendStatusBanner() {
  const [status, setStatus] = useState(getBackendStatus());
  useEffect(() => onBackendStatus(setStatus), []);

  if (status === "waking") {
    return (
      <div role="status" aria-live="polite" data-testid="backend-waking-banner"
        className="flex items-center gap-3 bg-sky-50 border border-sky-200 text-sky-900 text-sm rounded-xl px-4 py-3">
        <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />
        <span><strong>Waking up the server…</strong> The free hosting plan sleeps when idle; this can take up to a minute.</span>
      </div>
    );
  }
  if (status === "down") {
    return (
      <div role="alert" data-testid="backend-down-banner"
        className="flex flex-wrap items-center gap-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl px-4 py-3">
        <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1"><strong>Can't reach the server.</strong> Check your internet connection and try again.</span>
        <button type="button" onClick={() => wakeBackend()}
          className="font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded">
          Retry
        </button>
      </div>
    );
  }
  return null;
}
