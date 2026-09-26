import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export default function SensorCharts({ readings = [] }) {
  // Format last 40 readings for plotting
  const chartData = readings.slice(-40).map((r, i) => ({
    index: i,
    time: r.timestamp ? `${(r.timestamp % 100000) / 1000}s` : `${i}`,
    ax: typeof r.ax === "number" ? +r.ax.toFixed(3) : 0,
    ay: typeof r.ay === "number" ? +r.ay.toFixed(3) : 0,
    az: typeof r.az === "number" ? +r.az.toFixed(3) : 0,
    gx: typeof r.gx === "number" ? +r.gx.toFixed(2) : 0,
    gy: typeof r.gy === "number" ? +r.gy.toFixed(2) : 0,
    gz: typeof r.gz === "number" ? +r.gz.toFixed(2) : 0,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 text-white p-2.5 rounded-lg text-xs font-mono shadow-lg border border-slate-700 space-y-1">
          <p className="text-slate-400 font-sans font-semibold">T: {label}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Acceleration Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-heading font-semibold text-slate-900 dark:text-white text-sm">
            Acceleration X / Y / Z (g)
          </h4>
          <span className="text-xs text-slate-500 font-mono">Range ±2g</span>
        </div>

        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis domain={[-2, 2]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="ax" name="AX" stroke="#0ea5e9" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="ay" name="AY" stroke="#10b981" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="az" name="AZ" stroke="#f59e0b" strokeWidth={1.8} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
              Waiting for live sensor packets...
            </div>
          )}
        </div>
      </div>

      {/* Gyroscope Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-heading font-semibold text-slate-900 dark:text-white text-sm">
            Angular Velocity GX / GY / GZ (°/s)
          </h4>
          <span className="text-xs text-slate-500 font-mono">Range ±250 °/s</span>
        </div>

        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis domain={[-250, 250]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="gx" name="GX" stroke="#8b5cf6" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="gy" name="GY" stroke="#ec4899" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="gz" name="GZ" stroke="#06b6d4" strokeWidth={1.8} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
              Waiting for live sensor packets...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
