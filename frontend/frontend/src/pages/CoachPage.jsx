import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, AudioLines, Briefcase, Check, Copy, FilePen, FileText, Languages, Lightbulb, Mic, MicOff, MessageSquareText, PhoneOff, RotateCcw, Sparkles, Target } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { cacheGet, cacheSet, cacheClearSuffix } from "../lib/cache";
import { clearJobsCache } from "../utils/jobsCache";
import { startLive } from "../lib/liveVoice";

const STARTERS = [
  { t: "How well do I fit this role?", icon: Target },
  { t: "What skills am I missing?", icon: Lightbulb },
  { t: "Improve my CV headline", icon: FileText },
  { t: "Give me a mock interview question", icon: MessageSquareText },
];

const LANGS = [
  { v: "auto", l: "Auto (match my language)" },
  { v: "en", l: "English" },
  { v: "ur", l: "اردو (Urdu)" },
  { v: "roman-ur", l: "Roman Urdu" },
  { v: "ar", l: "العربية (Arabic)" },
  { v: "hi", l: "हिन्दी (Hindi)" },
];
const readLang = () => { try { return localStorage.getItem("coachLang") || "auto"; } catch { return "auto"; } };
const MAX_MSGS = 60;

const CSS = `
@keyframes coachIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes coachFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes coachDot { 0%,80%,100% { transform: translateY(0); opacity: .35; } 40% { transform: translateY(-5px); opacity: 1; } }
@keyframes coachBreath { 0%,100% { transform: scale(1); opacity: .5; } 50% { transform: scale(1.12); opacity: .85; } }
@keyframes coachBar { 0%,100% { transform: scaleY(.35); } 50% { transform: scaleY(1); } }
@keyframes coachSlide { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes coachGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(164,126,59,.35); } 50% { box-shadow: 0 0 0 6px rgba(164,126,59,0); } }
.coach-in { animation: coachIn .35s cubic-bezier(.2,.8,.2,1) both; }
.coach-slide { animation: coachSlide .4s cubic-bezier(.2,.8,.2,1) both; }
.coach-float { animation: coachFloat 4s ease-in-out infinite; }
.coach-dot { animation: coachDot 1.2s ease-in-out infinite; }
.coach-breath { animation: coachBreath 2.6s ease-in-out infinite; }
.coach-bar { animation: coachBar 1s ease-in-out infinite; transform-origin: center; }
.coach-live { animation: coachGlow 1.6s ease-in-out infinite; }
.coach-scroll::-webkit-scrollbar { width: 8px; } .coach-scroll::-webkit-scrollbar-thumb { background: #E3E8EF; border-radius: 8px; }
.coach-dots { background-image: radial-gradient(#E3E8EF 1px, transparent 1px); background-size: 18px 18px; }
@media (prefers-reduced-motion: reduce) { .coach-in,.coach-slide,.coach-float,.coach-dot,.coach-breath,.coach-bar,.coach-live { animation: none !important; } }
`;

