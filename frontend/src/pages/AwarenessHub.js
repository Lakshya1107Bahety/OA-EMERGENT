import React, { useState } from "react";
import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, Activity, Apple, Dumbbell, ShieldAlert } from "lucide-react";

const TOPICS = [
  {
    icon: ShieldAlert, title: "Early Signs of Osteoarthritis",
    points: [
      "Morning knee stiffness lasting under 30 minutes.",
      "Grating or cracking sensation (crepitus) during movement.",
      "Swelling or tenderness around the knee joint.",
      "Pain that worsens with activity and eases with rest.",
    ],
  },
  {
    icon: Dumbbell, title: "Knee-Strengthening Exercises",
    points: [
      "Straight leg raises — 10 reps, twice daily.",
      "Seated knee extensions using light resistance.",
      "Wall squats held for 5–10 seconds.",
      "Gentle walking on flat ground for 20 minutes.",
    ],
  },
  {
    icon: Apple, title: "Diet & Joint Health",
    points: [
      "Include omega-3 rich foods (fish, flaxseed).",
      "Maintain healthy weight to reduce joint load.",
      "Turmeric and ginger may help reduce inflammation.",
      "Ensure adequate calcium and vitamin D intake.",
    ],
  },
  {
    icon: Activity, title: "When to See a Doctor",
    points: [
      "Persistent pain not relieved by rest or medication.",
      "Visible joint deformity or instability.",
      "Inability to bear weight on the affected leg.",
      "Sudden swelling, redness, or warmth.",
    ],
  },
];

const IMAGES = [
  { url: "https://images.pexels.com/photos/30483052/pexels-photo-30483052.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", title: "Sensor-based joint assessment" },
  { url: "https://images.pexels.com/photos/20860607/pexels-photo-20860607.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", title: "Guided physiotherapy" },
];

export default function AwarenessHub() {
  const [lang, setLang] = useState("English");
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900">Awareness Hub</h1>
            <p className="text-slate-600">Educational resources on knee osteoarthritis.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {["English", "Assamese", "Bengali"].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              data-testid={`lang-${l.toLowerCase()}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${lang === l ? "bg-primary text-white" : "bg-muted text-slate-600"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {IMAGES.map((img) => (
          <motion.div key={img.title} whileHover={{ scale: 1.02 }} className="relative rounded-2xl overflow-hidden shadow-sm">
            <img src={img.url} alt={img.title} className="w-full h-44 object-cover" />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3">
              <p className="text-white text-sm font-medium">{img.title}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-5">
        <Accordion type="single" collapsible className="w-full" defaultValue="item-0">
          {TOPICS.map((t, i) => (
            <AccordionItem key={t.title} value={`item-${i}`} data-testid={`topic-${i}`}>
              <AccordionTrigger className="text-left">
                <span className="flex items-center gap-3">
                  <t.icon className="w-5 h-5 text-primary" /> {t.title}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-10 space-y-1.5 text-slate-600">
                  {t.points.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
