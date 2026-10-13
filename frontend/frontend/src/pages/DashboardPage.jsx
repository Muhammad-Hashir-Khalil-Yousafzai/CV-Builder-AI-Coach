import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import LoadError from "../components/common/LoadError";
import { useAuth } from "../context/AuthContext";
import { cacheGet, cacheSet } from "../lib/cache";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText, Gauge, Briefcase, Bookmark, Wand2, Target, ArrowUpRight, GraduationCap, Sprout, TrendingUp, Crown, Code2, BarChart3,
  Palette, Megaphone, Landmark, HeartPulse, Wrench, BookOpen, Home, Building2, MapPin, Laptop, FileSignature, Search, Shuffle,
  Banknote, Zap, CalendarClock, CalendarDays, Compass, Layers, Flag, Check, ChevronLeft, ChevronRight, Sparkles, ClipboardList,
} from "lucide-react";

const LEVELS = [
  { id: "student", title: "Student / fresher", sub: "Just starting out" },
  { id: "junior", title: "Junior", sub: "0–2 years" },
  { id: "mid", title: "Mid-level", sub: "3–5 years" },
  { id: "senior", title: "Senior", sub: "6+ years" },
];
const ROLE_IDEAS = ["Software Engineer", "Data Analyst", "Product Designer", "Marketing Executive", "Project Manager"];

const scoreColor = (s) => (s >= 80 ? "#1E7A3C" : s >= 65 ? "#A47E3B" : s >= 50 ? "#C27A1A" : "#B4442F");
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const CSS = `
  @keyframes dbUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @keyframes dbPop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
  @keyframes dbSlide{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}
  @keyframes dbShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
  .db-up{opacity:0;animation:dbUp .5s ease-out forwards}
  .db-pop{animation:dbPop .35s ease-out}
  .db-slide{animation:dbSlide .3s ease-out}
  .db-cta{transition:transform .15s,box-shadow .15s,background-color .15s}
  .db-cta:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.25)}
  .db-cta:active{transform:scale(.97)}
  .db-card{transition:box-shadow .2s,transform .2s}
  .db-card:hover{box-shadow:0 10px 28px rgba(27,42,65,.12);transform:translateY(-3px)}
  .db-skel{position:relative;overflow:hidden;background:#E9EDF1;border-radius:12px}
  .db-skel:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);animation:dbShimmer 1.2s linear infinite}
  @media (prefers-reduced-motion:reduce){.db-up,.db-pop,.db-slide{animation:none;opacity:1}}
`;

