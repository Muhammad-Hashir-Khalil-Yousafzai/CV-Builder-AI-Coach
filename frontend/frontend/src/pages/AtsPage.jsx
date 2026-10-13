import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import LoadError from "../components/common/LoadError";
import { useAuth } from "../context/AuthContext";
import { cacheGet, cacheSet } from "../lib/cache";
import FunLoader, { ATS_STEPS } from "../components/common/FunLoader";
import { Sparkles, AlertTriangle, ArrowRight, ClipboardList, X } from "lucide-react";

// Which CV fields are empty? Returns [{label, where}] shown as "Missing in your CV".
function findMissingFields(cv) {
  const m = [];
  const add = (label, where) => m.push({ label, where });
  if (!cv.headline) add("Headline", "Basic info");
  if (!cv.summary) add("Summary", "Basic info");
  if (!cv.phone) add("Phone number", "Basic info");
  if (!cv.linkedin_url) add("LinkedIn link", "Basic info");
  if (!cv.github_url) add("GitHub link", "Basic info");
  if (!cv.portfolio_url) add("Portfolio link", "Basic info");
  if (!(cv.education || []).length) add("Education", "Education");
  (cv.education || []).forEach((e) => {
    if (!e.degree) add(`Degree is missing (${e.institute || "education"})`, "Education");
    if (!e.end_year && !e.start_year) add(`Years are missing (${e.institute || "education"})`, "Education");
  });
  if (!(cv.experience || []).length) add("Work experience", "Experience");
  (cv.experience || []).forEach((e) => {
    if (!e.description) add(`Description is missing (${e.role || "role"} @ ${e.company || "company"})`, "Experience");
    if (!e.start_date) add(`Start date is missing (${e.role || "role"})`, "Experience");
  });
  if (!(cv.skills || []).length) add("Skills", "Skills");
  (cv.projects || []).forEach((p) => {
    if (!p.link) add(`Link is missing (project: ${p.title || "untitled"})`, "Projects");
    if (!p.description) add(`Description is missing (project: ${p.title || "untitled"})`, "Projects");
  });
  (cv.certifications || []).forEach((c) => {
    if (!c.issuer) add(`Issuer is missing (${c.title || "certification"})`, "Certifications");
    if (!c.year) add(`Year is missing (${c.title || "certification"})`, "Certifications");
  });
  return m;
}

