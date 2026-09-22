import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RiskBadge from "@/components/RiskBadge";
import { Loader2, Search, UserPlus, Activity, ChevronRight } from "lucide-react";

export default function PatientRecords() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const load = (q = "") => {
    setPatients(null);
    api.get("/patients", { params: q ? { search: q } : {} }).then((r) => setPatients(r.data));
  };
  useEffect(() => { load(); }, []);

  const filtered = (patients || []).filter((p) => {
    if (filter === "all") return true;
    if (filter === "high") return ["High", "Severe"].includes(p.latest_risk);
    if (filter === "screened") return !!p.latest_risk;
    if (filter === "unscreened") return !p.latest_risk;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900">Patient Records</h1>
          <p className="text-slate-600">Manage patients and screening history.</p>
        </div>
        <Button className="rounded-xl h-11" data-testid="add-patient-button" onClick={() => navigate("/app/patients/new")}>
          <UserPlus className="w-4 h-4 mr-2" /> New Patient
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(search)}
            placeholder="Search by name, village, phone..."
            data-testid="patient-search-input"
            className="pl-9 h-11 rounded-xl"
          />
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="all" data-testid="filter-all">All</TabsTrigger>
            <TabsTrigger value="high" data-testid="filter-high">High-Risk</TabsTrigger>
            <TabsTrigger value="screened" data-testid="filter-screened">Screened</TabsTrigger>
            <TabsTrigger value="unscreened" data-testid="filter-unscreened">New</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {patients === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-emerald-900/10 p-12 text-center text-slate-500">
          No patients found. Register your first patient to get started.
        </div>
      ) : (
        <div className="grid gap-3" data-testid="patient-list">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/app/patients/${p.id}`)}
              data-testid={`patient-card-${p.id}`}
              className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm hover:shadow-md transition-all p-4 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center font-heading font-bold text-primary shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                  <p className="text-sm text-slate-500 truncate">
                    {p.age}y · {p.gender} · {p.village || "—"} · {p.screening_count} screening(s)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {p.latest_probability != null && (
                  <span className="font-heading font-bold text-slate-700 hidden sm:block">{p.latest_probability}%</span>
                )}
                <RiskBadge level={p.latest_risk} testid={`patient-risk-${p.id}`} />
                <Button size="sm" variant="ghost" className="rounded-xl" onClick={(e) => { e.stopPropagation(); navigate(`/app/screening/${p.id}`); }} data-testid={`screen-patient-${p.id}`}>
                  <Activity className="w-4 h-4" />
                </Button>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
