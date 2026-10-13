import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Gauge, Heart, FileText, MessageCircle } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { cacheGet, cacheSet } from "../lib/cache";
import CoverLetterModal from "../components/jobs/CoverLetterModal";
import { readJobsCache, writeJobsCache, FRESH_MS } from "../utils/jobsCache";

const PROFILE_ROUTE = "/profile";
const PAGE_SIZE = 15;

const SORT_OPTIONS = [
  { value: "match_desc", label: "Best match first" },
  { value: "match_asc", label: "Lowest match first" },
  { value: "title_asc", label: "Title A to Z" },
  { value: "company_asc", label: "Company A to Z" },
  { value: "salary_first", label: "Salary listed first" },
];

const TIERS = [
  { v: "strong", l: "Strong 80+" },
  { v: "good", l: "Good 55-79" },
  { v: "partial", l: "Partial" },
];

const LEVELS = [
  { v: "entry", l: "Entry" },
  { v: "mid", l: "Mid / not stated" },
  { v: "senior", l: "Senior" },
  { v: "lead", l: "Lead+" },
];

const DEFAULT_FILTERS = {
  search: "",
  inDesc: false,
  minMatch: 0,
  tiers: [],
  location: "",
  salaryOnly: false,
  levels: [],
  sources: [],
};

const MOTION_CSS = `
@keyframes jobFadeUp { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: none; } }
@keyframes jobShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes jobSpin { to { transform: rotate(360deg); } }
@keyframes jobTick { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }
@keyframes jobPop { 0% { transform: scale(0.6); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
@keyframes jobRing { from { stroke-dashoffset: var(--ring-from); } }
.job-card { opacity: 0; animation: jobFadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.job-skel { background: linear-gradient(90deg, #f5f5f4 25%, #e7e5e4 50%, #f5f5f4 75%); background-size: 200% 100%; animation: jobShimmer 1.4s linear infinite; }
.job-spin { animation: jobSpin 0.8s linear infinite; }
.job-tick { stroke-dasharray: 24; animation: jobTick 0.35s ease-out forwards; }
.job-pop { animation: jobPop 0.35s ease-out; }
.job-ring { animation: jobRing 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
.job-bar-fill { transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
@media (prefers-reduced-motion: reduce) {
  .job-card, .job-skel, .job-spin, .job-tick, .job-pop, .job-ring { animation: none !important; opacity: 1; stroke-dashoffset: 0; }
  .job-bar-fill { transition: none; }
}
`;

// ---------- helpers ----------

const plainCache = new Map();
function plainText(html) {
  if (!html) return "";
  if (plainCache.has(html)) return plainCache.get(html);
  let t = html;
  try {
    t = new DOMParser().parseFromString(html, "text/html").body.textContent || "";
  } catch {
    /* keep raw text */
  }
  t = t.replace(/\s+/g, " ").trim();
  plainCache.set(html, t);
  return t;
}

function guessLevel(title = "") {
  const t = title.toLowerCase();
  if (/\b(intern|internship|junior|jr\.?|entry|graduate|trainee)\b/.test(t)) return "entry";
  if (/\b(lead|head|manager|director|vp|chief|principal|architect)\b/.test(t)) return "lead";
  if (/\b(senior|sr\.?|staff)\b/.test(t)) return "senior";
  return "mid";
}

function tierOf(score) {
  if (score == null) return { key: "partial", label: "Partial match", stroke: "stroke-slate-400" };
  if (score >= 80) return { key: "strong", label: "Strong match", stroke: "stroke-teal-600" };
  if (score >= 55) return { key: "good", label: "Good match", stroke: "stroke-amber-500" };
  return { key: "partial", label: "Partial match", stroke: "stroke-slate-400" };
}

