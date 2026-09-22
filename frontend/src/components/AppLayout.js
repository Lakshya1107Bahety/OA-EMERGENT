import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { syncPending, getPending } from "@/lib/offline";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Activity, Stethoscope, BookOpen, Settings as SettingsIcon,
  LogOut, HeartPulse, Wifi, WifiOff, Menu, X, CloudUpload,
} from "lucide-react";

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/patients", label: "Patients", icon: Users },
  { to: "/app/screening", label: "AI Screening", icon: Activity },
  { to: "/app/doctor-review", label: "Doctor Review", icon: Stethoscope, roles: ["doctor", "admin"] },
  { to: "/app/awareness", label: "Awareness Hub", icon: BookOpen },
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
      <div className="flex items-center gap-2 px-6 py-5 border-b border-emerald-900/10">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
          <HeartPulse className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-heading font-bold text-slate-900 leading-tight">JointCare AI</p>
          <p className="text-xs text-muted-foreground">OA Screening</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            data-testid={`nav-${n.label.toLowerCase().replace(/ /g, "-")}`}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-slate-600 hover:bg-muted"
              }`
            }
          >
            <n.icon className="w-5 h-5" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-emerald-900/10">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
          <p className="text-xs text-primary font-medium">{ROLE_LABEL[user?.role]}</p>
        </div>
        <button
          data-testid="logout-button"
          onClick={() => { logout(); navigate("/login"); }}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-destructive transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-emerald-900/10 fixed h-screen">
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
          <div className="hidden lg:block" />
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
