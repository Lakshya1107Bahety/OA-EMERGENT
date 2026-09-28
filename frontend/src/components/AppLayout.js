import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { syncPending, getPending } from "@/lib/offline";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Activity, Stethoscope, BookOpen, Settings as SettingsIcon,
  LogOut, HeartPulse, Wifi, WifiOff, Menu, X, CloudUpload, Bone, Server,
  Database, Layers, RadioTower, ShieldAlert, Camera, ShieldCheck
} from "lucide-react";

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/assessment", label: "Patient Assessment", icon: HeartPulse },
  { to: "/app/camera", label: "Live Camera Analysis", icon: Camera },
  { to: "/app/imu", label: "IMU / Wearable Data", icon: RadioTower },
  { to: "/app/multimodal", label: "Multimodal Analysis", icon: Server },
  { to: "/app/result", label: "OA Risk Results", icon: Activity },
  { to: "/app/patients", label: "Patient History", icon: Users },
  { to: "/app/dataset", label: "Dataset & Collection", icon: Database },
  { to: "/app/architecture", label: "System Architecture", icon: Layers },
  { to: "/app/doctor-review", label: "Doctor Review", icon: Stethoscope, roles: ["doctor", "admin"] },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
];

const ROLE_LABEL = {
  healthcare_worker: "Healthcare Worker",
  doctor: "Doctor",
  admin: "Admin",
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const refresh = async () => setPending((await getPending()).length);
    refresh();
    const goOnline = async () => {
      setOnline(true);
      const n = await syncPending();
      if (n > 0) toast.success(`Synced ${n} offline record(s)`);
      refresh();
    };
    const goOffline = () => {
      setOnline(false);
      toast.warning("You are offline. Records will be saved locally.");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const iv = setInterval(refresh, 4000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(iv);
    };
  }, []);

  const links = NAV.filter((n) => !n.roles || n.roles.includes(user?.role));

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-6 py-5 border-b border-emerald-900/10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-sm">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="font-heading font-bold text-slate-900 leading-tight text-base">OA Sentinel</p>
          <p className="text-[11px] text-emerald-700 font-medium">Multimodal AI Screening</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto jc-scrollbar">
        {links.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            data-testid={`nav-${n.label.toLowerCase().replace(/ /g, "-")}`}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground font-semibold shadow-xs"
                  : "text-slate-600 hover:bg-muted"
              }`
            }
          >
            <n.icon className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate">{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-emerald-900/10 bg-slate-50/50">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
          <p className="text-xs text-primary font-medium">{ROLE_LABEL[user?.role] || "Clinician"}</p>
        </div>
        <button
          data-testid="logout-button"
          onClick={() => { logout(); navigate("/login"); }}
          className="flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-destructive transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-emerald-900/10 fixed h-screen z-30">
        <SidebarContent />
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-white h-full">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-emerald-900/10 flex items-center justify-between px-4 lg:px-8 h-16">
          <button className="lg:hidden" onClick={() => setOpen(true)} data-testid="menu-toggle">
            <Menu className="w-6 h-6 text-slate-700" />
          </button>
          <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            ESP32 IMU & Camera Multimodal Engine Active
          </div>
          <div className="flex items-center gap-3">
            {pending > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full" data-testid="pending-sync-badge">
                <CloudUpload className="w-4 h-4" /> {pending} pending
              </span>
            )}
            <span
              data-testid="connection-status"
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                online ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
              }`}
            >
              {online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {online ? "Online" : "Offline"}
            </span>
          </div>
        </header>
        
        <main className="flex-1 p-4 lg:p-8 jc-scrollbar">
          <div className="mb-4 empty:mb-0"><BackendStatusBanner /></div>
          <Outlet />
        </main>

        {/* Global Statutory Disclaimer Footer */}
        <footer className="border-t border-slate-200/80 bg-white/90 px-4 py-3 text-center">
          <p className="text-xs text-slate-600 flex items-center justify-center gap-1.5 flex-wrap">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 inline" />
            <strong>OA Sentinel provides an AI-assisted screening/risk assessment and does not replace clinical diagnosis.</strong>
          </p>
        </footer>
      </div>
    </div>
  );
}