export default function CoachPage() {
  const { state } = useLocation();
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(state?.job?.id ? String(state.job.id) : "");
  const [chatJobs, setChatJobs] = useState([]); // jobs that already have a saved conversation
  const [lang, setLang] = useState(readLang);
  const keyOf = (id) => `${user?.email || ""}:coach:${id || 0}`;
  const [msgs, setMsgs] = useState(() => cacheGet(keyOf(jobId)) || []);
  const [loadingChat, setLoadingChat] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const endRef = useRef(null);
  const scrollRef = useRef(null);
  const loadId = useRef(0);
  const taRef = useRef(null);
  const [voice, setVoice] = useState("idle"); // idle | connecting | listening | speaking
  const [muted, setMuted] = useState(false);
  const [caption, setCaption] = useState({ u: "", c: "" });
  const ctrl = useRef(null);

  useEffect(() => {
    document.title = "AI Coach | CV Builder";
    api.get("/jobs/tracker/").then((r) => setJobs(r.data.map((t) => t.job))).catch(() => {});
    api.get("/jobs/coach/chats/").then((r) => setChatJobs(r.data.map((c) => c.job))).catch(() => {});
  }, []);

  // load the saved conversation for the selected job (cached copy shows instantly)
  useEffect(() => {
    const id = ++loadId.current;
    const cached = cacheGet(keyOf(jobId));
    setMsgs(cached || []);
    setLoadingChat(!cached);
    api.get("/jobs/coach/chat/", { params: jobId ? { job_id: jobId } : {} })
      .then((r) => { if (id !== loadId.current) return; cacheSet(keyOf(jobId), r.data.messages); setMsgs(r.data.messages); })
      .catch(() => {})
      .finally(() => { if (id === loadId.current) setLoadingChat(false); });
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const endVoice = () => { ctrl.current?.stop(); ctrl.current = null; setCaption({ u: "", c: "" }); setMuted(false); };
  useEffect(() => endVoice, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const chatIds = new Set(chatJobs.map((j) => j.id));
  const others = [state?.job, ...jobs].filter((j, i, a) => j && !chatIds.has(j.id) && a.findIndex((x) => x?.id === j.id) === i);
  const selected = [...chatJobs, ...others].find((j) => String(j.id) === jobId);
  const inVoice = voice !== "idle";
  const pick = (id) => { if (!busy && !inVoice) setJobId(String(id)); };

  const toggleVoice = async () => {
    if (voice !== "idle") return endVoice();
    const k = keyOf(jobId);
    ctrl.current = await startLive({
      jobId, language: lang,
      onState: setVoice,
      onCaption: (u, c) => setCaption({ u, c }),
      onSync: (messages) => { cacheSet(k, messages); setMsgs(messages); if (jobId && selected && !chatIds.has(selected.id)) setChatJobs((c) => [...c, selected]); },
      onProfile: (p) => { // CV edited by voice: refresh the other pages' caches like the Apply button does
        cacheSet(`${user?.email || ""}:profile`, p); cacheClearSuffix(":dashboard", ":versions"); clearJobsCache(); toast.success("CV updated by voice");
      },
      onError: (e) => toast.error(e?.name === "NotAllowedError" ? "Microphone permission denied" : e?.response?.data?.detail || "Voice is unavailable. Try again."),
    });
  };
  const toggleMute = () => { const v = !muted; setMuted(v); ctrl.current?.setMuted(v); };

  const changeLang = (v) => { setLang(v); try { localStorage.setItem("coachLang", v); } catch { /* ignore */ } };

  const nearBottom = () => { const el = scrollRef.current; return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120; };
  const jump = () => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  useEffect(() => { if (nearBottom() || msgs[msgs.length - 1]?.role === "user") jump(); }, [msgs, busy, voice, caption]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    const k = keyOf(jobId);
    const base = cacheGet(k) || [];
    const withUser = [...base, { role: "user", text: message }].slice(-MAX_MSGS);
    cacheSet(k, withUser);
    setMsgs(withUser);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setBusy(true);
    try {
      const { data } = await api.post("/jobs/coach/", { message, job_id: jobId || undefined, language: lang });
      const done = [...withUser, { ...data, role: "coach" }].slice(-MAX_MSGS);
      cacheSet(k, done);
      setMsgs(done);
      if (jobId && selected && !chatIds.has(selected.id)) setChatJobs((c) => [...c, selected]);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Coach is unavailable. Try again.");
      cacheSet(k, base);
      setMsgs(base);
      setInput(message);
    } finally {
      setBusy(false);
    }
  };

  const newChat = async () => {
    if (!window.confirm("Clear this conversation? This can't be undone.")) return;
    try {
      await api.delete("/jobs/coach/chat/", { params: jobId ? { job_id: jobId } : {} });
      cacheSet(keyOf(jobId), []);
      setMsgs([]);
      if (jobId) setChatJobs((c) => c.filter((j) => String(j.id) !== jobId));
    } catch { toast.error("Couldn't clear the chat"); }
  };

  const setChangeState = (mi, ci, st) => {
    setMsgs((m) => {
      const next = m.map((x, i) => (i !== mi ? x : { ...x, changes: x.changes.map((c, j) => (j === ci ? { ...c, state: st } : c)) }));
      cacheSet(keyOf(jobId), next);
      return next;
    });
    if (st === "applied" || st === "dismissed") { // remember it, so the card doesn't come back after a refresh
      const id = msgs[mi]?.id;
      if (id) api.patch("/jobs/coach/chat/", { job_id: jobId || undefined, message_id: id, change_index: ci, state: st }).catch(() => {});
    }
  };

  const applyChange = async (mi, ci) => {
    const { state: _s, ...change } = msgs[mi].changes[ci];
    setChangeState(mi, ci, "applying");
    try {
      const { data } = await api.post("/jobs/coach/apply/", { change });
      cacheSet(`${user?.email || ""}:profile`, data.profile); // My CV / ATS pages show the edit instantly
      cacheClearSuffix(":dashboard", ":versions");
      clearJobsCache(); // match scores change with the CV
      setChangeState(mi, ci, "applied");
      toast.success(data.message);
    } catch (e) {
      setChangeState(mi, ci, "idle");
      toast.error(e.response?.data?.detail || "Couldn't apply the change");
    }
  };

  const last = msgs.length - 1;
  const title = selected ? selected.title : "General coaching";
  const sub = selected ? selected.company : "Not tied to a specific job";

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-6xl gap-4 px-3 py-4 sm:px-6 sm:py-5">
      <style>{CSS}</style>

      {/* Conversations sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-[#E3E8EF] bg-white shadow-sm lg:flex">
        <div className="border-b border-[#EEF1F5] px-4 py-4">
          <p className="font-serif text-lg font-medium text-[#1B2A41]">Conversations</p>
          <p className="text-xs text-[#5B6B7F]">Saved automatically, voice and text together</p>
        </div>
        <nav className="coach-scroll flex-1 space-y-1 overflow-y-auto p-2">
          <SideItem active={jobId === ""} icon={Sparkles} title="General coaching" sub="Not tied to a job" onClick={() => pick("")} />
          {chatJobs.length > 0 && <SideLabel>Job conversations</SideLabel>}
          {chatJobs.map((j) => <SideItem key={j.id} active={jobId === String(j.id)} icon={Briefcase} title={j.title} sub={j.company} onClick={() => pick(j.id)} />)}
          {others.length > 0 && <SideLabel>Start a new one</SideLabel>}
          {others.slice(0, 10).map((j) => <SideItem key={j.id} muted active={jobId === String(j.id)} icon={Briefcase} title={j.title} sub={j.company} onClick={() => pick(j.id)} />)}
        </nav>
      </aside>

      {/* Chat card */}
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E3E8EF] bg-white shadow-sm">
        {/* Top bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF1F5] bg-white/90 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#1B2A41] to-[#2C4268] text-[#E8C987] shadow-md shadow-[#1B2A41]/20">
              <Sparkles size={20} />
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-lg font-medium leading-tight text-[#1B2A41]">{title}</h1>
              <p className="truncate text-xs text-[#5B6B7F]">{sub} · AI career coach · online</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="lg:hidden">
              <Select icon={Briefcase} value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={busy || inVoice} label="Job context" wide>
                <option value="">General coaching</option>
                {chatJobs.length > 0 && <optgroup label="Your conversations">{chatJobs.map((j) => <option key={j.id} value={j.id}>{j.title} · {j.company}</option>)}</optgroup>}
                {others.length > 0 && <optgroup label="Other jobs">{others.map((j) => <option key={j.id} value={j.id}>{j.title} · {j.company}</option>)}</optgroup>}
              </Select>
            </span>
            <Select icon={Languages} value={lang} onChange={(e) => changeLang(e.target.value)} label="Reply language">
              {LANGS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
            </Select>
            {msgs.length > 0 && (
              <button onClick={newChat} disabled={busy || inVoice} title="Clear this conversation" aria-label="Clear conversation"
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#E3E8EF] bg-white text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                <RotateCcw size={15} />
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} onScroll={() => setShowJump(!nearBottom())} className="coach-scroll coach-dots min-h-0 flex-1 overflow-y-auto bg-[#FBFAF7] px-4 py-5 sm:px-6" aria-live="polite">
          {loadingChat && !msgs.length && <div className="space-y-3">{[60, 40, 50].map((w, i) => <div key={i} className="job-skel h-11 rounded-2xl" style={{ width: `${w}%` }} />)}</div>}

          {!msgs.length && !loadingChat && !inVoice && (
            <div className="grid min-h-full place-items-center py-6 text-center">
              <div className="coach-slide w-full max-w-xl">
                <span className="coach-float mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#1B2A41] to-[#2C4268] text-[#E8C987] shadow-lg shadow-[#1B2A41]/25">
                  <AudioLines size={28} />
                </span>
                <h2 className="mt-4 font-serif text-2xl font-medium text-[#1B2A41]">How can I help your job search today?</h2>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-[#5B6B7F]">Ask about your fit for a role, get your CV improved, or tap Voice and just talk. Everything stays in one conversation.</p>
                <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {STARTERS.map(({ t, icon: Icon }, i) => (
                    <button key={t} onClick={() => send(t)} style={{ animationDelay: `${120 + i * 70}ms` }}
                      className="coach-slide group flex items-center gap-3 rounded-xl border border-[#E3E8EF] bg-white p-3.5 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#A47E3B] hover:shadow-md">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F6EEDD] text-[#A47E3B] transition group-hover:bg-[#A47E3B] group-hover:text-white"><Icon size={17} /></span>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {msgs.map((m, mi) => {
            const mine = m.role === "user";
            const first = mi === 0 || msgs[mi - 1].role !== m.role;
            return (
              <div key={m.id || mi} className={`coach-in group flex gap-2.5 ${mine ? "flex-row-reverse" : ""} ${mi === 0 ? "" : first ? "mt-5" : "mt-1.5"}`}>
                {!mine && (first
                  ? <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#1B2A41] to-[#2C4268] text-[#E8C987]"><Sparkles size={15} /></span>
                  : <span className="w-8 shrink-0" />)}
                <div className={`flex min-w-0 max-w-[85%] flex-col gap-2 ${mine ? "items-end" : "items-start"}`}>
                  {first && <p className="px-1 text-[11px] font-medium text-slate-400">{mine ? "You" : "Coach"}{m.voice ? " · voice" : ""}</p>}
                  <div className={`flex items-center gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
                    <div dir="auto" className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${mine ? "rounded-tr-md bg-gradient-to-br from-[#1B2A41] to-[#2C4268] text-white" : "rounded-tl-md border border-[#E3E8EF] bg-white text-slate-800"}`}>
                      {m.voice && <AudioLines size={13} className={`mr-1.5 inline -translate-y-px ${mine ? "text-[#E8C987]" : "text-[#A47E3B]"}`} aria-label="Voice message" />}
                      <RichText text={m.text} />
                    </div>
                    {!mine && m.text && <CopyBtn text={m.text} />}
                  </div>
                  {m.changes?.map((c, ci) => (
                    <ChangeCard key={ci} c={c} onApply={() => applyChange(mi, ci)} onDismiss={() => setChangeState(mi, ci, "dismissed")} />
                  ))}
                  {mi === last && m.role === "coach" && !busy && !inVoice && m.suggestions?.length > 0 && <Chips items={m.suggestions} onPick={send} />}
                </div>
              </div>
            );
          })}

          {/* live voice captions appear in the chat as they are spoken */}
          {inVoice && caption.u && (
            <div className="coach-in mt-4 flex flex-row-reverse gap-2.5">
              <div dir="auto" className="coach-live max-w-[85%] rounded-2xl rounded-tr-md border border-dashed border-[#A47E3B]/60 bg-[#FBF6EC] px-4 py-2.5 text-sm text-[#1B2A41]">
                <AudioLines size={13} className="mr-1.5 inline -translate-y-px text-[#A47E3B]" />{caption.u}
              </div>
            </div>
          )}
          {inVoice && caption.c && (
            <div className="coach-in mt-3 flex gap-2.5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#1B2A41] to-[#2C4268] text-[#E8C987]"><Sparkles size={15} /></span>
              <div dir="auto" className="max-w-[85%] rounded-2xl rounded-tl-md border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                <AudioLines size={13} className="mr-1.5 inline -translate-y-px text-[#A47E3B]" />{caption.c}
              </div>
            </div>
          )}

          {busy && (
            <div className="coach-in mt-4 flex items-center gap-2.5" aria-label="Coach is typing">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#1B2A41] to-[#2C4268] text-[#E8C987]"><Sparkles size={15} /></span>
              <span className="flex gap-1.5 rounded-2xl rounded-tl-md border border-[#E3E8EF] bg-white px-4 py-3.5 shadow-sm">
                {[0, 1, 2].map((d) => <span key={d} className="coach-dot h-1.5 w-1.5 rounded-full bg-[#A47E3B]" style={{ animationDelay: `${d * 160}ms` }} />)}
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {showJump && (
          <button onClick={jump} aria-label="Scroll to latest" className="coach-in absolute bottom-28 right-5 z-10 grid h-9 w-9 place-items-center rounded-full border border-[#E3E8EF] bg-white text-[#1B2A41] shadow-lg transition hover:bg-[#FBF6EC]">
            <ArrowDown size={16} />
          </button>
        )}

        {/* Voice panel / composer */}
        <div className="border-t border-[#EEF1F5] bg-white p-3 sm:p-4">
          {inVoice ? (
            <div className="coach-slide flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#16233A] via-[#1B2A41] to-[#2C4268] p-4 text-white shadow-lg shadow-[#1B2A41]/25" aria-live="polite">
              <VoiceOrb ctrl={ctrl} state={voice} muted={muted} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#E8C987]">Live voice</p>
                <p className="mt-0.5 text-base font-medium">
                  {voice === "connecting" ? "Connecting…" : muted ? "Mic is muted" : voice === "speaking" ? "Coach is speaking" : "Listening, just talk"}
                </p>
                <p className="mt-1 text-sm text-white/70">{voice === "speaking" ? "Start talking any time to interrupt." : "Ask anything, or say “improve my headline”."}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={toggleMute} disabled={voice === "connecting"} aria-label={muted ? "Unmute" : "Mute"} title={muted ? "Unmute" : "Mute"}
                  className={`grid h-11 w-11 place-items-center rounded-full border transition ${muted ? "border-amber-300 bg-amber-300/20 text-amber-200" : "border-white/20 bg-white/10 text-white hover:bg-white/20"}`}>
                  {muted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button onClick={toggleVoice} aria-label="End voice chat" title="End voice chat"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-red-500 px-4 text-sm font-semibold text-white shadow-md shadow-red-900/30 transition hover:bg-red-600 active:scale-95">
                  <PhoneOff size={16} /> End
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex items-end gap-2 rounded-2xl border-2 border-[#E3E8EF] bg-white p-2 transition focus-within:border-[#A47E3B] focus-within:shadow-md">
              <button onClick={toggleVoice} aria-label="Start voice chat" title="Talk to your coach"
                className="group inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-br from-[#1B2A41] to-[#2C4268] px-3.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md hover:shadow-[#1B2A41]/25 active:scale-95">
                <AudioLines size={18} className="text-[#E8C987] transition group-hover:scale-110" />
                <span className="hidden sm:inline">Voice</span>
              </button>
              <textarea ref={taRef} dir="auto" value={input} rows={1} maxLength={1000} placeholder="Ask a question, or ask me to improve your CV… / اپنا سوال لکھیں"
                onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`; }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-base text-slate-800 outline-none placeholder:text-slate-400 sm:text-sm" />
              {input.length > 800 && <span className="absolute -top-5 right-2 text-[11px] text-slate-400">{input.length}/1000</span>}
              <button onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#A47E3B] text-white shadow-sm transition hover:bg-[#8F6C31] active:scale-95 disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none">
                <ArrowUp size={19} />
              </button>
            </div>
          )}
          <p className="mt-2 text-center text-[11px] text-slate-400">AI can make mistakes. CV edits apply only after you approve them, and your previous CV is auto-saved. <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line</span></p>
        </div>
      </section>
    </div>
  );
}

function SideLabel({ children }) {
  return <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">{children}</p>;
}

function SideItem({ icon: Icon, title, sub, active, muted, onClick }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5 text-left transition ${active ? "border-[#A47E3B] bg-[#FBF6EC]" : "border-transparent hover:bg-stone-50"}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-[#A47E3B] text-white" : muted ? "bg-stone-100 text-slate-400" : "bg-[#F6EEDD] text-[#A47E3B]"}`}><Icon size={15} /></span>
      <span className="min-w-0">
        <span className={`block truncate text-sm font-medium ${active ? "text-[#1B2A41]" : "text-slate-700"}`}>{title}</span>
        <span className="block truncate text-xs text-slate-400">{sub}</span>
      </span>
    </button>
  );
}

// Coach replies use short paragraphs and "-" bullets: render them as real paragraphs / lists.
function RichText({ text = "" }) {
  const blocks = [];
  String(text).split("\n").forEach((line) => {
    const b = line.match(/^\s*(?:[-*\u2022])\s+(.*)$/);
    const prev = blocks[blocks.length - 1];
    if (b) { if (prev?.list) prev.items.push(b[1]); else blocks.push({ list: true, items: [b[1]] }); }
    else if (line.trim()) blocks.push({ p: line });
  });
  if (!blocks.length) return null;
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => b.list
        ? <ul key={i} className="list-disc space-y-1 ps-5 marker:text-[#A47E3B]">{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul>
        : <p key={i}>{b.p}</p>)}
    </div>
  );
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch { toast.error("Couldn't copy"); }
  };
  return (
    <button onClick={copy} aria-label="Copy reply" title="Copy"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-300 opacity-0 transition hover:bg-white hover:text-[#1B2A41] focus:opacity-100 group-hover:opacity-100">
      {ok ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
    </button>
  );
}

function Select({ icon: Icon, label, wide, children, ...rest }) {
  return (
    <label className="relative">
      <Icon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A47E3B]" />
      <select aria-label={label} {...rest}
        className={`${wide ? "max-w-[13rem]" : ""} h-9 truncate rounded-xl border border-[#E3E8EF] bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition hover:border-[#A47E3B] focus:border-[#A47E3B] disabled:opacity-50`}>
        {children}
      </select>
    </label>
  );
}

// Animated orb: rings pulse with the real loudness of you (listening) or the coach (speaking).
function VoiceOrb({ ctrl, state, muted }) {
  const r1 = useRef(null), r2 = useRef(null), core = useRef(null);
  useEffect(() => {
    let raf, sm = 0;
    const tick = () => {
      const l = ctrl.current?.getLevels?.() || { mic: 0, out: 0 };
      const target = state === "speaking" ? l.out : state === "listening" && !muted ? l.mic : 0;
      sm += (target - sm) * 0.25;
      if (core.current) core.current.style.transform = `scale(${1 + sm * 0.2})`;
      if (r1.current) { r1.current.style.transform = `scale(${1.1 + sm * 0.55})`; r1.current.style.opacity = 0.3 + sm * 0.45; }
      if (r2.current) { r2.current.style.transform = `scale(${1.25 + sm * 0.95})`; r2.current.style.opacity = 0.14 + sm * 0.3; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ctrl, state, muted]);

  const tone = muted ? "from-slate-400 to-slate-500" : state === "speaking" ? "from-[#E8C987] to-[#A47E3B]" : state === "connecting" ? "from-slate-300 to-slate-400" : "from-emerald-300 to-emerald-500";
  const ring = muted ? "bg-slate-400" : state === "speaking" ? "bg-[#E8C987]" : "bg-emerald-400";
  return (
    <div className="relative grid h-24 w-24 shrink-0 place-items-center">
      <span ref={r2} className={`absolute inset-3 rounded-full ${ring} ${state === "connecting" ? "coach-breath" : ""}`} style={{ opacity: 0.15 }} />
      <span ref={r1} className={`absolute inset-3 rounded-full ${ring} ${state === "connecting" ? "coach-breath" : ""}`} style={{ opacity: 0.3 }} />
      <span ref={core} className={`relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br ${tone} text-[#1B2A41] shadow-lg transition-colors duration-500`}>
        {state === "speaking" ? (
          <span className="flex h-6 items-center gap-[3px]" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => <span key={i} className="coach-bar h-full w-[3px] rounded-full bg-[#1B2A41]" style={{ animationDelay: `${i * 110}ms` }} />)}
          </span>
        ) : <AudioLines size={26} />}
      </span>
    </div>
  );
}

function Chips({ items = [], onPick, center }) {
  return (
    <div className={`flex flex-wrap gap-2 ${center ? "justify-center" : ""}`}>
      {items.map((s, i) => (
        <button key={s} dir="auto" onClick={() => onPick(s)} style={{ animationDelay: `${i * 70}ms` }}
          className="coach-in rounded-full border border-[#E3E8EF] bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-[#A47E3B] hover:bg-[#FBF6EC] hover:text-[#1B2A41]">{s}</button>
      ))}
    </div>
  );
}

function ChangeCard({ c, onApply, onDismiss }) {
  if (c.state === "dismissed") return null;
  const applied = c.state === "applied";
  const title = { headline: "Update headline", summary: "Update summary", add_skills: "Add skills", add_bullet: `Add bullet to ${c.target_name || "entry"}` }[c.type];
  return (
    <div className={`coach-in w-full overflow-hidden rounded-xl border bg-white shadow-sm transition ${applied ? "border-emerald-200" : "border-[#E8DCC0]"}`}>
      <div className={`flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider ${applied ? "bg-emerald-50 text-emerald-700" : "bg-[#FBF6EC] text-[#A47E3B]"}`}>
        {applied ? <Check size={13} /> : <FilePen size={13} />} {applied ? "Applied" : "Suggested CV change"}
      </div>
      <div className="p-3.5">
        <p className="text-sm font-semibold text-[#1B2A41]">{title}</p>

        {(c.type === "headline" || c.type === "summary") && (
          <div className="mt-2 space-y-1.5 text-sm">
            {c.old && <p dir="auto" className="rounded-md bg-red-50/60 px-2.5 py-1.5 text-slate-500 line-through decoration-red-300">{c.old}</p>}
            <p dir="auto" className="whitespace-pre-wrap rounded-md bg-emerald-50/70 px-2.5 py-1.5 text-slate-800">{c.value}</p>
          </div>
        )}
        {c.type === "add_skills" && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.skills.map((s) => <span key={s} className="rounded-full bg-[#F6EEDD] px-2.5 py-0.5 text-xs font-medium text-[#1B2A41]">+ {s}</span>)}
          </div>
        )}
        {c.type === "add_bullet" && <p dir="auto" className="mt-2 rounded-md bg-emerald-50/70 px-2.5 py-1.5 text-sm text-slate-800">• {c.bullet}</p>}

        <div className="mt-3 flex items-center gap-2">
          {applied ? (
            <Link to="/profile" className="text-sm font-medium text-[#1B2A41] underline decoration-[#A47E3B] underline-offset-2">View my CV</Link>
          ) : (
            <>
              <button onClick={onApply} disabled={c.state === "applying"} className="rounded-lg bg-[#1B2A41] px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2C4268] active:scale-95 disabled:opacity-60">
                {c.state === "applying" ? "Applying…" : "Apply to my CV"}
              </button>
              <button onClick={onDismiss} disabled={c.state === "applying"} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-stone-100">Dismiss</button>
            </>
          )}
        </div>
        {applied && <p className="mt-2 text-[11px] text-slate-400">Your previous CV was auto-saved in Saved CVs, so you can restore it.</p>}
      </div>
    </div>
  );
}
