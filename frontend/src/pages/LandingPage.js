import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  HeartPulse, Activity, ShieldCheck, Wifi, Bluetooth, Brain, ArrowRight, CheckCircle2,
  Stethoscope, LineChart, Bone, Upload,
} from "lucide-react";

const HERO = "https://images.unsplash.com/photo-1609113160023-4e31f3765fd7?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const CARE = "https://images.unsplash.com/photo-1789524449725-ebc536ee51c3?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";
const THERAPY = "https://images.pexels.com/photos/20860603/pexels-photo-20860603.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const stats = [
  { value: "22%", label: "Rural adults 50+ at OA risk" },
  { value: "6-axis", label: "MPU6050 motion capture" },
  { value: "<60s", label: "Per screening" },
  { value: "8", label: "NE India districts" },
];

const features = [
  { icon: Bluetooth, title: "ESP32 Bluetooth", desc: "Connect a wearable MPU6050 over BLE and stream live accelerometer & gyroscope data straight to the browser." },
  { icon: Brain, title: "AI Risk Engine", desc: "Compares rolling sensor averages against your reference dataset to output OA probability, confidence and risk tier." },
  { icon: Bone, title: "Movement Tests", desc: "MediaPipe pose tracking scores sit-to-stand, balance, gait, squat and Timed Up & Go with real-time joint angles." },
  { icon: Wifi, title: "Offline-First", desc: "Register patients and capture readings without internet; everything auto-syncs when connectivity returns." },
];

const steps = [
  { icon: Stethoscope, title: "Register", desc: "Add patient vitals & history." },
  { icon: Bluetooth, title: "Connect", desc: "Pair the ESP32 knee sensor." },
  { icon: Activity, title: "Screen", desc: "Capture live movement data." },
  { icon: LineChart, title: "Predict", desc: "Get instant OA risk & report." },
];

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#F7FAF8] overflow-x-hidden">
      {/* nav */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-emerald-900/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg text-slate-900">JointCare AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login"><Button variant="ghost" data-testid="nav-login-button">Log in</Button></Link>
            <Link to="/signup"><Button data-testid="nav-signup-button" className="rounded-full">Get Started</Button></Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute top-40 -left-24 w-80 h-80 rounded-full bg-teal-200/40 blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-white shadow-sm ring-1 ring-emerald-900/10 px-4 py-2 rounded-full">
              <ShieldCheck className="w-4 h-4" /> Smart India Hackathon 2026
            </span>
            <h1 className="mt-6 font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]">
              Detect knee <span className="text-primary">osteoarthritis</span> early — right in the village
            </h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-xl">
              JointCare AI pairs a wearable ESP32 + MPU6050 sensor with AI movement analysis, giving rural
              health workers an objective knee-OA risk score in under a minute.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button size="lg" className="rounded-full h-12 px-8 shadow-lg shadow-emerald-600/20" data-testid="hero-start-button" onClick={() => navigate("/signup")}>
                Start Screening <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="rounded-full h-12 px-8 bg-white" onClick={() => navigate("/login")}>
                I have an account
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {["No specialist required", "Elderly-friendly", "Works offline"].map((t) => (
                <span key={t} className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-primary" /> {t}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }} className="relative">
            <div className="rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-emerald-900/10">
              <img src={HERO} alt="Wearable knee sensor" className="w-full object-cover aspect-[4/3]" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="absolute -bottom-6 -left-4 bg-white/90 backdrop-blur rounded-2xl shadow-xl p-4 ring-1 ring-emerald-900/10"
            >
              <p className="text-xs text-muted-foreground">OA Probability</p>
              <p className="font-heading text-3xl font-bold text-primary">72%</p>
              <p className="text-xs font-semibold text-orange-500">High Risk · 91% conf.</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
              className="absolute -top-4 -right-3 bg-white/90 backdrop-blur rounded-2xl shadow-xl p-3 ring-1 ring-emerald-900/10 flex items-center gap-2"
            >
              <Bluetooth className="w-5 h-5 text-secondary" />
              <div>
                <p className="text-xs font-semibold text-slate-800">ESP32 connected</p>
                <p className="text-[10px] text-emerald-600">streaming 6-axis</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* stats */}
      <section className="bg-white border-y border-emerald-900/10 py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="text-center">
              <p className="font-heading text-3xl lg:text-4xl font-bold text-primary">{s.value}</p>
              <p className="mt-1 text-sm text-slate-600">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-slate-900">Built for the field, powered by sensors</h2>
          <p className="mt-3 text-slate-600">Everything a rural health worker needs to screen for knee OA — from hardware to AI report.</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl ring-1 ring-emerald-900/10 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all p-6">
              <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold text-slate-800">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="bg-white border-y border-emerald-900/10 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-slate-900 text-center">Four simple steps</h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="relative rounded-2xl bg-[#F7FAF8] p-6 ring-1 ring-emerald-900/5">
                <span className="absolute top-4 right-5 font-heading text-4xl font-bold text-emerald-100">{i + 1}</span>
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <s.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold text-slate-800">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* split showcase */}
      <section className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div className="grid grid-cols-2 gap-4">
          <img src={CARE} alt="Community screening" className="rounded-2xl object-cover h-64 w-full shadow-md" />
          <img src={THERAPY} alt="Knee physiotherapy" className="rounded-2xl object-cover h-64 w-full shadow-md mt-8" />
        </div>
        <div>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-slate-900">From raw sensor data to a doctor-ready report</h2>
          <ul className="mt-6 space-y-4">
            {[
              { icon: Upload, t: "Upload your dataset", d: "Add historical MPU6050/OA CSV data; column means become the reference baseline." },
              { icon: Activity, t: "Rolling-average noise filtering", d: "Live BLE readings are averaged over the last 50–100 samples for stable predictions." },
              { icon: LineChart, t: "Explainable results", d: "See which sensor factors drove the risk score, plus an AI-written plain-language summary." },
            ].map((x) => (
              <li key={x.t} className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                  <x.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{x.t}</p>
                  <p className="text-sm text-slate-600">{x.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="relative overflow-hidden bg-primary rounded-[2rem] p-10 text-center">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -left-8 w-48 h-48 rounded-full bg-white/10" />
          <h2 className="relative font-heading text-3xl font-bold text-white">Ready to screen your first patient?</h2>
          <p className="relative mt-3 text-emerald-50">Create an account and run an AI-assisted screening in minutes.</p>
          <Button size="lg" variant="secondary" className="relative mt-6 rounded-full h-12 px-8 bg-white text-primary hover:bg-emerald-50" onClick={() => navigate("/signup")}>
            Start Screening Free
          </Button>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          AI-assisted screening, not a medical diagnosis. © 2026 JointCare AI.
        </p>
      </section>
    </div>
  );
}
