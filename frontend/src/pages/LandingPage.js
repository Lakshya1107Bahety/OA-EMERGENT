import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  HeartPulse, Activity, ShieldCheck, Wifi, Users, Brain, ArrowRight, CheckCircle2,
} from "lucide-react";

const stats = [
  { value: "22%", label: "Rural adults over 50 at OA risk" },
  { value: "6-axis", label: "MPU6050 motion sensing" },
  { value: "< 60s", label: "Per screening" },
  { value: "8", label: "NE India districts covered" },
];

const features = [
  { icon: Activity, title: "Live Sensor Screening", desc: "Stream MPU6050 accelerometer & gyroscope data in real time for objective knee movement analysis." },
  { icon: Brain, title: "AI Risk Prediction", desc: "Modular OA engine returns probability, risk tier, confidence and the sensor factors that mattered most." },
  { icon: Wifi, title: "Works Offline", desc: "Register patients and capture readings without internet. Auto-syncs when connectivity returns." },
  { icon: Users, title: "Role-based Workflow", desc: "Healthcare workers screen, doctors review and confirm, admins track population-level analytics." },
];

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-emerald-900/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg text-slate-900">JointCare AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" data-testid="nav-login-button">Log in</Button>
            </Link>
            <Link to="/signup">
              <Button data-testid="nav-signup-button" className="rounded-full">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full">
            <ShieldCheck className="w-4 h-4" /> Smart India Hackathon 2026
          </span>
          <h1 className="mt-6 font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900">
            Early Osteoarthritis screening for{" "}
            <span className="text-primary">rural North East India</span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-xl">
            JointCare AI equips village healthcare workers with a wearable MPU6050 sensor and an
            AI engine that flags knee osteoarthritis risk in under a minute — even without internet.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button size="lg" className="rounded-full h-12 px-8" data-testid="hero-start-button" onClick={() => navigate("/signup")}>
              Start screening <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-full h-12 px-8" onClick={() => navigate("/login")}>
              I have an account
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {["No specialist required", "Elderly-friendly", "Offline-first"].map((t) => (
              <span key={t} className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-primary" /> {t}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative"
        >
          <img
            src="https://images.pexels.com/photos/39192345/pexels-photo-39192345.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
            alt="Rural doctor examining elderly patient"
            className="rounded-3xl shadow-xl w-full object-cover aspect-[4/3]"
          />
          <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-lg p-4 border border-emerald-900/10 hidden sm:block">
            <p className="text-xs text-muted-foreground">OA Probability</p>
            <p className="font-heading text-3xl font-bold text-primary">72%</p>
            <p className="text-xs font-semibold text-orange-500">High Risk</p>
          </div>
        </motion.div>
      </section>

      <section className="bg-white border-y border-emerald-900/10 py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-heading text-3xl lg:text-4xl font-bold text-primary">{s.value}</p>
              <p className="mt-1 text-sm text-slate-600">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="font-heading text-3xl lg:text-4xl font-bold text-center text-slate-900">
          Built for the field, powered by sensors
        </h2>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm hover:shadow-md transition-all p-6"
            >
              <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold text-slate-800">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="bg-primary rounded-3xl p-10 text-center">
          <h2 className="font-heading text-3xl font-bold text-white">Ready to screen your first patient?</h2>
          <p className="mt-3 text-emerald-50">Create an account and run an AI-assisted screening in minutes.</p>
          <Button size="lg" variant="secondary" className="mt-6 rounded-full h-12 px-8 bg-white text-primary hover:bg-emerald-50" onClick={() => navigate("/signup")}>
            Get Started Free
          </Button>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          AI-assisted screening, not a medical diagnosis. © 2026 JointCare AI.
        </p>
      </section>
    </div>
  );
}
