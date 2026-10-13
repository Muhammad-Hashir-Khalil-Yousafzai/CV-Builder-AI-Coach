import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Bookmark, KanbanSquare, BarChart3, FileText, MessageCircle, Trash2, ExternalLink } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { cacheGet, cacheSet } from "../lib/cache";
import CoverLetterModal from "../components/jobs/CoverLetterModal";

const STATUSES = [
  { v: "saved", l: "Saved", dot: "bg-slate-400" },
  { v: "applied", l: "Applied", dot: "bg-sky-500" },
  { v: "interview", l: "Interview", dot: "bg-amber-500" },
  { v: "offer", l: "Offer", dot: "bg-emerald-500" },
  { v: "rejected", l: "Rejected", dot: "bg-rose-400" },
];
const BOARD = STATUSES.filter((s) => s.v !== "saved");
const TABS = [
  { k: "saved", l: "Saved jobs", icon: Bookmark },
  { k: "board", l: "Tracker board", icon: KanbanSquare },
  { k: "stats", l: "Analytics", icon: BarChart3 },
];

export default function TrackerPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cacheKey = `${user?.email || ""}:tracker`;
  const [items, setItemsRaw] = useState(() => cacheGet(cacheKey) ?? null);
  const [error, setError] = useState(null);
  const setItems = (v) => setItemsRaw((cur) => { const next = typeof v === "function" ? v(cur) : v; cacheSet(cacheKey, next); return next; });
  const [tab, setTab] = useState("saved");
  const [stats, setStats] = useState(null);
  const [coverJob, setCoverJob] = useState(null);

  const load = () => {
    setError(null);
    api.get("/jobs/tracker/").then((r) => setItems(r.data)).catch((e) => { if (cacheGet(cacheKey) == null) setError(e.response?.status || 0); });
  };
  useEffect(() => { document.title = "Job Tracker | CV Builder"; load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === "stats") api.get("/jobs/tracker/stats/").then((r) => setStats(r.data)).catch(() => toast.error("Couldn't load analytics"));
  }, [tab]);

  const setStatus = async (item, status) => {
    if (item.status === status) return;
    const prev = items;
    setItems((l) => l.map((x) => (x.id === item.id ? { ...x, status } : x)));
    try { await api.patch(`/jobs/tracker/${item.id}/`, { status }); }
    catch { setItems(prev); toast.error("Couldn't update status"); }
  };
  const remove = async (item) => {
    const prev = items;
    setItems((l) => l.filter((x) => x.id !== item.id));
    try { await api.delete(`/jobs/tracker/${item.id}/`); }
    catch { setItems(prev); toast.error("Couldn't remove job"); }
  };
  const coach = (item) => navigate("/coach", { state: { job: item.job } });

  const saved = useMemo(() => (items || []).filter((i) => i.status === "saved"), [items]);
  const actions = { setStatus, remove, coach, cover: (i) => setCoverJob(i.job) };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-medium tracking-tight text-[#1B2A41]">Job tracker</h1>
      <p className="mt-1 text-sm text-[#5B6B7F]">Save roles, track every application, and see how your search is going.</p>

      <div className="mt-5 flex gap-1 border-b border-[#E3E8EF]" role="tablist">
        {TABS.map(({ k, l, icon: Icon }) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${tab === k ? "border-[#A47E3B] text-[#1B2A41]" : "border-transparent text-[#5B6B7F] hover:text-[#1B2A41]"}`}>
            <Icon size={16} /> {l}
            {k === "saved" && items && saved.length > 0 && <span className="rounded-full bg-[#F6EEDD] px-1.5 text-xs font-semibold text-[#A47E3B]">{saved.length}</span>}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {error !== null && items === null ? <LoadProblem status={error} onRetry={load} /> : items === null ? <Skeleton /> : tab === "saved" ? <SavedList list={saved} {...actions} /> : tab === "board" ? <Board items={items} {...actions} /> : <Analytics stats={stats} />}
      </div>
      {coverJob && <CoverLetterModal job={coverJob} onClose={() => setCoverJob(null)} />}
    </div>
  );
}

function LoadProblem({ status, onRetry }) {
  const msg = status === 404 ? "The tracker API wasn't found. Restart the Django backend so it loads the new routes."
    : status >= 500 ? "Server error. Run `python manage.py migrate` in the backend, then restart it."
    : status === 401 ? "Your session expired. Please log in again."
    : "Can't reach the backend. Check that it is running.";
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-medium text-red-800">Couldn't load your tracker{status ? ` (${status})` : ""}</p>
      <p className="mt-1 text-sm text-red-700">{msg}</p>
      <button onClick={onRetry} className="mt-3 rounded-md border border-red-300 bg-white px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Try again</button>
    </div>
  );
}

function Skeleton() {
  return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="job-skel h-20 rounded-lg" />)}</div>;
}

function Empty({ title, hint }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white p-10 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
      <Link to="/job-matches" className="mt-4 inline-flex rounded-md bg-[#1B2A41] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#2C4268]">Browse job matches</Link>
    </div>
  );
}

function StatusSelect({ item, setStatus }) {
  return (
    <select value={item.status} onChange={(e) => setStatus(item, e.target.value)} aria-label="Change status"
      className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-[#A47E3B]">
      {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
    </select>
  );
}

function IconBtn({ onClick, label, children, danger }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-md border border-stone-200 bg-white transition hover:bg-stone-50 ${danger ? "text-rose-500 hover:bg-rose-50" : "text-slate-500"}`}>
      {children}
    </button>
  );
}