function useCountUp(target, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    let start;
    const step = (t) => {
      if (start === undefined) start = t;
      const p = Math.min(1, (t - start) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

function Ring({ value, color, size = 118, stroke = 10, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setV(value), 80);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E3E8EF" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset 1.1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function Tick({ done }) {
  return done ? (
    <span className="db-pop shrink-0 w-5 h-5 rounded-full bg-[#1E7A3C] text-white text-[11px] flex items-center justify-center">✓</span>
  ) : (
    <span className="shrink-0 w-5 h-5 rounded-full border-2 border-[#C9D1DA]" />
  );
}

function Card({ i = 0, className = "", children }) {
  return (
    <section className={`db-up db-card bg-white rounded-xl border border-[#DDE3E8] p-5 sm:p-6 ${className}`} style={{ animationDelay: `${i * 90}ms` }}>
      {children}
    </section>
  );
}

const ACTIONS = [
  { to: "/profile", icon: FileText, title: "Build my CV", text: "Fill in education, experience and skills.", color: "#0F766E", bg: "#E6F4F1" },
  { to: "/ats", icon: Gauge, title: "ATS score", text: "Match your CV against any job post.", color: "#A47E3B", bg: "#F6EEDD" },
  { to: "/ats", icon: Wand2, title: "Improve bullets", text: "Rewrite weak lines into strong ones.", color: "#7C3AED", bg: "#F0EAFE" },
  { to: "/job-matches", icon: Briefcase, title: "Job matches", text: "Find roles that fit your profile.", color: "#2563EB", bg: "#E8F0FE" },
  { to: "/versions", icon: Bookmark, title: "Saved CVs", text: "Keep versions for different jobs.", color: "#C2410C", bg: "#FDEDE3" },
  { to: null, icon: Target, title: "Set my goal", text: "Tell us your target role and level.", color: "#1E7A3C", bg: "#E6F4EA" },
];

function ActionCard({ a, i, onClick }) {
  const Icon = a.icon;
  return (
    <motion.button type="button" onClick={onClick}
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.06 }}
      whileHover={{ y: -6, boxShadow: "0 14px 30px rgba(27,42,65,.14)" }} whileTap={{ scale: 0.97 }}
      className="group relative overflow-hidden text-left bg-white rounded-xl border border-[#DDE3E8] p-5 min-h-[130px] cursor-pointer">
      <span className="absolute -right-8 -top-8 w-28 h-28 rounded-full opacity-60 transition-transform duration-300 group-hover:scale-150" style={{ background: a.bg }} />
      <motion.span whileHover={{ rotate: [0, -12, 12, 0] }} className="relative grid place-items-center w-11 h-11 rounded-xl" style={{ background: a.bg, color: a.color }}>
        <Icon size={22} />
      </motion.span>
      <p className="relative mt-3 font-semibold text-[#1B2A41]">{a.title}</p>
      <p className="relative text-xs text-[#5B6B7F] mt-0.5 pr-6">{a.text}</p>
      <ArrowUpRight size={18} className="absolute right-4 bottom-4 text-[#9AA6B2] transition group-hover:text-[#1B2A41] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </motion.button>
  );
}

// ---------- Onboarding (6 steps). Answers are saved in the database (CareerGoal table). ----------
const ROLE_CARDS = [
  { id: "Software Engineer", icon: Code2 }, { id: "Data Analyst", icon: BarChart3 }, { id: "Product Designer", icon: Palette },
  { id: "Marketing Executive", icon: Megaphone }, { id: "Project Manager", icon: ClipboardList },
];
const LEVEL_ICONS = { student: GraduationCap, junior: Sprout, mid: TrendingUp, senior: Crown };
const FIELDS = [
  { id: "Software & IT", icon: Code2 }, { id: "Data & AI", icon: BarChart3 }, { id: "Design & Creative", icon: Palette },
  { id: "Marketing & Sales", icon: Megaphone }, { id: "Finance & Accounting", icon: Landmark }, { id: "Healthcare", icon: HeartPulse },
  { id: "Engineering", icon: Wrench }, { id: "Education", icon: BookOpen },
];
const WORK_MODES = [
  { id: "Remote", icon: Home, sub: "Work from anywhere" }, { id: "Hybrid", icon: Building2, sub: "Mix of both" }, { id: "On-site", icon: MapPin, sub: "At the office" },
];
const JOB_TYPES = [
  { id: "Full-time", icon: Briefcase }, { id: "Internship", icon: GraduationCap }, { id: "Freelance", icon: Laptop }, { id: "Contract", icon: FileSignature },
];
const GOALS = [
  { id: "Write a strong CV", icon: FileText, to: "/profile" }, { id: "Beat the ATS", icon: Gauge, to: "/ats" },
  { id: "Find matching jobs", icon: Search, to: "/job-matches" }, { id: "Improve my bullets", icon: Wand2, to: "/ats" },
  { id: "Switch careers", icon: Shuffle, to: "/profile" }, { id: "Grow my salary", icon: Banknote, to: "/ats" },
];
const TIMELINES = [
  { id: "ASAP", icon: Zap, sub: "I need a job now" }, { id: "1–3 months", icon: CalendarClock, sub: "Actively looking" },
  { id: "3–6 months", icon: CalendarDays, sub: "Preparing ahead" }, { id: "Just exploring", icon: Compass, sub: "No rush" },
];
const STEPS = [
  { icon: Target, title: "What role are you aiming for?", sub: "Pick one or type your own." },
  { icon: TrendingUp, title: "Your experience level", sub: "Pick the closest match." },
  { icon: Layers, title: "Which fields interest you?", sub: "Choose up to 3." },
  { icon: Building2, title: "How do you want to work?", sub: "Work style and job type." },
  { icon: Flag, title: "What do you want help with?", sub: "Pick all that apply." },
  { icon: CalendarClock, title: "When do you want to land the job?", sub: "Last one!" },
];

function Tile({ icon: Icon, title, sub, selected, onClick, compact = false }) {
  return (
    <motion.button type="button" onClick={onClick} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
      className={`relative text-left rounded-xl border-2 transition-colors ${compact ? "p-3" : "p-3.5"} ${selected ? "border-[#A47E3B] bg-[#FBF6EC] shadow-sm" : "border-[#E3E8EF] bg-white hover:border-[#D8B873]"}`}>
      <span className={`grid place-items-center rounded-lg ${compact ? "w-8 h-8" : "w-10 h-10"} ${selected ? "bg-[#A47E3B] text-white" : "bg-[#F3F5F7] text-[#5B6B7F]"} transition-colors`}>
        <Icon size={compact ? 17 : 20} />
      </span>
      <p className="mt-2 text-sm font-semibold text-[#1B2A41] leading-tight">{title}</p>
      {sub && <p className="text-xs text-[#5B6B7F] mt-0.5">{sub}</p>}
      {selected && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 grid place-items-center w-5 h-5 rounded-full bg-[#1E7A3C] text-white">
          <Check size={12} strokeWidth={3} />
        </motion.span>
      )}
    </motion.button>
  );
}

function OnboardingModal({ initial, canClose, onClose, onDone }) {
  const saved = initial.career_goal || {};
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [role, setRole] = useState(initial.target_role || "");
  const [level, setLevel] = useState(initial.experience_level || "");
  const [fields, setFields] = useState(saved.fields || []);
  const [mode, setMode] = useState(saved.work_mode || "");
  const [jobType, setJobType] = useState(saved.job_type || "");
  const [goals, setGoals] = useState(saved.goals || []);
  const [timeline, setTimeline] = useState(saved.timeline || "");
  const [busy, setBusy] = useState(false);
  const TOTAL = STEPS.length;

  const toggle = (list, setList, id, max = 99) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : list.length >= max ? [...list.slice(1), id] : [...list, id]);

  const valid = [
    role.trim().length >= 2, Boolean(level), fields.length > 0, Boolean(mode && jobType), goals.length > 0, Boolean(timeline),
  ][step - 1];

  const go = (n) => { setDir(n > step ? 1 : -1); setStep(n); };

  const submit = async (skip = false) => {
    setBusy(true);
    try {
      const { data } = await api.post("/dashboard/onboarding/", skip ? { skip: true } : { target_role: role.trim(), experience_level: level, fields, work_mode: mode, job_type: jobType, goals, timeline });
      onDone(data, skip);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const S = STEPS[step - 1];
  const HeadIcon = S.icon;

  return (
    <div className="fixed inset-0 z-[90] bg-[#1B2A41]/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-white w-full h-[100dvh] sm:h-auto sm:max-w-lg rounded-none sm:rounded-3xl shadow-2xl sm:max-h-[94vh] flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0">
        {/* header: progress */}
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wider uppercase text-[#A47E3B]">Step {step} of {TOTAL}</p>
            <p className="text-xs text-[#9AA6B2]">{Math.round((step / TOTAL) * 100)}%</p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-[#E3E8EF] overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-[#A47E3B] to-[#D8B873]" animate={{ width: `${(step / TOTAL) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          </div>
          <div className="mt-3 flex justify-between">
            {STEPS.map((s, k) => {
              const I = s.icon; const n = k + 1;
              return (
                <button key={k} type="button" onClick={() => n < step && go(n)} aria-label={`Step ${n}`}
                  className={`grid place-items-center w-8 h-8 rounded-full transition-colors ${n < step ? "bg-[#1E7A3C] text-white cursor-pointer" : n === step ? "bg-[#1B2A41] text-[#D8B873]" : "bg-[#F3F5F7] text-[#B4BEC9]"}`}>
                  {n < step ? <Check size={15} strokeWidth={3} /> : <I size={15} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* body */}
        <div className="px-6 pt-5 pb-2 overflow-y-auto flex-1">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir}
              initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }} transition={{ duration: 0.22 }}>
              <div className="flex items-start gap-3">
                <motion.span initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} className="grid place-items-center w-12 h-12 shrink-0 rounded-2xl bg-[#F6EEDD] text-[#A47E3B]">
                  <HeadIcon size={24} />
                </motion.span>
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl text-[#1B2A41] leading-snug">{S.title}</h2>
                  <p className="text-sm text-[#5B6B7F] mt-0.5">{S.sub}</p>
                </div>
              </div>

              <div className="mt-5">
                {step === 1 && (
                  <>
                    <div className="grid grid-cols-2 gap-2.5">
                      {ROLE_CARDS.map((r) => <Tile compact key={r.id} icon={r.icon} title={r.id} selected={role === r.id} onClick={() => setRole(r.id)} />)}
                      <div className="relative col-span-2 sm:col-span-1">
                        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA6B2]" />
                        <input value={ROLE_CARDS.some((r) => r.id === role) ? "" : role} onChange={(e) => setRole(e.target.value)} maxLength={150}
                          onKeyDown={(e) => e.key === "Enter" && valid && go(2)} placeholder="Or type your own role"
                          className="w-full h-full min-h-[64px] border-2 border-[#E3E8EF] focus:border-[#A47E3B] outline-none rounded-xl pl-9 pr-3 text-sm transition-colors" />
                      </div>
                    </div>
                  </>
                )}
                {step === 2 && (
                  <div className="grid grid-cols-2 gap-3">
                    {LEVELS.map((l) => <Tile key={l.id} icon={LEVEL_ICONS[l.id]} title={l.title} sub={l.sub} selected={level === l.id} onClick={() => setLevel(l.id)} />)}
                  </div>
                )}
                {step === 3 && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {FIELDS.map((f) => <Tile compact key={f.id} icon={f.icon} title={f.id} selected={fields.includes(f.id)} onClick={() => toggle(fields, setFields, f.id, 3)} />)}
                  </div>
                )}
                {step === 4 && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#9AA6B2] mb-2">Where</p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {WORK_MODES.map((m) => <Tile compact key={m.id} icon={m.icon} title={m.id} sub={m.sub} selected={mode === m.id} onClick={() => setMode(m.id)} />)}
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#9AA6B2] mt-4 mb-2">Job type</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {JOB_TYPES.map((j) => <Tile compact key={j.id} icon={j.icon} title={j.id} selected={jobType === j.id} onClick={() => setJobType(j.id)} />)}
                    </div>
                  </>
                )}
                {step === 5 && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {GOALS.map((g) => <Tile compact key={g.id} icon={g.icon} title={g.id} selected={goals.includes(g.id)} onClick={() => toggle(goals, setGoals, g.id)} />)}
                  </div>
                )}
                {step === 6 && (
                  <div className="grid grid-cols-2 gap-3">
                    {TIMELINES.map((t) => <Tile key={t.id} icon={t.icon} title={t.id} sub={t.sub} selected={timeline === t.id} onClick={() => setTimeline(t.id)} />)}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-[#EEF1F4] flex items-center justify-between gap-3">
          <button onClick={() => (canClose ? onClose() : submit(true))} disabled={busy} className="text-sm text-[#5B6B7F] underline min-h-[44px]">
            {canClose ? "Cancel" : "Skip for now"}
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => go(step - 1)} disabled={busy} className="inline-flex items-center gap-1 text-sm font-medium text-[#1B2A41] border border-[#DDE3E8] hover:bg-[#F3F5F7] rounded-xl px-4 py-2.5 min-h-[44px]">
                <ChevronLeft size={16} />Back
              </button>
            )}
            {step < TOTAL ? (
              <button onClick={() => go(step + 1)} disabled={!valid} className="db-cta inline-flex items-center gap-1 text-sm font-semibold text-white bg-[#1B2A41] rounded-xl px-5 py-2.5 min-h-[44px] disabled:opacity-40">
                Next<ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={() => submit(false)} disabled={busy || !valid} className="db-cta inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-[#A47E3B] to-[#C29A4F] rounded-xl px-5 py-2.5 min-h-[44px] disabled:opacity-40">
                <Sparkles size={16} />{busy ? "Saving…" : "Finish"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const SPLASH_CSS = `
@keyframes wsLetter { from { opacity: 0; transform: translateY(22px); filter: blur(6px); } to { opacity: 1; transform: none; filter: blur(0); } }
@keyframes wsFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes wsSweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(260%); } }
@keyframes wsDot { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
.ws-letter { display: inline-block; opacity: 0; animation: wsLetter 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.ws-fade { opacity: 0; animation: wsFade 0.6s ease-out forwards; }
.ws-sweep { animation: wsSweep 1.4s ease-in-out infinite; }
.ws-dot { animation: wsDot 1.2s infinite; }
@media (prefers-reduced-motion: reduce) {
  .ws-letter, .ws-fade { animation: none; opacity: 1; filter: none; transform: none; }
  .ws-sweep, .ws-dot { animation: none; }
}
`;

function SplitText({ text, start = 0, step = 55 }) {
  return (
    <>
      {[...text].map((ch, i) => (
        <span key={i} className="ws-letter" style={{ animationDelay: `${start + i * step}ms` }} aria-hidden="true">
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </>
  );
}

const SPLASH_MESSAGES = [
  "Preparing your dashboard",
  "Checking your CV progress",
  "Loading your ATS score",
  "Almost ready",
];
const SPLASH_MIN_MS = 5000; // the welcome screen stays at least this long

// Full name from the user record. Signup copies the first name into last_name when only one
// word was given, so skip the last name if it just repeats the first.
function displayName(user) {
  const first = (user?.first_name || "").trim();
  const last = (user?.last_name || "").trim();
  const full = last && last.toLowerCase() !== first.toLowerCase() ? `${first} ${last}` : first;
  return full.trim() || (user?.full_name || user?.name || "").trim();
}

// Shown on the very first load (nothing cached yet) instead of a blank skeleton.
function WelcomeSplash({ name }) {
  const clean = (name || "").trim();
  const label = clean && !clean.includes("@") ? clean : "dear"; // an email in the name field -> "Welcome dear"
  const [msg, setMsg] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setMsg((m) => Math.min(m + 1, SPLASH_MESSAGES.length - 1)), 1250);
    return () => clearInterval(t);
  }, []);

  const nameStep = Math.max(25, Math.min(55, Math.round(1000 / label.length)));
  const nameSize = label.length > 18 ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center" role="status" aria-live="polite">
      <style>{SPLASH_CSS}</style>
      <span className="sr-only">Welcome {label}. Preparing your dashboard.</span>

      <p className="ws-fade text-xs font-semibold uppercase tracking-[0.3em] text-[#0F766E]" style={{ animationDelay: "0ms" }}>
        CV Builder
      </p>

      <h1 className="mt-4 font-serif text-5xl font-medium tracking-tight text-[#1B1F27] sm:text-6xl">
        <SplitText text="Welcome" start={150} />
      </h1>

      <p className={`mt-2 max-w-full break-words font-serif text-[#0F766E] ${nameSize}`}>
        <SplitText text={label} start={150 + 7 * 55 + 150} step={nameStep} />
      </p>

      <div className="ws-fade mt-8 h-1 w-48 overflow-hidden rounded-full bg-stone-200" style={{ animationDelay: "900ms" }}>
        <div className="ws-sweep h-full w-1/3 rounded-full bg-[#0F766E]" />
      </div>

      <p key={msg} className="ws-fade mt-4 text-sm text-[#6B7280]" style={{ animationDelay: msg === 0 ? "1100ms" : "0ms" }}>
        {SPLASH_MESSAGES[msg]}
        <span className="ws-dot" style={{ animationDelay: "0s" }}>.</span>
        <span className="ws-dot" style={{ animationDelay: "0.2s" }}>.</span>
        <span className="ws-dot" style={{ animationDelay: "0.4s" }}>.</span>
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cacheKey = `${user?.email || ""}:dashboard`;
  const [data, setData] = useState(() => cacheGet(cacheKey) || null);
  const [error, setError] = useState(null);
  const [showOb, setShowOb] = useState(false);
  const [barsReady, setBarsReady] = useState(() => Boolean(cacheGet(cacheKey)));
  const [splashDone, setSplashDone] = useState(() => Boolean(cacheGet(cacheKey)));

  // First load only: keep the welcome screen up for at least SPLASH_MIN_MS.
  useEffect(() => {
    if (splashDone) return;
    const t = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  const load = () => {
    setError(null);
    api.get("/dashboard/")
      .then((res) => {
        setData(res.data);
        cacheSet(cacheKey, res.data);
        if (res.data.onboarding.needed) setShowOb(true);
      })
      .catch((err) => {
        if (!cacheGet(cacheKey)) setError({ status: err.response?.status || 0 }); // keep showing cached data if a refresh fails
      });
  };
  useEffect(() => { load(); }, []);

  const view = splashDone ? data : null; // what the page is allowed to show yet

  // Start the bar animations once the dashboard is actually revealed.
  useEffect(() => {
    if (!splashDone || !data || barsReady) return;
    const t = setTimeout(() => setBarsReady(true), 150);
    return () => clearTimeout(t);
  }, [splashDone, data, barsReady]);

  const pct = useCountUp(view?.completeness.percent || 0);
  const atsNum = useCountUp(view?.ats.latest?.score || 0);

  if (error) return <LoadError status={error.status} what="your dashboard" onRetry={load} />;
  if (!view) return (<div className="fixed inset-0 z-[70] overflow-y-auto bg-[#F3F5F7]"><style>{CSS}</style><WelcomeSplash name={displayName(user)} /></div>);

  const { onboarding, completeness, ats, versions, next_step: next, checklist } = data;
  const level = LEVELS.find((l) => l.id === onboarding.experience_level);
  const doneCount = checklist.filter((c) => c.done).length;
  const latest = ats.latest;

  return (
    <div className="min-h-screen bg-[#F3F5F7] text-[#1B2A41]">
      <style>{CSS}</style>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
        <header className="db-up">
          <p className="text-sm text-[#5B6B7F]">Dashboard</p>
          <h1 className="font-serif text-2xl sm:text-3xl">Welcome back, {data.name.split(" ")[0]}</h1>
          {(onboarding.target_role || level) && (
            <p className="mt-1 text-sm text-[#5B6B7F]">
              Aiming for <b className="text-[#1B2A41]">{onboarding.target_role || "a new role"}</b>
              {level && <> · {level.title} ({level.sub})</>}
              <button onClick={() => setShowOb(true)} className="ml-2 underline text-[#8A6529]">Change</button>
            </p>
          )}
        </header>

        <section className="db-up rounded-xl bg-[#1B2A41] text-white p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ animationDelay: "80ms" }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D8B873]">Your next step</p>
            <h2 className="font-serif text-xl sm:text-2xl mt-1">{next.title}</h2>
            <p className="text-sm text-white/75 mt-1 max-w-xl">{next.text}</p>
          </div>
          <button onClick={() => navigate(next.to)} className="db-cta shrink-0 text-sm font-semibold text-[#1B2A41] bg-[#D8B873] hover:bg-[#E3C98F] rounded-md px-6 py-3 min-h-[44px]">
            {next.cta} →
          </button>
        </section>

        <section>
          <h2 className="font-serif text-lg mb-3">What would you like to do?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ACTIONS.map((a, i) => (
              <ActionCard key={a.title} a={a} i={i} onClick={() => (a.to ? navigate(a.to) : setShowOb(true))} />
            ))}
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-5">
          <Card i={2}>
            <h3 className="font-serif text-lg">Profile completeness</h3>
            <div className="mt-4 flex items-center gap-5">
              <Ring value={completeness.percent} color={scoreColor(completeness.percent)}>
                <span className="text-3xl font-bold leading-none">{pct}<span className="text-base font-normal">%</span></span>
              </Ring>
              <ul className="flex-1 min-w-0 space-y-2">
                {completeness.sections.map((s) => (
                  <li key={s.key} className="flex items-start gap-2.5">
                    <Tick done={s.done} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-5">{s.label}</p>
                      <p className="text-xs text-[#5B6B7F] truncate">{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <Link to="/profile" className="mt-4 inline-block text-sm font-medium text-[#8A6529] underline">Edit my CV →</Link>
          </Card>

          <Card i={3}>
            <h3 className="font-serif text-lg">Latest ATS score</h3>
            {latest ? (
              <>
                <div className="mt-4 flex items-center gap-5">
                  <Ring value={latest.score} color={scoreColor(latest.score)}>
                    <span className="text-3xl font-bold leading-none">{atsNum}</span>
                    <span className="text-[11px] text-[#5B6B7F]">/100</span>
                  </Ring>
                  <div className="min-w-0">
                    <p className="text-base font-semibold" style={{ color: scoreColor(latest.score) }}>{latest.grade}</p>
                    <p className="text-sm truncate">{latest.job_title || "Untitled job"}</p>
                    <p className="text-xs text-[#5B6B7F] mt-0.5">{fmtDate(latest.date)} · {ats.count} job{ats.count === 1 ? "" : "s"} checked</p>
                  </div>
                </div>
                {ats.history.length > 1 && (
                  <div className="mt-4">
                    <p className="text-xs text-[#5B6B7F] mb-1">Recent checks</p>
                    <div className="flex items-end gap-1.5 h-12">
                      {ats.history.map((h, idx) => (
                        <div key={idx} title={`${h.job_title || "Untitled"}: ${h.score}`} className="flex-1 rounded-t"
                          style={{ height: barsReady ? `${Math.max(8, h.score)}%` : "4%", background: scoreColor(h.score), transition: `height .7s ease-out ${idx * 80}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm text-[#5B6B7F]">You haven't checked your CV against a job yet. Paste a job description to get your first score.</p>
            )}
            <Link to="/ats" className="mt-4 inline-block text-sm font-medium text-[#8A6529] underline">{latest ? "Check another job →" : "Check a job →"}</Link>
          </Card>

          <Card i={4}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg">Getting started</h3>
              <span className="text-xs font-semibold text-[#5B6B7F]">{doneCount}/{checklist.length}</span>
            </div>
            <div className="mt-3 h-1.5 bg-[#E3E8EF] rounded-full overflow-hidden">
              <div className="h-full bg-[#1E7A3C] rounded-full" style={{ width: barsReady ? `${(100 * doneCount) / checklist.length}%` : "0%", transition: "width .9s ease-out" }} />
            </div>
            <ul className="mt-3 space-y-1">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link to={c.to} className="flex items-center gap-2.5 rounded-md px-1.5 py-2 hover:bg-[#F3F5F7] transition min-h-[40px]">
                    <Tick done={c.done} />
                    <span className={`text-sm ${c.done ? "text-[#5B6B7F] line-through" : ""}`}>{c.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card i={5}>
            <h3 className="font-serif text-lg">Saved CVs</h3>
            {versions.count > 0 ? (
              <div className="mt-3">
                <p className="text-3xl font-bold leading-none">{versions.count}</p>
                <p className="text-sm text-[#5B6B7F] mt-1">saved version{versions.count === 1 ? "" : "s"}</p>
                {versions.latest && (
                  <div className="mt-3 rounded-lg bg-[#F3F5F7] px-3 py-2">
                    <p className="text-xs text-[#5B6B7F]">Most recent</p>
                    <p className="text-sm font-medium truncate">{versions.latest.name}</p>
                    <p className="text-xs text-[#5B6B7F]">{fmtDate(versions.latest.created_at)}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#5B6B7F]">Nothing saved yet. Save a copy of your CV to keep it, and come back to it any time.</p>
            )}
            <Link to="/versions" className="mt-4 inline-block text-sm font-medium text-[#8A6529] underline">{versions.count > 0 ? "Manage saved CVs →" : "Save my CV →"}</Link>
          </Card>
        </div>
      </main>

      {showOb && (
        <OnboardingModal
          initial={onboarding}
          canClose={!onboarding.needed}
          onClose={() => setShowOb(false)}
          onDone={(d, skipped) => {
            setData(d);
            cacheSet(cacheKey, d);
            setShowOb(false);
            if (skipped) toast.success("You can set your goal any time from the dashboard");
          }}
        />
      )}
    </div>
  );
}
