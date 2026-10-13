import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Sparkles, Search, Target, Wand2, CheckCircle2, Briefcase, Rocket } from "lucide-react";

export const CV_STEPS = [
  { icon: FileText, text: "Reading your CV" },
  { icon: Search, text: "Scanning for keywords" },
  { icon: Sparkles, text: "Polishing the details" },
  { icon: Rocket, text: "Almost ready" },
];
export const ATS_STEPS = [
  { icon: FileText, text: "Reading your CV" },
  { icon: Search, text: "Parsing the job description" },
  { icon: Target, text: "Matching your skills" },
  { icon: Wand2, text: "Finding gaps & missing fields" },
  { icon: CheckCircle2, text: "Calculating your score" },
];

// Rotating icon + orbit ring + step list + shimmer bar. Used for page loads and ATS analysis.
export default function FunLoader({ steps = CV_STEPS, title = "Loading your CV", compact = false, intervalMs = 1300 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), intervalMs);
    return () => clearInterval(id);
  }, [steps.length, intervalMs]);
  const Icon = steps[i].icon;
  const pct = ((i + 1) / steps.length) * 100;

  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 ${compact ? "py-10" : "min-h-[60vh]"}`} role="status" aria-live="polite">
      <div className="relative w-28 h-28">
        <motion.span className="absolute inset-0 rounded-full border-2 border-dashed border-[#D8B873]" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 9, ease: "linear" }} />
        <motion.span className="absolute inset-2 rounded-full border-[3px] border-transparent border-t-[#0F766E] border-r-[#0F766E]" animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }} />
        <motion.span className="absolute inset-0 rounded-full bg-[#0F766E]/10" animate={{ scale: [0.85, 1.25], opacity: [0.7, 0] }} transition={{ repeat: Infinity, duration: 1.8 }} />
        <div className="absolute inset-5 rounded-2xl bg-white shadow-lg grid place-items-center">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ scale: 0, rotate: -90, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0, rotate: 90, opacity: 0 }} transition={{ duration: 0.25 }}>
              <Icon size={30} className="text-[#0F766E]" strokeWidth={1.8} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <h2 className="mt-6 font-serif text-2xl text-[#1B2A41]">{title}</h2>
      <AnimatePresence mode="wait">
        <motion.p key={i} className="mt-1 text-sm text-[#5B6B7F]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {steps[i].text}…
        </motion.p>
      </AnimatePresence>

      <div className="mt-5 h-1.5 w-56 rounded-full bg-[#E3E8EF] overflow-hidden">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-[#0F766E] to-[#D8B873]" animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
      </div>
      <div className="mt-4 flex gap-2">
        {steps.map((s, k) => (
          <motion.span key={k} className={`w-2 h-2 rounded-full ${k <= i ? "bg-[#0F766E]" : "bg-[#C9D1DA]"}`} animate={k === i ? { scale: [1, 1.5, 1] } : {}} transition={{ repeat: Infinity, duration: 1 }} />
        ))}
      </div>
    </div>
  );
}