const AVATAR_COLORS = [
  "bg-teal-100 text-teal-800",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
];
function avatarClass(name = "") {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ---------- page ----------

export default function JobMatches() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const trackKey = `${user?.email || ""}:tracker`;
  const [jobs, setJobs] = useState(() => readJobsCache("all")?.jobs || []);
  const [loading, setLoading] = useState(() => !readJobsCache("all"));
  const [showLoader, setShowLoader] = useState(() => !readJobsCache("all"));
  const [error, setError] = useState(null);
  const [isRemote, setIsRemote] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState("match_desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const reqId = useRef(0);
  const toMap = (list) => Object.fromEntries((list || []).map((t) => [t.job_id, { id: t.id, status: t.status }]));
  const [tracked, setTracked] = useState(() => toMap(cacheGet(trackKey))); // job id -> { id, status }
  const [coverJob, setCoverJob] = useState(null);

  useEffect(() => {
    api.get("/jobs/tracker/")
      .then((r) => { cacheSet(trackKey, r.data); setTracked(toMap(r.data)); })
      .catch(() => {});
  }, []);

  async function toggleSave(job) {
    const cur = tracked[job.id];
    const prev = tracked;
    if (cur) {
      setTracked(({ [job.id]: _, ...rest }) => rest);
      try { await api.delete(`/jobs/tracker/${cur.id}/`); cacheSet(trackKey, (cacheGet(trackKey) || []).filter((t) => t.id !== cur.id)); toast.success("Removed from saved"); }
      catch { setTracked(prev); toast.error("Couldn't remove job"); }
    } else {
      setTracked((t) => ({ ...t, [job.id]: { id: 0, status: "saved" } }));
      try {
        const { data } = await api.post("/jobs/tracker/", { job_id: job.id, match_score: job.match_score });
        setTracked((t) => ({ ...t, [job.id]: { id: data.id, status: data.status } }));
        cacheSet(trackKey, [data, ...(cacheGet(trackKey) || [])]);
        toast.success("Saved");
      } catch { setTracked(prev); toast.error("Couldn't save job"); }
    }
  }

  const loaderVisible = loading || showLoader;

  useEffect(() => {
    document.title = "Job Matches | CV Builder";
  }, []);

  useEffect(() => {
    fetchMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRemote]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, sortBy, isRemote]);

  async function fetchMatches(force = false) {
    const key = isRemote ? "remote" : "all";
    const id = ++reqId.current; // ignore answers from older requests
    const cached = force ? null : readJobsCache(key);

    setError(null);
    if (cached) {
      setJobs(cached.jobs);
      setLoading(false);
      if (Date.now() - cached.at < FRESH_MS) return; // fresh: no request at all
      setRefreshing(true); // stale: show it now, update quietly
    } else if (force && jobs.length > 0) {
      setRefreshing(true); // refresh keeps the current list on screen
    } else {
      setLoading(true);
      setShowLoader(true);
    }

    try {
      const params = {};
      if (isRemote) params.is_remote = "true";

      const { data } = await api.get("/jobs/match/", { params });
      if (id !== reqId.current) return;
      const list = Array.isArray(data) ? data : data.results || [];
      setJobs(list);
      writeJobsCache(key, list);
    } catch (err) {
      if (id !== reqId.current) return;
      if (cached || jobs.length > 0) return; // keep showing what we have
      setShowLoader(false);
      if (err.response?.status === 401) {
        setError("Your session has expired. Please log in again.");
      } else {
        setError(err.response?.data?.detail || "Couldn't load job matches. Please try again.");
      }
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const toggleIn = (k, v) =>
    setFilters((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  function clearAllFilters() {
    setFilters(DEFAULT_FILTERS);
    setIsRemote(false);
  }

  const prepared = useMemo(
    () => jobs.map((j) => ({ ...j, _desc: plainText(j.description), _level: guessLevel(j.title) })),
    [jobs]
  );

  const sources = useMemo(() => [...new Set(jobs.map((j) => j.source).filter(Boolean))], [jobs]);

  const filteredJobs = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const loc = filters.location.trim().toLowerCase();

    const list = prepared.filter((job) => {
      const score = job.match_score ?? 0;
      if (filters.minMatch > 0 && score < filters.minMatch) return false;
      if (filters.tiers.length && !filters.tiers.includes(tierOf(job.match_score).key)) return false;
      if (filters.salaryOnly && !job.salary) return false;
      if (filters.levels.length && !filters.levels.includes(job._level)) return false;
      if (filters.sources.length && !filters.sources.includes(job.source)) return false;
      if (loc && !(job.location || "").toLowerCase().includes(loc)) return false;
      if (q) {
        const hay = `${job.title || ""} ${job.company || ""}${filters.inDesc ? " " + job._desc : ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const sa = a.match_score ?? 0;
      const sb = b.match_score ?? 0;
      switch (sortBy) {
        case "match_asc":
          return sa - sb;
        case "title_asc":
          return (a.title || "").localeCompare(b.title || "");
        case "company_asc":
          return (a.company || "").localeCompare(b.company || "");
        case "salary_first":
          return (b.salary ? 1 : 0) - (a.salary ? 1 : 0) || sb - sa;
        default:
          return sb - sa;
      }
    });
  }, [prepared, filters, sortBy]);

  const visibleJobs = filteredJobs.slice(0, visibleCount);
  const hasMore = visibleCount < filteredJobs.length;

  // active filter chips (removable)
  const chips = [];
  if (filters.search) chips.push({ k: "search", label: `"${filters.search}"`, off: () => setFilter("search", "") });
  if (filters.location) chips.push({ k: "loc", label: `Location: ${filters.location}`, off: () => setFilter("location", "") });
  if (filters.minMatch > 0) chips.push({ k: "min", label: `Match ${filters.minMatch}%+`, off: () => setFilter("minMatch", 0) });
  if (isRemote) chips.push({ k: "remote", label: "Remote only", off: () => setIsRemote(false) });
  if (filters.salaryOnly) chips.push({ k: "sal", label: "Salary listed", off: () => setFilter("salaryOnly", false) });
  filters.tiers.forEach((t) => chips.push({ k: "t" + t, label: TIERS.find((x) => x.v === t)?.l, off: () => toggleIn("tiers", t) }));
  filters.levels.forEach((l) => chips.push({ k: "l" + l, label: LEVELS.find((x) => x.v === l)?.l, off: () => toggleIn("levels", l) }));
  filters.sources.forEach((s) => chips.push({ k: "s" + s, label: `via ${s}`, off: () => toggleIn("sources", s) }));

  const strongCount = jobs.filter((j) => (j.match_score ?? 0) >= 80).length;
  const remoteCount = jobs.filter((j) => j.is_remote).length;

  return (
    <div className="min-h-screen bg-stone-50">
      <style>{MOTION_CSS}</style>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Header
          loading={loaderVisible}
          total={jobs.length}
          visible={filteredJobs.length}
          filtersOpen={filtersOpen}
          activeCount={chips.length}
          onToggleFilters={() => setFiltersOpen((v) => !v)}
          onEditProfile={() => navigate(PROFILE_ROUTE)}
          onRefresh={() => fetchMatches(true)}
          refreshing={refreshing}
        />

        {!loaderVisible && jobs.length > 0 && (
          <StatsStrip total={jobs.length} strong={strongCount} remote={remoteCount} />
        )}

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
          <Filters
            className={filtersOpen ? "block" : "hidden lg:block"}
            disabled={loaderVisible}
            filters={filters}
            setFilter={setFilter}
            toggleIn={toggleIn}
            isRemote={isRemote}
            setIsRemote={setIsRemote}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sources={sources}
            activeCount={chips.length}
            onClear={clearAllFilters}
          />

          <main>
            <p className="sr-only" role="status" aria-live="polite">
              {loaderVisible ? "Loading job matches" : `${filteredJobs.length} job matches found`}
            </p>

            {loaderVisible && <LoadingPanel finished={!loading} onDone={() => setShowLoader(false)} />}

            {!loaderVisible && error && <ErrorState message={error} onRetry={() => fetchMatches(true)} />}

            {!loaderVisible && !error && jobs.length === 0 && (
              <EmptyState onEditProfile={() => navigate(PROFILE_ROUTE)} />
            )}

            {!loaderVisible && !error && chips.length > 0 && jobs.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {chips.map((c) => (
                  <button
                    key={c.k}
                    type="button"
                    onClick={c.off}
                    className="job-pop inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100"
                  >
                    {c.label}
                    <span aria-hidden="true">&times;</span>
                    <span className="sr-only">remove filter</span>
                  </button>
                ))}
                <button type="button" onClick={clearAllFilters} className="text-xs font-medium text-slate-500 underline hover:text-slate-900">
                  Clear all
                </button>
              </div>
            )}

            {!loaderVisible && !error && jobs.length > 0 && filteredJobs.length === 0 && (
              <NoMatchesState onClear={clearAllFilters} />
            )}

            {!loaderVisible && !error && visibleJobs.length > 0 && (
              <>
                <ul className="flex flex-col gap-3">
                  {visibleJobs.map((job, i) => (
                    <JobCard key={job.id} job={job} delay={Math.min(i % PAGE_SIZE, 14) * 70} tracked={tracked[job.id]} onToggleSave={toggleSave} onCover={setCoverJob} />
                  ))}
                </ul>

                {hasMore && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-stone-50"
                    >
                      Show {Math.min(PAGE_SIZE, filteredJobs.length - visibleCount)} more
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
      {coverJob && <CoverLetterModal job={coverJob} onClose={() => setCoverJob(null)} />}
    </div>
  );
}

// ---------- header + stats ----------

function Header({ loading, total, visible, filtersOpen, activeCount, onToggleFilters, onEditProfile, onRefresh, refreshing }) {
  return (
    <div className="flex flex-col gap-4 border-b border-stone-200 pb-6">
      <button
        type="button"
        onClick={onEditProfile}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to your CV
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900">Job matches</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {loading
              ? "Finding roles that fit your profile..."
              : total > 0
              ? `Showing ${visible} of ${total} role${total === 1 ? "" : "s"} matched to your profile`
              : "Roles ranked against your profile will appear here"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-60"
          >
            <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${refreshing ? "job-spin" : ""}`} aria-hidden="true">
              <path d="M16 10a6 6 0 11-2-4.5M16 3v3.5h-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {refreshing ? "Updating..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={onToggleFilters}
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-stone-50 lg:hidden"
          >
            {filtersOpen ? "Hide filters" : "Filters"}
            {activeCount > 0 && (
              <span className="rounded-full bg-teal-700 px-1.5 text-xs font-semibold text-white">{activeCount}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatsStrip({ total, strong, remote }) {
  const items = [
    { label: "Matches", value: total },
    { label: "Strong matches", value: strong },
    { label: "Remote roles", value: remote },
  ];
  return (
    <div className="mt-6 grid grid-cols-3 gap-3">
      {items.map((it, i) => (
        <div
          key={it.label}
          style={{ animationDelay: `${i * 80}ms` }}
          className="job-card rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm"
        >
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{it.value}</p>
          <p className="text-xs text-slate-500">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

// ---------- filters ----------

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-teal-600 bg-teal-50 text-teal-800"
          : "border-stone-300 bg-white text-slate-600 hover:bg-stone-50"
      }`}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </label>
  );
}

const inputCls =
  "mt-1.5 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="relative inline-flex h-5 w-9 items-center">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full bg-stone-300 transition-colors peer-checked:bg-teal-700" />
        <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

function Filters({ className = "", disabled, filters, setFilter, toggleIn, isRemote, setIsRemote, sortBy, setSortBy, sources, activeCount, onClear }) {
  return (
    <aside className={`${className} h-fit lg:sticky lg:top-8`}>
      <div className={`rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition-opacity ${disabled ? "pointer-events-none opacity-50" : ""}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
          {activeCount > 0 && (
            <button type="button" onClick={onClear} className="text-xs font-medium text-teal-700 hover:underline">
              Reset ({activeCount})
            </button>
          )}
        </div>

        <div className="mt-4">
          <FieldLabel htmlFor="job-search">Search</FieldLabel>
          <input id="job-search" type="text" value={filters.search} onChange={(e) => setFilter("search", e.target.value)} placeholder="Title or company" className={inputCls} />
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={filters.inDesc} onChange={(e) => setFilter("inDesc", e.target.checked)} className="accent-teal-700" />
            Also search descriptions
          </label>
        </div>

        <div className="mt-5">
          <FieldLabel htmlFor="sort-by">Sort by</FieldLabel>
          <select id="sort-by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={inputCls}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="min-match">Minimum match</FieldLabel>
            <span className="text-sm tabular-nums text-slate-500">{filters.minMatch}%</span>
          </div>
          <input id="min-match" type="range" min="0" max="100" step="5" value={filters.minMatch} onChange={(e) => setFilter("minMatch", Number(e.target.value))} className="mt-2 w-full accent-teal-700" />
        </div>

        <div className="mt-5">
          <FieldLabel>Match quality</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIERS.map((t) => (
              <Chip key={t.v} active={filters.tiers.includes(t.v)} onClick={() => toggleIn("tiers", t.v)}>{t.l}</Chip>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <FieldLabel>Level (guessed from title)</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <Chip key={l.v} active={filters.levels.includes(l.v)} onClick={() => toggleIn("levels", l.v)}>{l.l}</Chip>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <FieldLabel htmlFor="job-loc">Location</FieldLabel>
          <input id="job-loc" type="text" value={filters.location} onChange={(e) => setFilter("location", e.target.value)} placeholder="City or country" className={inputCls} />
        </div>

        {sources.length > 1 && (
          <div className="mt-5">
            <FieldLabel>Source</FieldLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {sources.map((s) => (
                <Chip key={s} active={filters.sources.includes(s)} onClick={() => toggleIn("sources", s)}>{s}</Chip>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 space-y-4 border-t border-stone-100 pt-5">
          <Toggle label="Remote only" checked={isRemote} onChange={setIsRemote} />
          <Toggle label="Salary listed" checked={filters.salaryOnly} onChange={(v) => setFilter("salaryOnly", v)} />
        </div>
      </div>
    </aside>
  );
}

// ---------- cards ----------

function ScoreRing({ score }) {
  const C = 2 * Math.PI * 18;
  const pct = Math.max(0, Math.min(100, score));
  const tier = tierOf(score);
  return (
    <div className="flex flex-col items-center gap-1" title={tier.label}>
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 44 44" className="h-14 w-14 -rotate-90" aria-hidden="true">
          <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" className="stroke-stone-100" />
          <circle
            cx="22" cy="22" r="18" fill="none" strokeWidth="4" strokeLinecap="round"
            className={`job-ring ${tier.stroke}`}
            style={{ strokeDasharray: C, strokeDashoffset: C * (1 - pct / 100), "--ring-from": C }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums text-slate-900">
          {Math.round(pct)}%
        </span>
      </div>
      <span className="text-[11px] text-slate-400">{tier.label}</span>
    </div>
  );
}

function JobCard({ job, delay = 0, tracked, onToggleSave, onCover }) {
  const navigate = useNavigate();
  const goAts = () => {
    const jd = [job.title && `${job.title}${job.company ? " at " + job.company : ""}`, job._desc].filter(Boolean).join("\n\n");
    navigate("/ats", { state: { jd } });
  };
  const initial = (job.company || job.title || "?").trim().charAt(0).toUpperCase();
  const snippet = job._desc ? job._desc.slice(0, 220) : "";

  return (
    <li
      style={{ animationDelay: `${delay}ms` }}
      className="job-card group rounded-lg border border-stone-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
    >
      <div className="flex gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-base font-semibold ${avatarClass(job.company)}`} aria-hidden="true">
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-lg font-medium leading-snug text-slate-900">{job.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </p>

          {snippet && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{snippet}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {job.is_remote && (
              <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">Remote</span>
            )}
            {job.salary && (
              <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{job.salary}</span>
            )}
            {job.source && (
              <span className="inline-flex items-center rounded-full bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-slate-400">via {job.source}</span>
            )}
            {tracked && tracked.status !== "saved" && (
              <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium capitalize text-sky-700">{tracked.status}</span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-stone-100 pt-2.5 text-xs font-medium text-slate-500">
            <button type="button" onClick={() => onToggleSave(job)} aria-pressed={!!tracked}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-stone-100 ${tracked ? "text-rose-600" : ""}`}>
              <Heart size={14} fill={tracked ? "currentColor" : "none"} aria-hidden="true" />
              {tracked ? "Saved" : "Save"}
            </button>
            <button type="button" onClick={() => onCover(job)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-stone-100">
              <FileText size={14} aria-hidden="true" /> Cover letter
            </button>
            <button type="button" onClick={() => navigate("/coach", { state: { job: { id: job.id, title: job.title, company: job.company } } })}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-stone-100">
              <MessageCircle size={14} aria-hidden="true" /> Ask coach
            </button>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch justify-between gap-2">
          {job.match_score != null && <ScoreRing score={job.match_score} />}
          <a
            href={job.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 group-hover:shadow"
          >
            View listing
          </a>
          <button
            type="button"
            onClick={goAts}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-teal-600 bg-white px-3.5 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-50"
          >
            <Gauge size={15} aria-hidden="true" />
            ATS check
          </button>
        </div>
      </div>
    </li>
  );
}

// ---------- loading ----------

const STEPS = [
  { title: "Reading your CV", hint: "Collecting your skills, experience and projects" },
  { title: "Fetching jobs", hint: "Looking through the latest openings" },
  { title: "Matching with your CV", hint: "Comparing job descriptions with your profile" },
  { title: "Matching job titles", hint: "Checking roles that fit what you are aiming for" },
  { title: "Ranking your best matches", hint: "Putting the strongest fits on top" },
];
const STEP_MS = [1300, 2200, 2600, 2000];

function LoadingPanel({ finished, onDone }) {
  const [active, setActive] = useState(0); // === STEPS.length means everything is ticked
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // walk through the steps while waiting; the last one waits for the server
  useEffect(() => {
    if (finished || active >= STEPS.length - 1) return;
    const t = setTimeout(() => setActive((a) => a + 1), STEP_MS[active]);
    return () => clearTimeout(t);
  }, [active, finished]);

  // data arrived: tick the rest quickly, then reveal the cards
  useEffect(() => {
    if (!finished) return;
    if (active < STEPS.length) {
      const t = setTimeout(() => setActive((a) => a + 1), 140);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => doneRef.current(), 550);
    return () => clearTimeout(t);
  }, [finished, active]);

  const pct = Math.min(100, Math.round(((active + (active < STEPS.length ? 0.5 : 0)) / STEPS.length) * 100));

  return (
    <div>
      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-medium text-slate-900">Finding your best matches</h2>
          <span className="text-sm font-medium tabular-nums text-teal-700">{pct}%</span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
          <div className="job-bar-fill h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
        </div>

        <ol className="mt-5 space-y-3">
          {STEPS.map((s, i) => {
            const status = i < active ? "done" : i === active ? "active" : "pending";
            return (
              <li key={s.title} className={`flex items-start gap-3 transition-opacity ${status === "pending" ? "opacity-40" : "opacity-100"}`}>
                <StepIcon status={status} />
                <div>
                  <p className={`text-sm font-medium ${status === "pending" ? "text-slate-500" : "text-slate-900"}`}>{s.title}</p>
                  {status === "active" && <p className="job-pop text-xs text-slate-400">{s.hint}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

    </div>
  );
}

function StepIcon({ status }) {
  if (status === "done") {
    return (
      <span className="job-pop mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-600" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
          <path className="job-tick" d="M3 8.5l3.2 3.2L13 4.8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "active") {
    return <span className="job-spin mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-teal-600 border-t-transparent" aria-hidden="true" />;
  }
  return <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-stone-300" aria-hidden="true" />;
}

// ---------- states ----------

function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-medium text-red-800">{message}</p>
      <button onClick={onRetry} className="mt-3 inline-flex items-center rounded-md border border-red-300 bg-white px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
        Try again
      </button>
    </div>
  );
}

function EmptyState({ onEditProfile }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white p-10 text-center">
      <p className="text-sm font-medium text-slate-700">No matches yet</p>
      <p className="mt-1 text-sm text-slate-500">Add more skills and experience to your profile to get better matches.</p>
      <button onClick={onEditProfile} className="mt-4 inline-flex items-center rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800">
        Edit your CV
      </button>
    </div>
  );
}

function NoMatchesState({ onClear }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white p-10 text-center">
      <p className="text-sm font-medium text-slate-700">No roles fit these filters</p>
      <p className="mt-1 text-sm text-slate-500">Try removing a filter or lowering the minimum match.</p>
      <button onClick={onClear} className="mt-3 inline-flex items-center rounded-md border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50">
        Clear filters
      </button>
    </div>
  );
}