// ATS job-match score + CV improvement tools (skills, bullets, headline).
// Works on your last SAVED CV; every fix is saved straight to your profile.
export default function AtsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const cacheKey = `${user?.email || ""}:profile`;
  const [cv, setCv] = useState(() => cacheGet(cacheKey) || null);
  const [loadError, setLoadError] = useState(null);
  const [ats, setAts] = useState(null);
  const [atsJd, setAtsJd] = useState(location.state?.jd || "");
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsApplying, setAtsApplying] = useState(false);
  const [atsAdding, setAtsAdding] = useState([]);
  const [atsAdded, setAtsAdded] = useState([]);
  const [bulletSkill, setBulletSkill] = useState(null);
  const [bf, setBf] = useState({ target: "", did: "", result: "", draft: "" });
  const [bfBusy, setBfBusy] = useState("");
  const [rwKey, setRwKey] = useState(null);
  const [rw, setRw] = useState({ result: "", draft: "", engine: "" });
  const [rwBusy, setRwBusy] = useState("");

  const loadProfile = () => {
    setLoadError(null);
    api.get("/profile/me/").then((res) => { setCv(res.data); cacheSet(cacheKey, res.data); }).catch((err) => { if (!cacheGet(cacheKey)) setLoadError({ status: err.response?.status || 0 }); });
  };
  useEffect(() => { loadProfile(); }, []);

  const checkAts = async () => {
    setAtsLoading(true);
    try {
      const { data } = await api.post("/profile/ats-score/", { job_description: atsJd });
      setAts(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't calculate ATS score");
    } finally {
      setAtsLoading(false);
    }
  };

  const applyAts = async ({ skills = [], headline = "" }) => {
    if (atsApplying) return;
    setAtsApplying(true);
    setAtsAdding([...skills, ...(headline ? ["__headline"] : [])]);
    try {
      const { data } = await api.post("/profile/ats-apply/", { skills, headline, job_description: atsJd });
      const added = (data.profile.skills || []).filter(
        (sv) => !(cv.skills || []).some((c) => (c.name || "").toLowerCase() === sv.name.toLowerCase())
      );
      setCv((prev) => ({ ...prev, skills: [...(prev.skills || []), ...added], headline: headline ? data.profile.headline : prev.headline }));
      if (data.ats) setAts(data.ats);
      setAtsAdded([...skills.map((x) => `${x} added`), ...(headline ? ["Headline updated"] : [])]);
      setTimeout(() => setAtsAdded([]), 2600);
    } catch (err) {
      toast.error("Couldn't update your CV");
    } finally {
      setAtsAdding([]);
      setAtsApplying(false);
    }
  };

  const bulletTargets = [
    ...(cv?.experience || []).filter((x) => x.id).map((x) => ({ key: `experience:${x.id}`, label: `${x.role} @ ${x.company}` })),
    ...(cv?.projects || []).filter((x) => x.id).map((x) => ({ key: `project:${x.id}`, label: `Project: ${x.title}` })),
  ];

  const openBullet = (skill) => {
    setBulletSkill(skill);
    setBf({ target: bulletTargets[0]?.key || "", did: "", result: "", draft: "" });
  };

  const draftBullet = async () => {
    setBfBusy("drafting");
    try {
      const where = bulletTargets.find((t) => t.key === bf.target)?.label || "";
      const { data } = await api.post("/profile/skill-bullet/", { skill: bulletSkill, did: bf.did, result: bf.result, where });
      setBf((d) => ({ ...d, draft: data.bullet }));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't write the bullet");
    } finally {
      setBfBusy("");
    }
  };

  const saveBullet = async () => {
    const [type, id] = bf.target.split(":");
    setBfBusy("saving");
    try {
      const { data } = await api.post("/profile/add-bullet/", { target_type: type, target_id: Number(id), bullet: bf.draft, job_description: atsJd });
      const listKey = type === "experience" ? "experience" : "projects";
      setCv((prev) => ({
        ...prev,
        [listKey]: prev[listKey].map((x) =>
          x.id === Number(id) ? { ...x, description: `${(x.description || "").trimEnd()}${x.description ? "\n" : ""}${bf.draft}` } : x
        ),
      }));
      if (data.ats) setAts(data.ats);
      setAtsAdded([`Bullet added for ${bulletSkill}`]);
      setTimeout(() => setAtsAdded([]), 2600);
      setBulletSkill(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't add the bullet");
    } finally {
      setBfBusy("");
    }
  };

  const rwId = (x) => `${x.type}:${x.id}:${x.text}`;
  const openRewrite = (x) => {
    setRwKey(rwId(x));
    setRw({ result: "", draft: "", engine: "" });
  };

  const draftRewrite = async (x) => {
    setRwBusy("drafting");
    try {
      const { data } = await api.post("/profile/rewrite-bullet/", { text: x.text, result: rw.result, where: x.where });
      setRw((r) => ({ ...r, draft: data.bullet, engine: data.engine }));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't rewrite the bullet");
    } finally {
      setRwBusy("");
    }
  };

  const replaceBullet = async (x) => {
    setRwBusy("saving");
    try {
      const { data } = await api.post("/profile/replace-bullet/", {
        target_type: x.type, target_id: x.id, old: x.text, new: rw.draft, job_description: atsJd,
      });
      const listKey = x.type === "experience" ? "experience" : "projects";
      const norm = (l) => l.replace(/^[^\w]+/, "").trim();
      setCv((prev) => ({
        ...prev,
        [listKey]: prev[listKey].map((it) =>
          it.id === x.id ? { ...it, description: (it.description || "").split("\n").map((l) => (norm(l) === x.text ? rw.draft : l)).join("\n") } : it
        ),
      }));
      if (data.ats) setAts(data.ats);
      setAtsAdded(["Bullet improved"]);
      setTimeout(() => setAtsAdded([]), 2600);
      setRwKey(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't replace the bullet");
    } finally {
      setRwBusy("");
    }
  };

  if (loadError) return <LoadError status={loadError.status} what="your CV" onRetry={loadProfile} />;
  if (!cv) {
    return <FunLoader title="Loading your CV" />;
  }

  const looksEmpty = !(cv.experience || []).length && !(cv.skills || []).length;

  return (
    <div className="min-h-screen bg-[#F3F5F7] text-[#1B2A41]">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <header>
          <h1 className="font-serif text-2xl sm:text-3xl">ATS score &amp; CV improvement</h1>
          <p className="text-sm text-[#5B6B7F] mt-1">
            Scores your last saved CV against a job description. Fixes you accept here are saved to your profile.{" "}
            <Link to="/profile" className="underline text-[#8A6529]">Edit your CV</Link>
          </p>
        </header>

        {looksEmpty && (
          <div className="bg-white rounded-lg border border-[#DDE3E8] p-4 text-sm">
            Your CV has no experience or skills yet, so the score will be low.{" "}
            <Link to="/profile" className="underline text-[#8A6529]">Fill in your CV first</Link>.
          </div>
        )}

          {/* --- ATS job match --- */}
          <section className="bg-white rounded-lg border border-[#E3E8EF] p-4 sm:p-6">
            <style>{`
              @keyframes atsPoke{0%,100%{transform:translate(-50%,0) rotate(-8deg)}50%{transform:translate(-50%,-7px) rotate(8deg)}}
              @keyframes atsSpin{to{transform:rotate(360deg)}}
              @keyframes atsShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
              @keyframes atsPop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
              .ats-btn{position:relative;border-radius:6px;padding:4px 10px;transition:transform .15s,background-color .15s,box-shadow .15s}
              .ats-btn:hover:not(:disabled){transform:translateY(-1px);background:#F6EEDD;box-shadow:0 2px 8px rgba(164,126,59,.28)}
              .ats-btn:active:not(:disabled){transform:scale(.96)}
              .ats-btn:disabled{opacity:.45;cursor:not-allowed}
              .ats-finger{position:absolute;left:50%;bottom:-22px;opacity:0;pointer-events:none;font-size:18px;z-index:5;transition:opacity .15s}
              .ats-btn:hover:not(:disabled) .ats-finger{opacity:1;animation:atsPoke .7s ease-in-out infinite}
              .ats-spin{width:14px;height:14px;border:2px solid #E3E8EF;border-top-color:#A47E3B;border-radius:50%;animation:atsSpin .7s linear infinite;flex:none}
              .ats-shimmer{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(164,126,59,.2),transparent);animation:atsShimmer 1s linear infinite}
              .ats-pop{animation:atsPop .4s ease-out;display:inline-block}
            `}</style>
            <div className="flex items-start gap-3">
              <span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-[#F6EEDD] text-[#A47E3B]"><ClipboardList size={20} /></span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[#1B2A41] leading-tight">ATS job-match score</h2>
                <p className="text-sm text-[#5B6B7F] mt-0.5">Paste the full job description. Your saved profile is scored against that job.</p>
              </div>
            </div>
            <div className="relative mt-4">
              <textarea value={atsJd} onChange={(e) => setAtsJd(e.target.value)} rows={7}
                placeholder="Paste the full job description here…"
                className="w-full min-h-[160px] resize-y rounded-xl border-2 border-[#E3E8EF] bg-[#FAFBFC] focus:bg-white focus:border-[#A47E3B] outline-none p-3 pr-10 text-base sm:text-sm leading-relaxed transition-colors" />
              {atsJd && (
                <button type="button" onClick={() => setAtsJd("")} aria-label="Clear" className="absolute top-2 right-2 grid place-items-center w-8 h-8 rounded-full text-[#9AA6B2] hover:bg-[#EEF1F4] hover:text-[#1B2A41]"><X size={16} /></button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 rounded-full bg-[#E3E8EF] overflow-hidden">
                <div className={`h-full rounded-full transition-all ${atsJd.trim().length >= 100 ? "bg-[#1E7A3C]" : "bg-[#D8B873]"}`} style={{ width: `${Math.min(100, atsJd.trim().length)}%` }} />
              </div>
              <span className={`text-xs shrink-0 ${atsJd.trim().length >= 100 ? "text-[#1E7A3C]" : "text-[#9AA6B2]"}`}>
                {atsJd.trim().length >= 100 ? "Ready" : `${atsJd.trim().length}/100 min`}
              </span>
            </div>
            {atsLoading ? (
              <div className="mt-4 rounded-xl border border-[#E3E8EF] bg-gradient-to-b from-white to-[#FBF6EC]"><FunLoader compact steps={ATS_STEPS} title="Analysing your match" intervalMs={1100} /></div>
            ) : (
              <div className="mt-5 flex justify-center">
                <button onClick={checkAts} disabled={atsJd.trim().length < 100}
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1B2A41] to-[#2C4268] px-8 py-3 min-h-[48px] text-sm font-semibold text-white shadow-lg shadow-[#1B2A41]/25 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed">
                  <Sparkles size={18} className="text-[#D8B873] transition group-hover:rotate-12" />
                  Check match
                  <ArrowRight size={18} className="transition group-hover:translate-x-1" />
                </button>
              </div>
            )}
            {ats && (
              <div className="mt-4">
                <p className="text-3xl font-bold text-[#1B2A41]"><span key={ats.score} className="ats-pop">{ats.score}</span><span className="text-base font-normal">/100</span>
                  <span className="ml-3 text-base font-semibold text-[#A47E3B]">{ats.grade}</span></p>
                <div className="mt-3 space-y-3">
                  {ats.components.map((c) => (
                    <div key={c.name}>
                      <div className="flex justify-between text-sm text-[#1B2A41]"><span>{c.name}</span><span>{c.earned}/{c.max}</span></div>
                      <div className="h-2 bg-[#E3E8EF] rounded"><div className="h-2 rounded bg-[#A47E3B]" style={{ width: `${(100 * c.earned) / c.max}%` }} /></div>
                      <p className="text-xs text-[#5B6B7F] mt-0.5">{c.detail}</p>
                    </div>
                  ))}
                </div>
                {(() => {
                  const miss = findMissingFields(cv);
                  if (!miss.length) return null;
                  return (
                    <div className="mt-5 rounded-lg border border-[#F0D9A8] bg-[#FFFBF2] p-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-[#8A6529]"><AlertTriangle size={16} />Missing in your CV ({miss.length})</p>
                      <p className="text-xs text-[#5B6B7F] mt-0.5">Recruiters and ATS systems look for these. <Link to="/profile" className="underline text-[#8A6529]">Fix them in My CV</Link></p>
                      <ul className="mt-2 grid sm:grid-cols-2 gap-1.5">
                        {miss.map((x, k) => (
                          <li key={k} className="flex items-start gap-2 rounded-md bg-white border border-[#F0E3C4] px-2.5 py-1.5 text-xs text-[#1B2A41]">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#C27A1A] shrink-0" />
                            <span><b>{x.label}</b> <span className="text-[#9AA6B2]">· {x.where}</span></span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
                {[["Required skills found", ats.skills.required_found], ["Preferred skills found", ats.skills.preferred_found]]
                  .filter(([, l]) => l.length > 0).map(([label, l]) => (
                  <p key={label} className="mt-3 text-sm"><b>{label}:</b> {l.join(", ")}</p>
                ))}
                {atsAdded.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {atsAdded.map((t) => (
                      <span key={t} className="ats-pop inline-flex items-center gap-1 rounded-full bg-[#E6F4EA] text-[#1E7A3C] text-xs font-semibold px-3 py-1">✓ {t}</span>
                    ))}
                  </div>
                )}
                {[["Required skills missing", ats.skills.required_missing], ["Preferred skills missing", ats.skills.preferred_missing]]
                  .filter(([, l]) => l.length > 0).map(([label, l]) => {
                  const groupBusy = l.length > 1 && l.every((x) => atsAdding.includes(x));
                  return (
                    <div key={label} className="mt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 min-h-[28px]">
                        <b className="text-sm">{label}</b>
                        {groupBusy ? (
                          <span className="flex items-center gap-2 text-xs text-[#A47E3B]"><span className="ats-spin" />Adding {l.length} skills to your CV…</span>
                        ) : (
                          <button onClick={() => applyAts({ skills: l })} disabled={atsApplying} className="ats-btn text-xs font-semibold text-[#A47E3B]">
                            I have all of these: add all<span className="ats-finger">👆</span>
                          </button>
                        )}
                      </div>
                      <ul className="mt-1 space-y-1.5">
                        {l.map((sk) => {
                          const busy = atsAdding.includes(sk);
                          return (
                            <li key={sk} className={`relative flex items-center justify-between gap-2 border rounded-md px-3 py-1.5 text-sm transition-colors ${busy ? "border-[#A47E3B] bg-[#FBF6EC]" : "border-[#E3E8EF]"}`}>
                              {busy && <span className="absolute inset-0 overflow-hidden rounded-md pointer-events-none"><span className="ats-shimmer" /></span>}
                              <span className="relative">{sk}</span>
                              {busy ? (
                                <span className="relative flex items-center gap-2 text-xs text-[#A47E3B]"><span className="ats-spin" />Adding to your CV…</span>
                              ) : (
                                <button onClick={() => applyAts({ skills: [sk] })} disabled={atsApplying} className="ats-btn text-xs font-semibold text-[#A47E3B]">
                                  I have this: add to CV<span className="ats-finger">👆</span>
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
                {ats.skills.listed_only?.length > 0 && (
                  <div className="mt-4">
                    <b className="text-sm">Listed, but not shown in your experience</b>
                    <p className="text-xs text-[#5B6B7F]">Add a bullet that shows how you used the skill to earn full credit.</p>
                    <ul className="mt-1 space-y-1.5">
                      {ats.skills.listed_only.map((sk) => (
                        <li key={sk} className={`relative border rounded-md px-3 py-1.5 text-sm ${bulletSkill === sk ? "border-[#A47E3B] bg-[#FBF6EC]" : "border-[#E3E8EF]"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span>{sk}</span>
                            {bulletSkill !== sk && (
                              <button onClick={() => openBullet(sk)} className="ats-btn text-xs font-semibold text-[#A47E3B]">
                                Add a bullet<span className="ats-finger">👆</span>
                              </button>
                            )}
                          </div>
                          {bulletSkill === sk && (
                            <div className="mt-2 space-y-2">
                              {bulletTargets.length === 0 ? (
                                <p className="text-xs text-[#5B6B7F]">Save at least one job or project first, then come back.</p>
                              ) : (
                                <>
                                  <select value={bf.target} onChange={(e) => setBf({ ...bf, target: e.target.value })} className="w-full border border-[#E3E8EF] rounded-md p-2 text-sm bg-white">
                                    {bulletTargets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                                  </select>
                                  <textarea value={bf.did} onChange={(e) => setBf({ ...bf, did: e.target.value })} rows={2}
                                    placeholder={`What did you do with ${sk}? e.g. built nightly data pipelines for sales reports`}
                                    className="w-full border border-[#E3E8EF] rounded-md p-2 text-sm" />
                                  <input value={bf.result} onChange={(e) => setBf({ ...bf, result: e.target.value })}
                                    placeholder="Result or number (optional, only if true)" className="w-full border border-[#E3E8EF] rounded-md p-2 text-sm" />
                                  {bfBusy === "drafting" ? (
                                    <div className="relative overflow-hidden rounded-md border border-[#A47E3B] bg-[#FBF6EC] px-3 py-2 text-xs text-[#A47E3B] flex items-center gap-2">
                                      <span className="absolute inset-0 pointer-events-none"><span className="ats-shimmer" /></span>
                                      <span className="ats-spin" /><span className="relative">Writing your bullet…</span>
                                    </div>
                                  ) : (
                                    <button onClick={draftBullet} disabled={bf.did.trim().length < 8} className="ats-btn text-xs font-semibold text-[#A47E3B] border border-[#A47E3B]">
                                      {bf.draft ? "Rewrite" : "Write my bullet"}<span className="ats-finger">👆</span>
                                    </button>
                                  )}
                                  {bf.draft && (
                                    <div className="ats-pop w-full">
                                      <textarea value={bf.draft} onChange={(e) => setBf({ ...bf, draft: e.target.value })} rows={2}
                                        className="w-full border border-[#A47E3B] rounded-md p-2 text-sm" />
                                      <div className="mt-1 flex items-center gap-3">
                                        {bfBusy === "saving" ? (
                                          <span className="flex items-center gap-2 text-xs text-[#A47E3B]"><span className="ats-spin" />Adding to your CV…</span>
                                        ) : (
                                          <button onClick={saveBullet} className="ats-btn text-xs font-semibold bg-[#A47E3B] text-white">Add to CV<span className="ats-finger">👆</span></button>
                                        )}
                                        <span className="text-xs text-[#5B6B7F]">Edit it first if anything isn't accurate.</span>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                              <button onClick={() => setBulletSkill(null)} className="text-xs text-[#5B6B7F] underline">Cancel</button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ats.weak_bullets?.length > 0 && (
                  <div className="mt-4">
                    <b className="text-sm">Bullets that could be stronger</b>
                    <p className="text-xs text-[#5B6B7F]">Click Improve to rewrite one. Nothing changes until you approve it.</p>
                    <ul className="mt-1 space-y-1.5">
                      {ats.weak_bullets.map((x) => {
                        const open = rwKey === rwId(x);
                        return (
                          <li key={rwId(x)} className={`relative border rounded-md px-3 py-2 text-sm ${open ? "border-[#A47E3B] bg-[#FBF6EC]" : "border-[#E3E8EF]"}`}>
                            <p>“{x.text}”</p>
                            <p className="text-[11px] text-[#5B6B7F]">{x.where}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {x.issues.map((i) => <span key={i} className="rounded-full bg-[#F1F4F8] text-[#5B6B7F] text-[11px] px-2 py-0.5">{i}</span>)}
                            </div>
                            {!open && (
                              <button onClick={() => openRewrite(x)} className="ats-btn mt-1 text-xs font-semibold text-[#A47E3B]">
                                Improve<span className="ats-finger">👆</span>
                              </button>
                            )}
                            {open && (
                              <div className="mt-2 space-y-2">
                                {x.issues.some((i) => i.includes("measurable")) && (
                                  <input value={rw.result} onChange={(e) => setRw({ ...rw, result: e.target.value })}
                                    placeholder="A real result or number to include (optional, only if true)"
                                    className="w-full border border-[#E3E8EF] rounded-md p-2 text-sm bg-white" />
                                )}
                                {rwBusy === "drafting" ? (
                                  <div className="relative overflow-hidden rounded-md border border-[#A47E3B] bg-[#FBF6EC] px-3 py-2 text-xs text-[#A47E3B] flex items-center gap-2">
                                    <span className="absolute inset-0 pointer-events-none"><span className="ats-shimmer" /></span>
                                    <span className="ats-spin" /><span className="relative">Rewriting your bullet…</span>
                                  </div>
                                ) : (
                                  <button onClick={() => draftRewrite(x)} className="ats-btn text-xs font-semibold text-[#A47E3B] border border-[#A47E3B]">
                                    {rw.draft ? "Rewrite again" : "Rewrite bullet"}<span className="ats-finger">👆</span>
                                  </button>
                                )}
                                {rw.draft && (
                                  <div className="ats-pop w-full">
                                    <p className="text-[11px] text-[#5B6B7F]">Rewritten (edit if needed)</p>
                                    <textarea value={rw.draft} onChange={(e) => setRw({ ...rw, draft: e.target.value })} rows={2}
                                      className="w-full border border-[#A47E3B] rounded-md p-2 text-sm bg-white" />
                                    {rw.engine === "template" && <p className="text-[11px] text-[#A47E3B]">AI is off, so this is a basic rewrite. Add GEMINI_API_KEY for better ones.</p>}
                                    <div className="mt-1 flex items-center gap-3">
                                      {rwBusy === "saving" ? (
                                        <span className="flex items-center gap-2 text-xs text-[#A47E3B]"><span className="ats-spin" />Updating your CV…</span>
                                      ) : (
                                        <button onClick={() => replaceBullet(x)} className="ats-btn text-xs font-semibold bg-[#A47E3B] text-white">Replace bullet<span className="ats-finger">👆</span></button>
                                      )}
                                      <button onClick={() => setRwKey(null)} className="text-xs text-[#5B6B7F] underline">Cancel</button>
                                    </div>
                                  </div>
                                )}
                                {!rw.draft && <button onClick={() => setRwKey(null)} className="text-xs text-[#5B6B7F] underline">Cancel</button>}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {ats.title_mismatch && ats.job_title && (
                  <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 border border-[#E3E8EF] rounded-md px-3 py-2 text-sm">
                    <span>Headline doesn't match the job title “{ats.job_title}”.</span>
                    {atsAdding.includes("__headline") ? (
                      <span className="flex items-center gap-2 text-xs text-[#A47E3B]"><span className="ats-spin" />Updating headline…</span>
                    ) : (
                      <button onClick={() => applyAts({ headline: ats.job_title })} disabled={atsApplying} className="ats-btn text-xs font-semibold text-[#A47E3B]">
                        Set my headline to this<span className="ats-finger">👆</span>
                      </button>
                    )}
                  </div>
                )}
                {ats.skills.required_missing.length + ats.skills.preferred_missing.length > 0 && (
                  <p className="mt-2 text-xs text-[#5B6B7F]">Only add skills you really have. A listed skill earns 70%; add a bullet in your experience that uses it to earn full credit.</p>
                )}
                {ats.tips.length > 0 && (
                  <ul className="mt-3 list-disc pl-5 text-sm text-[#1B2A41] space-y-1">{ats.tips.filter((t) => !t.startsWith("Your headline/roles")).map((t) => <li key={t}>{t}</li>)}</ul>
                )}
                {ats.engine_note && <p className="mt-3 text-xs text-[#A47E3B]">{ats.engine_note}</p>}
                <p className="mt-3 text-xs text-[#5B6B7F]">{ats.note}</p>
              </div>
            )}
          </section>
      </main>
    </div>
  );
}
