import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Users, AlertTriangle, Activity, Gauge, Loader2 } from "lucide-react";
import { RISK_COLOR } from "@/components/RiskBadge";

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

  useEffect(() => {
    api.get("/analytics/summary").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
        <p className="text-slate-600">Welcome back, {user?.name}. Population-level OA screening insights.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Patients" value={data.total_patients} tone="bg-accent text-primary" testid="stat-total-patients" />
        <StatCard icon={AlertTriangle} label="High-Risk Patients" value={data.high_risk_patients} tone="bg-orange-50 text-orange-600" testid="stat-high-risk" />
        <StatCard icon={Activity} label="Total Screenings" value={data.total_screenings} tone="bg-emerald-50 text-emerald-600" testid="stat-screenings" />
        <StatCard icon={Gauge} label="Avg OA Probability" value={`${data.average_oa_probability}%`} tone="bg-amber-50 text-amber-600" testid="stat-avg-prob" />
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
          <p className="text-sm text-slate-600">Average Knee Stability Score</p>
          <p className="font-heading text-3xl font-bold text-secondary">{data.average_stability_score}/100</p>
        </div>
        <Gauge className="w-12 h-12 text-secondary/40" />
      </div>
    </div>
  );
}
