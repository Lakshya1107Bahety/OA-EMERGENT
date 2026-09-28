import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Users, AlertTriangle, Activity, Gauge, Loader2, WifiOff } from "lucide-react";
import { RISK_COLOR } from "@/components/RiskBadge";

const MOCK_DATA = {
  total_patients: 0,
  total_screenings: 0,
  high_risk_patients: 0,
  average_deviation_score: null,
  scored_screenings: 0,
  monthly_screenings: [
    { month: "Apr 2026", count: 0 }, { month: "May 2026", count: 0 },
    { month: "Jun 2026", count: 0 }, { month: "Jul 2026", count: 0 },
    { month: "Aug 2026", count: 0 }, { month: "Sep 2026", count: 0 },
  ],
  risk_distribution: [
    { level: "Low", count: 0 }, { level: "Moderate", count: 0 },
    { level: "High", count: 0 }, { level: "Severe", count: 0 },
  ],
  age_distribution: [
    { range: "<40", count: 0 }, { range: "40-49", count: 0 },
    { range: "50-59", count: 0 }, { range: "60-69", count: 0 }, { range: "70+", count: 0 },
  ],
  village_cases: [],
};

const StatCard = ({ icon: Icon, label, value, tone, testid }) => (
  <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5" data-testid={testid}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
      <Icon className="w-5 h-5" />
    </div>
    <p className="mt-3 font-heading text-3xl font-bold text-slate-900">{value}</p>
    <p className="text-sm text-slate-600">{label}</p>
  </div>
);

const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
    <h3 className="font-heading font-semibold text-slate-800 mb-4">{title}</h3>
    <div style={{ width: "100%", height: 240 }}>{children}</div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) { setData(MOCK_DATA); setOffline(true); }
    }, 5000);
    api.get("/analytics/summary")
      .then((r) => { if (!cancelled) { clearTimeout(timeout); setData(r.data); setOffline(false); } })
      .catch(() => { if (!cancelled) { clearTimeout(timeout); setData(MOCK_DATA); setOffline(true); } });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-slate-500">Loading analytics…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
        <p className="text-slate-600">Welcome back, {user?.name}. Population-level OA screening insights.</p>
      </div>

      {offline && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3" data-testid="offline-banner">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span><strong>Backend offline</strong> — displaying local demo data. Start the backend server to view live analytics.</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Patients" value={data.total_patients} tone="bg-accent text-primary" testid="stat-total-patients" />
        <StatCard icon={AlertTriangle} label="High-Risk Patients" value={data.high_risk_patients} tone="bg-orange-50 text-orange-600" testid="stat-high-risk" />
        <StatCard icon={Activity} label="Total Screenings" value={data.total_screenings} tone="bg-emerald-50 text-emerald-600" testid="stat-screenings" />
        <StatCard icon={Gauge} label="Avg Gait Deviation" value={data.average_deviation_score ?? "—"} tone="bg-amber-50 text-amber-600" testid="stat-avg-deviation" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Monthly Screenings">
          <ResponsiveContainer>
            <LineChart data={data.monthly_screenings}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Risk Distribution">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data.risk_distribution} dataKey="count" nameKey="level" innerRadius={50} outerRadius={90} paddingAngle={3}>
                {data.risk_distribution.map((e) => (
                  <Cell key={e.level} fill={RISK_COLOR[e.level]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Age Distribution">
          <ResponsiveContainer>
            <BarChart data={data.age_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="range" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0F766E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Village-wise Cases">
          <ResponsiveContainer>
            <BarChart data={data.village_cases} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis type="number" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="village" fontSize={11} width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="#10B981" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">Screenings with a calibrated gait score</p>
          <p className="font-heading text-3xl font-bold text-secondary">{data.scored_screenings ?? 0}/{data.total_screenings}</p>
          <p className="text-xs text-slate-500 mt-1">Gait deviation = share of reference walking trials that look more typical. It is not an OA probability.</p>
        </div>
        <Gauge className="w-12 h-12 text-secondary/40" />
      </div>
    </div>
  );
}