function SavedList({ list, setStatus, remove, coach, cover }) {
  if (!list.length) return <Empty title="No saved jobs yet" hint="Tap Save on a job match and it will show up here." />;
  return (
    <ul className="flex flex-col gap-3">
      {list.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-base font-medium text-slate-900">{i.job.title}</p>
            <p className="truncate text-sm text-slate-500">{i.job.company}{i.job.location ? ` · ${i.job.location}` : ""}{i.match_score != null ? ` · ${Math.round(i.match_score)}% match` : ""}</p>
          </div>
          <button onClick={() => setStatus(i, "applied")} className="rounded-md bg-[#1B2A41] px-3 py-2 text-sm font-medium text-white hover:bg-[#2C4268]">Mark applied</button>
          <IconBtn onClick={() => cover(i)} label="Cover letter"><FileText size={15} /></IconBtn>
          <IconBtn onClick={() => coach(i)} label="Ask coach"><MessageCircle size={15} /></IconBtn>
          <a href={i.job.job_url} target="_blank" rel="noopener noreferrer" title="View listing" aria-label="View listing" className="grid h-8 w-8 place-items-center rounded-md border border-stone-200 bg-white text-slate-500 hover:bg-stone-50"><ExternalLink size={15} /></a>
          <IconBtn onClick={() => remove(i)} label="Remove" danger><Trash2 size={15} /></IconBtn>
        </li>
      ))}
    </ul>
  );
}

function Board({ items, setStatus, remove }) {
  const tracked = items.filter((i) => i.status !== "saved");
  if (!tracked.length) return <Empty title="Nothing tracked yet" hint="Mark a saved job as applied to start tracking it here." />;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {BOARD.map((col) => {
        const cards = tracked.filter((i) => i.status === col.v);
        return (
          <section key={col.v} className="rounded-lg bg-stone-100/70 p-3">
            <h2 className="flex items-center gap-2 px-1 pb-2 text-sm font-semibold text-slate-700">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} /> {col.l}
              <span className="ml-auto text-xs font-medium text-slate-400">{cards.length}</span>
            </h2>
            <div className="flex flex-col gap-2">
              {cards.map((i) => (
                <article key={i.id} className="rounded-md border border-stone-200 bg-white p-3 shadow-sm">
                  <a href={i.job.job_url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-slate-900 hover:underline">{i.job.title}</a>
                  <p className="truncate text-xs text-slate-500">{i.job.company}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusSelect item={i} setStatus={setStatus} />
                    <IconBtn onClick={() => remove(i)} label="Remove" danger><Trash2 size={14} /></IconBtn>
                  </div>
                </article>
              ))}
              {!cards.length && <p className="px-1 py-3 text-xs text-slate-400">Empty</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Analytics({ stats }) {
  if (!stats) return <Skeleton />;
  if (!stats.total) return <Empty title="No data yet" hint="Save or apply to a few jobs and your analytics will appear." />;
  const cards = [
    { l: "Applications sent", v: stats.applications_sent },
    { l: "Response rate", v: `${stats.response_rate}%`, sub: "interview, offer or rejection" },
    { l: "Interview rate", v: `${stats.interview_rate}%` },
    { l: "Avg match score", v: stats.avg_match != null ? `${stats.avg_match}%` : "-" },
  ];
  const max = Math.max(1, ...STATUSES.map((s) => stats.by_status[s.v]));
  const maxApplied = Math.max(1, ...stats.series.map((w) => w.applied));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.l} className="rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{c.v}</p>
            <p className="text-xs text-slate-500">{c.l}</p>
            {c.sub && <p className="text-[11px] text-slate-400">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Pipeline</h2>
          <div className="mt-4 space-y-3">
            {STATUSES.map((s) => (
              <div key={s.v} className="flex items-center gap-3 text-sm">
                <span className="w-20 text-slate-600">{s.l}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div className={`job-bar-fill h-full rounded-full ${s.dot}`} style={{ width: `${(stats.by_status[s.v] / max) * 100}%` }} />
                </div>
                <span className="w-6 text-right tabular-nums text-slate-500">{stats.by_status[s.v]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Weekly activity</h2>
          <p className="text-xs text-slate-400">Bars: applications sent. Label: average match score.</p>
          <div className="mt-4 flex h-36 items-end gap-2 overflow-x-auto">
            {stats.series.map((w) => (
              <div key={w.week} className="flex min-w-[34px] flex-1 flex-col items-center justify-end gap-1" title={`Week of ${w.week}: ${w.applied} sent`}>
                <span className="text-[10px] tabular-nums text-slate-500">{w.avg_match != null ? `${Math.round(w.avg_match)}%` : ""}</span>
                <div className="job-bar-fill w-full rounded-t bg-[#1B2A41]" style={{ height: `${Math.max(4, (w.applied / maxApplied) * 90)}px`, opacity: w.applied ? 1 : 0.2 }} />
                <span className="text-[10px] text-slate-400">{w.week.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
