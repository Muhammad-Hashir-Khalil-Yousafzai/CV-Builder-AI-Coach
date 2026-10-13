import FunLoader from "../components/common/FunLoader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import { cacheGet, cacheSet } from "../lib/cache";
import { useAuth } from "../context/AuthContext";
import { TemplatePicker, CvDocument, CV_TEMPLATES, buildWordHtml } from "./CvTemplates";

// Wherever <JobMatches /> is mounted in your router — change this one
// line if your route is named differently (e.g. "/jobs").
const JOB_MATCHES_ROUTE = "/job-matches";

const emptyEducation = { institute: "", degree: "", start_year: "", end_year: "", description: "" };
const emptyExperience = { company: "", role: "", start_date: "", end_date: "", is_current: false, description: "" };
const emptySkill = { name: "", level: "intermediate" };
const emptyProject = { title: "", description: "", link: "" };
const emptyCertification = { title: "", issuer: "", year: "" };

const SECTIONS = [
  { key: "basics", label: "Basic info" },
  { key: "education", label: "Education" },
  { key: "experience", label: "Experience" },
  { key: "skills", label: "Skills" },
  { key: "projects", label: "Projects" },
  { key: "certifications", label: "Certifications" },
  { key: "templates", label: "Templates" },
];

const normalizeUrl = (value) => {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

function parseFieldErrors(data) {
  if (!data || typeof data !== "object") return {};
  const out = {};
  Object.entries(data).forEach(([field, messages]) => {
    out[field] = Array.isArray(messages) ? messages.join(" ") : String(messages);
  });
  return out;
}

function topLevelMessage(data) {
  if (!data || typeof data !== "object") return "Something went wrong.";
  if (data.detail) return String(data.detail);
  if (data.non_field_errors) {
    return Array.isArray(data.non_field_errors) ? data.non_field_errors.join(" ") : String(data.non_field_errors);
  }
  const [field, messages] = Object.entries(data)[0] || [];
  if (!field) return "Something went wrong.";
  const label = field.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  const text = Array.isArray(messages) ? messages.join(" ") : String(messages);
  return `${label}: ${text}`;
}

/**
 * Scales its children down (never up) to fit the width of its parent,
 * and reports the resulting height so the outer wrapper doesn't leave
 * blank space below the scaled content. Used for the live CV preview
 * inside the Download panel, where available width varies a lot
 * between phone / iPad / desktop.
 */
function ScaledPreview({ children, className = "" }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const recalc = () => {
      const outerWidth = outer.clientWidth;
      const naturalWidth = inner.scrollWidth || outerWidth;
      const nextScale = naturalWidth ? Math.min(1, outerWidth / naturalWidth) : 1;
      setScale(nextScale || 1);
      setHeight(inner.scrollHeight * (nextScale || 1));
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div
      ref={outerRef}
      className={`w-full relative overflow-hidden ${className}`}
      style={{ height: height || undefined }}
    >
      <div
        ref={innerRef}
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          width: "max-content",
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function makeErrors(data) {
  return {
    basics: {},
    education: (data.education || []).map(() => ({})),
    experience: (data.experience || []).map(() => ({})),
    skills: (data.skills || []).map(() => ({})),
    projects: (data.projects || []).map(() => ({})),
    certifications: (data.certifications || []).map(() => ({})),
  };
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const cacheKey = `${user?.email || ""}:profile`;
  const [cv, setCvRaw] = useState(() => cacheGet(cacheKey) || null);
  const touchedRef = useRef(false); // true once the user (or a save) has changed the CV on this page
  const setCv = useCallback((v) => {
    touchedRef.current = true;
    setCvRaw(v);
  }, []);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [errors, setErrors] = useState(() =>
    makeErrors(cacheGet(cacheKey) || {})
  );

  // Show the cached CV instantly (if any), then always fetch the fresh one.
  // The fresh copy is only swapped in if nothing has been edited in the meantime.
  useEffect(() => {
    api
      .get("/profile/me/")
      .then((res) => {
        cacheSet(cacheKey, res.data);
        if (touchedRef.current) return;
        setCvRaw(res.data);
        setErrors(makeErrors(res.data));
      })
      .catch(() => {});
  }, []);

  // Lock body scroll whenever an overlay (drawer / preview) is open.
  useEffect(() => {
    const locked = drawerOpen || previewOpen;
    document.body.style.overflow = locked ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen, previewOpen]);

  const completion = useMemo(() => {
    if (!cv) return {};
    return {
      basics: Boolean(cv.headline && cv.summary),
      education: (cv.education || []).length > 0,
      experience: (cv.experience || []).length > 0,
      skills: (cv.skills || []).length > 0,
      projects: (cv.projects || []).length > 0,
      certifications: (cv.certifications || []).length > 0,
      templates: Boolean(cv.template),
    };
  }, [cv]);

  if (!cv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F5F7]"><FunLoader title="Loading your CV" /></div>
    );
  }

  const saveTopLevel = async () => {
    setSaving(true);
    try {
      const { full_name, headline, phone, address, date_of_birth, summary, linkedin_url, github_url, portfolio_url } = cv;
      const { data } = await api.patch("/profile/me/", {
        full_name,
        headline,
        phone,
        address,
        date_of_birth: date_of_birth || null,
        summary,
        linkedin_url: normalizeUrl(linkedin_url),
        github_url: normalizeUrl(github_url),
        portfolio_url: normalizeUrl(portfolio_url),
      });
      setCv({ ...cv, ...data });
      setErrors((prev) => ({ ...prev, basics: {} }));
      toast.success("Profile saved");
    } catch (err) {
      const data = err.response?.data;
      setErrors((prev) => ({ ...prev, basics: parseFieldErrors(data) }));
      toast.error(topLevelMessage(data));
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append("photo", file);
    try {
      const { data } = await api.patch("/profile/me/", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCv({ ...cv, photo: data.photo });
      toast.success("Photo updated");
    } catch (err) {
      toast.error(topLevelMessage(err.response?.data) || "Photo upload failed");
    }
  };

  const importCv = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setImporting(true);
    try {
      let { data } = await api.post("/profile/import-cv/", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { import_warning, import_stats, ...profile } = data;
      data = profile;
      setCv(data);
      setErrors({
        basics: {},
        education: (data.education || []).map(() => ({})),
        experience: (data.experience || []).map(() => ({})),
        skills: (data.skills || []).map(() => ({})),
        projects: (data.projects || []).map(() => ({})),
        certifications: (data.certifications || []).map(() => ({})),
      });
      if (import_warning) toast.error(import_warning, { duration: 9000 });
      else {
        const added = import_stats ? Object.values(import_stats.added).reduce((a, b) => a + b, 0) : 0;
        const skipped = import_stats?.skipped || 0;
        toast.success(`Imported ${added} new item${added === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} already on your CV` : ""}. Please review.`, { duration: 6000 });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't import that file");
    } finally {
      setImporting(false);
    }
  };

  const chooseTemplate = async (templateId) => {
    const previous = cv.template;
    setCv((prev) => ({ ...prev, template: templateId }));
    setSavingTemplate(true);
    try {
      const { data } = await api.patch("/profile/me/", { template: templateId });
      setCv((prev) => ({ ...prev, ...data }));
    } catch (err) {
      setCv((prev) => ({ ...prev, template: previous }));
      toast.error(topLevelMessage(err.response?.data) || "Couldn't save template choice");
    } finally {
      setSavingTemplate(false);
    }
  };

  const addItem = (section, template) => {
    setCv({ ...cv, [section]: [...cv[section], { ...template, _new: true }] });
    setErrors((prev) => ({ ...prev, [section]: [...prev[section], {}] }));
  };

  const updateItem = (section, index, field, value) => {
    const items = [...cv[section]];
    items[index] = { ...items[index], [field]: value };
    setCv({ ...cv, [section]: items });
  };

  const saveItem = async (section, index) => {
    const item = cv[section][index];
    const { _new, id, ...payload } = item;

    ["start_date", "end_date"].forEach((field) => {
      if (field in payload && payload[field] === "") payload[field] = null;
    });
    if ("link" in payload) payload.link = normalizeUrl(payload.link);

    try {
      const endpoint = `/profile/${section}/`;
      const { data } = _new
        ? await api.post(endpoint, payload)
        : await api.patch(`${endpoint}${id}/`, payload);
      const items = [...cv[section]];
      items[index] = data;
      setCv({ ...cv, [section]: items });
      setErrors((prev) => {
        const arr = [...prev[section]];
        arr[index] = {};
        return { ...prev, [section]: arr };
      });
      toast.success("Entry saved");
    } catch (err) {
      const data = err.response?.data;
      setErrors((prev) => {
        const arr = [...prev[section]];
        arr[index] = parseFieldErrors(data);
        return { ...prev, [section]: arr };
      });
      toast.error(topLevelMessage(data));
    }
  };

  const removeItem = async (section, index) => {
    const item = cv[section][index];
    if (!item._new) {
      try {
        await api.delete(`/profile/${section}/${item.id}/`);
      } catch {
        toast.error("Couldn't delete");
        return;
      }
    }
    setCv({ ...cv, [section]: cv[section].filter((_, i) => i !== index) });
    setErrors((prev) => ({ ...prev, [section]: prev[section].filter((_, i) => i !== index) }));
  };

  const filledCount = Object.values(completion).filter(Boolean).length;
  const activeTemplate = cv.template || CV_TEMPLATES[0].id;

  // A rough "is this CV substantial enough to match against" check —
  // a name/headline plus at least skills and one of education/experience.
  const readyForMatches =
    completion.basics && completion.skills && (completion.experience || completion.education);

  const goToJobMatches = () => {
    if (!readyForMatches) {
      toast.error("Add your skills and at least one role or degree first");
      return;
    }
    navigate(JOB_MATCHES_ROUTE);
  };

  // Shared sidebar content — rendered as a sticky column on tablet/desktop
  // (md and up) and inside a slide-over drawer on phones, so the markup
  // stays identical in both layouts.
  const sidebarContent = (
    <>
      <div className="flex items-center gap-3">
        <div className="relative group shrink-0">
          <img
            src={cv.photo || "https://placehold.co/72x72?text=CV"}
            alt="Profile"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover ring-2 ring-white shadow-sm"
          />
          <label className="absolute inset-0 rounded-full bg-[#1B2A41]/0 group-hover:bg-[#1B2A41]/60 flex items-center justify-center text-[10px] text-white opacity-0 group-hover:opacity-100 cursor-pointer transition">
            Change
            <input type="file" accept="image/*" onChange={uploadPhoto} className="hidden" />
          </label>
        </div>
        <div className="min-w-0">
          <p className="font-serif text-base sm:text-lg leading-tight truncate">{cv.full_name || user.email}</p>
          {cv.full_name && <p className="text-xs text-[#9AA6B2] truncate">{user.email}</p>}
          <button onClick={logout} className="text-xs text-[#8A6529] hover:text-[#6B4E1D] font-medium py-1">
            Log out
          </button>
        </div>
      </div>

      <nav className="mt-8 space-y-1">
        {SECTIONS.map((s) => (
          <a
            key={s.key}
            href={`#${s.key}`}
            onClick={() => setDrawerOpen(false)}
            className="flex items-center justify-between rounded-md px-3 py-2.5 min-h-[44px] text-sm text-[#3E4C5E] hover:bg-white hover:text-[#1B2A41] transition"
          >
            <span>{s.label}</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                completion[s.key] ? "bg-[#A47E3B]" : "border border-[#C4CCD4]"
              }`}
            />
          </a>
        ))}
      </nav>

      <div className="mt-8 pt-6 border-t border-[#DDE3E8]">
        <p className="text-xs text-[#5B6B7F]">
          {filledCount} of {SECTIONS.length} sections started
        </p>
        <div className="mt-2 h-1 w-full rounded-full bg-[#DDE3E8] overflow-hidden">
          <div
            className="h-full bg-[#A47E3B] transition-all"
            style={{ width: `${(filledCount / SECTIONS.length) * 100}%` }}
          />
        </div>
      </div>

      <button
        onClick={() => {
          setDrawerOpen(false);
          setPreviewOpen(true);
        }}
        className="mt-6 w-full text-sm font-medium text-white bg-[#1B2A41] hover:bg-[#12283F] rounded-md py-3 transition"
      >
        Preview & download
      </button>

      <button
        onClick={() => {
          setDrawerOpen(false);
          goToJobMatches();
        }}
        className="mt-2.5 w-full text-sm font-medium text-[#8A6529] border border-[#DDE3E8] hover:border-[#A47E3B] rounded-md py-3 transition"
      >
        View job matches
      </button>

      <button
        onClick={() => {
          setDrawerOpen(false);
          navigate("/ats");
        }}
        className="mt-2.5 w-full text-sm font-medium text-[#8A6529] border border-[#DDE3E8] hover:border-[#A47E3B] rounded-md py-3 transition"
      >
        ATS score &amp; CV improvement
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F3F5F7] text-[#1B2A41]">
      {/* ---------------- Phone top bar (< md, i.e. below tablet) ---------------- */}
      <header className="md:hidden mx-3 mt-3 rounded-xl overflow-hidden bg-white border border-[#DDE3E8] shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={cv.photo || "https://placehold.co/40x40?text=CV"}
              alt=""
              className="w-9 h-9 rounded-full object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="font-serif text-sm leading-tight truncate">{cv.full_name || "Your CV"}</p>
              <p className="text-[11px] text-[#9AA6B2]">
                {filledCount}/{SECTIONS.length} sections
              </p>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open section menu"
            className="h-11 w-11 shrink-0 rounded-md border border-[#DDE3E8] flex items-center justify-center text-[#3E4C5E] hover:border-[#C4CCD4] transition touch-manipulation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
        {/* Thin progress line under the bar */}
        <div className="h-0.5 bg-[#EEF0F2]">
          <div
            className="h-full bg-[#A47E3B] transition-all"
            style={{ width: `${(filledCount / SECTIONS.length) * 100}%` }}
          />
        </div>
      </header>

      {/* ---------------- Phone drawer (< md) ---------------- */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-[#1B2A41]/60"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-0 h-full w-[300px] max-w-[85vw] bg-[#F3F5F7] shadow-2xl overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="font-serif text-lg">Menu</p>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="h-11 w-11 rounded-md border border-[#DDE3E8] flex items-center justify-center text-[#3E4C5E] touch-manipulation"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto md:flex md:items-start md:gap-8 lg:gap-10 px-4 sm:px-6 md:px-6 py-6 sm:py-10 pb-28 md:pb-10">
        {/* ---------------- Tablet/desktop sidebar (md and up) ---------------- */}
        <aside className="hidden md:block md:w-56 lg:w-64 md:sticky md:top-24 shrink-0">{sidebarContent}</aside>

        {/* ---------------- Main content ---------------- */}
        <main className="flex-1 min-w-0 space-y-6 sm:space-y-10">
          <header>
            <h1 className="font-serif text-2xl sm:text-3xl">Your CV</h1>
            <p className="text-sm text-[#5B6B7F] mt-1">
              Keep this up to date — it's what recruiters see first.
            </p>
          </header>

          {readyForMatches && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-lg border border-[#DDE3E8] p-5 sm:p-6">
              <div>
                <p className="text-sm font-medium text-[#1B2A41]">Your CV is ready to match</p>
                <p className="text-sm text-[#5B6B7F] mt-0.5">
                  See roles ranked against your skills and experience.
                </p>
              </div>
              <button onClick={goToJobMatches} className="btn-primary shrink-0 w-full sm:w-auto">
                View job matches
              </button>
            </div>
          )}

          {/* --- Import old CV --- */}
          <label className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-lg border border-dashed border-[#A47E3B] p-4 cursor-pointer">
            <div>
              <p className="font-semibold text-[#1B2A41]">Import from an old CV</p>
              <p className="text-sm text-[#5B6B7F]">Upload a PDF or Word file and we'll fill in your profile automatically.</p>
            </div>
            <span className="btn-primary shrink-0 text-center">{importing ? "Importing…" : "Upload PDF / Word"}</span>
            <input type="file" accept=".pdf,.docx" onChange={importCv} disabled={importing} className="hidden" />
          </label>

          {/* --- Basic info --- */}
          <section id="basics" className="bg-white rounded-lg border border-[#DDE3E8] p-5 sm:p-7 space-y-5 scroll-mt-20 md:scroll-mt-10">
            <SectionHeading title="Basic info" subtitle="Your headline and how people can reach you" />

            <Field label="Full name" error={errors.basics.full_name}>
              <input
                className="field"
                placeholder="e.g. Jane Doe"
                value={cv.full_name || ""}
                onChange={(e) => setCv({ ...cv, full_name: e.target.value })}
              />
              <span className="block text-[11px] text-[#9AA6B2] mt-1">
                This is the name shown as the title of your CV. Your email is only listed as a contact detail.
              </span>
            </Field>

            <Field label="Headline" error={errors.basics.headline}>
              <input
                className="field"
                placeholder="e.g. Full-Stack Developer"
                value={cv.headline || ""}
                onChange={(e) => setCv({ ...cv, headline: e.target.value })}
              />
            </Field>

            <Field label="Summary" error={errors.basics.summary}>
              <textarea
                className="field resize-none"
                rows={4}
                placeholder="A short introduction — what you do and what you're looking for"
                value={cv.summary || ""}
                onChange={(e) => setCv({ ...cv, summary: e.target.value })}
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
              <Field label="Phone" error={errors.basics.phone}>
                <input className="field" value={cv.phone || ""} onChange={(e) => setCv({ ...cv, phone: e.target.value })} />
              </Field>
              <Field label="Address" error={errors.basics.address}>
                <input className="field" value={cv.address || ""} onChange={(e) => setCv({ ...cv, address: e.target.value })} />
              </Field>
              <Field label="Date of birth" error={errors.basics.date_of_birth}>
                <input
                  className="field"
                  type="date"
                  value={cv.date_of_birth || ""}
                  onChange={(e) => setCv({ ...cv, date_of_birth: e.target.value })}
                />
              </Field>
              <Field label="LinkedIn" error={errors.basics.linkedin_url}>
                <input
                  className="field"
                  placeholder="linkedin.com/in/…"
                  value={cv.linkedin_url || ""}
                  onChange={(e) => setCv({ ...cv, linkedin_url: e.target.value })}
                />
              </Field>
              <Field label="GitHub" error={errors.basics.github_url}>
                <input
                  className="field"
                  placeholder="github.com/…"
                  value={cv.github_url || ""}
                  onChange={(e) => setCv({ ...cv, github_url: e.target.value })}
                />
              </Field>
              <Field label="Portfolio" error={errors.basics.portfolio_url}>
                <input
                  className="field"
                  placeholder="yoursite.com"
                  value={cv.portfolio_url || ""}
                  onChange={(e) => setCv({ ...cv, portfolio_url: e.target.value })}
                />
              </Field>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={saveTopLevel} disabled={saving} className="btn-primary w-full sm:w-auto min-h-[44px]">
                {saving ? "Saving…" : "Save profile"}
              </button>
            </div>
          </section>

          {/* --- Education --- */}
          <Section
            id="education"
            title="Education"
            subtitle="Degrees, diplomas, and certifications from school"
            items={cv.education}
            errors={errors.education}
            onAdd={() => addItem("education", emptyEducation)}
            onRemove={(i) => removeItem("education", i)}
            onSave={(i) => saveItem("education", i)}
            emptyLabel="No education added yet."
            summary={(item) => item.institute || "New entry"}
            render={(item, i, itemErrors) => (
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
                <Field label="Institute" error={itemErrors.institute}>
                  <input className="field" value={item.institute}
                    onChange={(e) => updateItem("education", i, "institute", e.target.value)} />
                </Field>
                <Field label="Degree" error={itemErrors.degree}>
                  <input className="field" value={item.degree}
                    onChange={(e) => updateItem("education", i, "degree", e.target.value)} />
                </Field>
                <Field label="Start year" error={itemErrors.start_year}>
                  <input className="field" type="number" value={item.start_year}
                    onChange={(e) => updateItem("education", i, "start_year", e.target.value)} />
                </Field>
                <Field label="End year" error={itemErrors.end_year}>
                  <input className="field" type="number" placeholder="Present" value={item.end_year || ""}
                    onChange={(e) => updateItem("education", i, "end_year", e.target.value)} />
                </Field>
              </div>
            )}
          />

          {/* --- Experience --- */}
          <Section
            id="experience"
            title="Experience"
            subtitle="Roles you've held, most recent first"
            items={cv.experience}
            errors={errors.experience}
            onAdd={() => addItem("experience", emptyExperience)}
            onRemove={(i) => removeItem("experience", i)}
            onSave={(i) => saveItem("experience", i)}
            emptyLabel="No experience added yet."
            summary={(item) => (item.role && item.company ? `${item.role} · ${item.company}` : "New entry")}
            render={(item, i, itemErrors) => (
              <>
                <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
                  <Field label="Company" error={itemErrors.company}>
                    <input className="field" value={item.company}
                      onChange={(e) => updateItem("experience", i, "company", e.target.value)} />
                  </Field>
                  <Field label="Role" error={itemErrors.role}>
                    <input className="field" value={item.role}
                      onChange={(e) => updateItem("experience", i, "role", e.target.value)} />
                  </Field>
                  <Field label="Start date" error={itemErrors.start_date}>
                    <input className="field" type="date" value={item.start_date}
                      onChange={(e) => updateItem("experience", i, "start_date", e.target.value)} />
                  </Field>
                  <Field label="End date" error={itemErrors.end_date}>
                    <input
                      className="field disabled:bg-[#F3F5F7] disabled:text-[#9AA6B2]"
                      type="date"
                      value={item.end_date || ""}
                      disabled={item.is_current}
                      onChange={(e) => updateItem("experience", i, "end_date", e.target.value)}
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2.5 text-sm text-[#3E4C5E] py-1">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-[#C4CCD4] text-[#A47E3B] focus:ring-[#A47E3B]"
                    checked={item.is_current}
                    onChange={(e) => updateItem("experience", i, "is_current", e.target.checked)}
                  />
                  I currently work here
                </label>
              </>
            )}
          />

          {/* --- Skills --- */}
          <Section
            id="skills"
            title="Skills"
            subtitle="Tools and technologies, rated by proficiency"
            items={cv.skills}
            errors={errors.skills}
            onAdd={() => addItem("skills", emptySkill)}
            onRemove={(i) => removeItem("skills", i)}
            onSave={(i) => saveItem("skills", i)}
            emptyLabel="No skills added yet."
            summary={(item) => item.name || "New entry"}
            render={(item, i, itemErrors) => (
              <div className="grid sm:grid-cols-[1fr_180px] gap-4 sm:gap-5">
                <Field label="Skill name" error={itemErrors.name}>
                  <input className="field" value={item.name}
                    onChange={(e) => updateItem("skills", i, "name", e.target.value)} />
                </Field>
                <Field label="Level" error={itemErrors.level}>
                  <select className="field" value={item.level}
                    onChange={(e) => updateItem("skills", i, "level", e.target.value)}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </Field>
              </div>
            )}
          />

          {/* --- Projects --- */}
          <Section
            id="projects"
            title="Projects"
            subtitle="Things you've built, with a link if there is one"
            items={cv.projects}
            errors={errors.projects}
            onAdd={() => addItem("projects", emptyProject)}
            onRemove={(i) => removeItem("projects", i)}
            onSave={(i) => saveItem("projects", i)}
            emptyLabel="No projects added yet."
            summary={(item) => item.title || "New entry"}
            render={(item, i, itemErrors) => (
              <>
                <Field label="Title" error={itemErrors.title}>
                  <input className="field" value={item.title}
                    onChange={(e) => updateItem("projects", i, "title", e.target.value)} />
                </Field>
                <Field label="Description" error={itemErrors.description}>
                  <textarea className="field resize-none" rows={3} value={item.description}
                    onChange={(e) => updateItem("projects", i, "description", e.target.value)} />
                </Field>
                <Field label="Link" error={itemErrors.link}>
                  <input className="field" placeholder="https://…" value={item.link}
                    onChange={(e) => updateItem("projects", i, "link", e.target.value)} />
                </Field>
              </>
            )}
          />

          {/* --- Certifications --- */}
          <Section
            id="certifications"
            title="Certifications"
            subtitle="Courses and credentials you've earned"
            items={cv.certifications}
            errors={errors.certifications}
            onAdd={() => addItem("certifications", emptyCertification)}
            onRemove={(i) => removeItem("certifications", i)}
            onSave={(i) => saveItem("certifications", i)}
            emptyLabel="No certifications added yet."
            summary={(item) => item.title || "New entry"}
            render={(item, i, itemErrors) => (
              <div className="grid sm:grid-cols-[1fr_1fr_120px] gap-4 sm:gap-5">
                <Field label="Title" error={itemErrors.title}>
                  <input className="field" value={item.title}
                    onChange={(e) => updateItem("certifications", i, "title", e.target.value)} />
                </Field>
                <Field label="Issuer" error={itemErrors.issuer}>
                  <input className="field" value={item.issuer}
                    onChange={(e) => updateItem("certifications", i, "issuer", e.target.value)} />
                </Field>
                <Field label="Year" error={itemErrors.year}>
                  <input className="field" type="number" value={item.year || ""}
                    onChange={(e) => updateItem("certifications", i, "year", e.target.value)} />
                </Field>
              </div>
            )}
          />

          {/* --- ATS & CV improvement now lives on its own page --- */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-lg border border-[#DDE3E8] p-5 sm:p-6">
            <div>
              <p className="text-sm font-medium text-[#1B2A41]">Improve your CV and check your ATS score</p>
              <p className="text-sm text-[#5B6B7F] mt-0.5">Paste a job description to see how well your CV matches it, with one-click fixes.</p>
            </div>
            <button
              onClick={() => navigate("/ats")}
              className="shrink-0 text-sm font-medium text-white bg-[#1B2A41] hover:bg-[#12283F] rounded-md px-5 py-3 min-h-[44px] transition"
            >
              Open ATS &amp; CV Improvement
            </button>
          </div>

          {/* --- Templates --- */}
          <section id="templates" className="bg-white rounded-lg border border-[#DDE3E8] p-5 sm:p-7 space-y-5 scroll-mt-20 md:scroll-mt-10">
            <SectionHeading title="Templates" subtitle="Pick the layout your CV downloads and prints as" />
            <TemplatePicker selected={activeTemplate} onSelect={chooseTemplate} />
            {savingTemplate && <p className="text-xs text-[#9AA6B2]">Saving…</p>}
            <div className="flex justify-end pt-2">
              <button onClick={() => setPreviewOpen(true)} className="btn-primary w-full sm:w-auto min-h-[44px]">
                Preview & download
              </button>
            </div>
          </section>
        </main>
      </div>

      {/* ---------------- Phone sticky action bar (< md) ---------------- */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-[#DDE3E8] px-4 pt-3 flex gap-2.5"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={goToJobMatches}
          className="flex-1 min-h-[44px] text-sm font-medium text-[#8A6529] border border-[#DDE3E8] rounded-md transition touch-manipulation"
        >
          Job matches
        </button>
        <button
          onClick={() => setPreviewOpen(true)}
          className="flex-1 min-h-[44px] text-sm font-medium text-white bg-[#1B2A41] hover:bg-[#12283F] rounded-md transition touch-manipulation"
        >
          Preview & download
        </button>
      </div>

      {previewOpen && (
        <CvPreviewModal cv={cv} user={user} templateId={activeTemplate} onClose={() => setPreviewOpen(false)} />
      )}

      <style>{`
        .field {
          width: 100%;
          border: 1px solid #DDE3E8;
          border-radius: 6px;
          padding: 0.65rem 0.75rem;
          font-size: 1rem;
          background: #FCFCFB;
          color: #1B2A41;
          transition: border-color 0.15s, box-shadow 0.15s;
          touch-action: manipulation;
        }
        /* 16px font prevents iOS/Android auto-zoom on focus. Keep this
           touch-safe size on phones AND tablets (iPad included); only
           shrink it on genuine desktop widths (lg and up). */
        @media (min-width: 1024px) {
          .field { font-size: 0.875rem; padding: 0.55rem 0.75rem; }
        }
        .field:focus {
          outline: none;
          border-color: #A47E3B;
          box-shadow: 0 0 0 3px rgba(164, 126, 59, 0.15);
          background: #fff;
        }
        .btn-primary {
          background: #1B2A41;
          color: #fff;
          font-size: 0.875rem;
          font-weight: 500;
          padding: 0.6rem 1.25rem;
          border-radius: 6px;
          transition: background 0.15s;
          touch-action: manipulation;
        }
        .btn-primary:hover:not(:disabled) { background: #12283F; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

const FONT_OPTIONS = [
  { label: "Serif (Default)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Modern Sans", value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { label: "Classic Sans", value: "Arial, Helvetica, sans-serif" },
  { label: "Classic Serif", value: "'Times New Roman', Times, serif" },
  { label: "Monospace", value: "'Courier New', Courier, monospace" },
];

const ACCENT_SWATCHES = ["#1B2A41", "#A47E3B", "#2F6F4F", "#822D2D", "#3E4C5E"];

const FORMAT_OPTIONS = [
  { label: "PDF", value: "pdf" },
  { label: "Word (.doc)", value: "doc" },
  { label: "PNG", value: "png" },
  { label: "JPG", value: "jpg" },
  { label: "HTML", value: "html" },
];

const ALIGN_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
  { label: "Justify", value: "justify" },
];

function CvPreviewModal({ cv, user, templateId, onClose }) {
  const [activeTemplate, setActiveTemplate] = useState(templateId);
  const [panelOpen, setPanelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [format, setFormat] = useState("pdf");
  const [accentColor, setAccentColor] = useState("#1B2A41");
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [lineHeight, setLineHeight] = useState(1.5);
  const [pageMargin, setPageMargin] = useState(32);
  const [textAlign, setTextAlign] = useState("left");
  const [headingAlign, setHeadingAlign] = useState("left");
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [pdfPageCount, setPdfPageCount] = useState("single");
  const [pdfPageSize, setPdfPageSize] = useState("a4");
  const [includePhoto, setIncludePhoto] = useState(Boolean(cv.photo));
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);

  const previewRef = useRef(null);
  const captureRef = useRef(null);

  const docStyleProps = { accent: accentColor, fontFamily, lineHeight, textAlign, headingAlign, letterSpacing, includePhoto: includePhoto && Boolean(cv.photo) };

  const handleExport = async () => {
    if (!captureRef.current) return;
    setExporting(true);
    try {
      const { saveAs } = await import("file-saver");
      if (format === "html") {
        const inner = captureRef.current.innerHTML;
        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>CV</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:${fontFamily};line-height:${lineHeight};padding:${pageMargin}px;margin:0;text-align:${textAlign};letter-spacing:${letterSpacing}px;}</style>
</head>
<body>${inner}</body>
</html>`;
        saveAs(new Blob([html], { type: "text/html" }), "cv.html");
      } else if (format === "doc") {
        const html = buildWordHtml(cv, user, {
          templateId: activeTemplate,
          accent: accentColor,
          fontFamily,
          lineHeight,
          textAlign,
          headingAlign,
          letterSpacing,
          includePhoto: includePhoto && Boolean(cv.photo),
        });
        saveAs(new Blob(["\ufeff", html], { type: "application/msword" }), "cv.doc");
      } else {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }

        const node = captureRef.current;
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          letterRendering: true,
          windowWidth: node.scrollWidth,
          windowHeight: node.scrollHeight,
        });

        if (format === "png" || format === "jpg") {
          canvas.toBlob(
            (blob) => {
              if (blob) saveAs(blob, format === "png" ? "cv.png" : "cv.jpg");
            },
            format === "png" ? "image/png" : "image/jpeg",
            0.95
          );
        } else {
          const imgData = canvas.toDataURL("image/png");
          const pageFormat = pdfPageSize === "letter" ? "letter" : "a4";
          const { default: jsPDF } = await import("jspdf");
          const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: pageFormat });
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();

          if (pdfPageCount === "single") {
            const scale = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
            const renderWidth = canvas.width * scale;
            const renderHeight = canvas.height * scale;
            const offsetX = (pdfWidth - renderWidth) / 2;
            const offsetY = (pdfHeight - renderHeight) / 2;
            pdf.addImage(imgData, "PNG", offsetX, offsetY, renderWidth, renderHeight);
          } else {
            const renderWidth = pdfWidth;
            const renderHeight = (canvas.height * pdfWidth) / canvas.width;
            let heightLeft = renderHeight;
            let position = 0;
            pdf.addImage(imgData, "PNG", 0, position, renderWidth, renderHeight);
            heightLeft -= pdfHeight;
            while (heightLeft > 0) {
              position -= pdfHeight;
              pdf.addPage();
              pdf.addImage(imgData, "PNG", 0, position, renderWidth, renderHeight);
              heightLeft -= pdfHeight;
            }
          }
          pdf.save("cv.pdf");
        }
      }
      toast.success("Download ready");
      setPanelOpen(false);
    } catch (err) {
      toast.error("Export failed — please try again");
    } finally {
      setExporting(false);
    }
  };

  const livePreview = (
    <div
      ref={previewRef}
      className="cv-print-area shadow-xl mx-auto bg-white"
      style={{ padding: `${pageMargin}px`, lineHeight, fontFamily, letterSpacing: `${letterSpacing}px`, maxWidth: "100%" }}
    >
      <CvDocument cv={cv} user={user} templateId={activeTemplate} {...docStyleProps} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#1B2A41]/60 flex flex-col">
      {/* Header: template chips scroll horizontally; actions shrink on small screens */}
      <div className="no-print flex items-center justify-between gap-3 bg-white border-b border-[#DDE3E8] px-3 sm:px-6 py-3">
        <div className="flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CV_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTemplate(t.id)}
              className={`shrink-0 text-xs font-medium rounded-full px-3 py-1.5 min-h-[36px] border transition touch-manipulation ${
                activeTemplate === t.id
                  ? "bg-[#1B2A41] text-white border-[#1B2A41]"
                  : "text-[#3E4C5E] border-[#DDE3E8] hover:border-[#C4CCD4]"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button onClick={() => setPanelOpen(true)} className="btn-primary whitespace-nowrap">
            Download
          </button>
          <button onClick={onClose} aria-label="Close preview"
            className="lg:hidden h-10 w-10 rounded-md border border-[#DDE3E8] flex items-center justify-center text-[#3E4C5E] touch-manipulation">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <button onClick={onClose} className="hidden lg:block text-sm text-[#5B6B7F] hover:text-[#1B2A41]">
            Close
          </button>
        </div>
      </div>

      {!panelOpen && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 sm:py-10 px-3 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <ScaledPreview>{livePreview}</ScaledPreview>
          </div>
        </div>
      )}

      {panelOpen && (
        <div
          className="no-print fixed inset-0 z-[60] bg-[#0B1420]/70 flex items-end lg:items-center justify-center lg:p-6"
          onClick={() => !exporting && setPanelOpen(false)}
        >
          {/* Phone/iPad-portrait: full-screen sheet, stacked.
              Landscape iPad and desktop (lg+): centered 2-pane dialog. */}
          <div
            className="bg-white w-full lg:max-w-5xl lg:h-[82vh] h-full lg:rounded-xl shadow-2xl flex flex-col lg:flex-row overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview pane — capped height when stacked so settings stay reachable,
                and the CV itself scales to fit whatever width it's given. */}
            <div className="flex-1 bg-[#EDEFF2] overflow-y-auto p-4 sm:p-6 lg:p-8 flex justify-center min-h-[40vh] lg:min-h-0">
              <div className="w-full max-w-3xl self-start">
                <ScaledPreview>{livePreview}</ScaledPreview>
              </div>
            </div>

            {/* Settings pane */}
            <div className="w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#EEF0F2] flex flex-col flex-1 lg:flex-none min-h-0">
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[#EEF0F2] flex items-center justify-between">
                <h3 className="font-serif text-lg text-[#1B2A41]">Download</h3>
                <span className="text-xs text-[#9AA6B2]">
                  {FORMAT_OPTIONS.find((f) => f.value === format)?.label}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
                <PanelRow label="Format">
                  <select className="field" value={format} onChange={(e) => setFormat(e.target.value)}>
                    {FORMAT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </PanelRow>

                {format === "pdf" && (
                  <PanelRow label="Page count">
                    <select className="field" value={pdfPageCount} onChange={(e) => setPdfPageCount(e.target.value)}>
                      <option value="single">1 (fit to page)</option>
                      <option value="multi">Auto (multi-page)</option>
                    </select>
                  </PanelRow>
                )}

                <PanelRow label="Alignment">
                  <div className="flex items-center gap-1.5">
                    {ALIGN_OPTIONS.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        title={a.label}
                        onClick={() => setTextAlign(a.value)}
                        className={`h-10 w-10 lg:h-8 lg:w-8 rounded border text-[13px] flex items-center justify-center transition touch-manipulation ${
                          textAlign === a.value
                            ? "bg-[#1B2A41] text-white border-[#1B2A41]"
                            : "text-[#3E4C5E] border-[#DDE3E8] hover:border-[#C4CCD4]"
                        }`}
                      >
                        <AlignIcon value={a.value} />
                      </button>
                    ))}
                  </div>
                </PanelRow>

                <div className="border-t border-[#EEF0F2] pt-4">
                  <button
                    type="button"
                    onClick={() => setMoreSettingsOpen((v) => !v)}
                    className="w-full flex items-center justify-between text-sm font-medium text-[#1B2A41] min-h-[44px] touch-manipulation"
                  >
                    More settings
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`transition-transform ${moreSettingsOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {moreSettingsOpen && (
                    <div className="mt-5 space-y-5">
                      <PanelRow label="Include photo">
                        <label className="flex items-center gap-2 text-xs text-[#5B6B7F]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-[#C4CCD4] text-[#A47E3B] focus:ring-[#A47E3B]"
                            checked={includePhoto}
                            disabled={!cv.photo}
                            onChange={(e) => setIncludePhoto(e.target.checked)}
                          />
                          {cv.photo ? (includePhoto ? "Shown" : "Hidden") : "No photo uploaded"}
                        </label>
                      </PanelRow>

                      <PanelRow label="Accent color">
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {ACCENT_SWATCHES.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setAccentColor(c)}
                              className="h-8 w-8 lg:h-6 lg:w-6 rounded-full border-2 transition touch-manipulation"
                              style={{ backgroundColor: c, borderColor: accentColor === c ? "#1B2A41" : "transparent" }}
                              aria-label={`Use accent ${c}`}
                            />
                          ))}
                          <input
                            type="color"
                            value={accentColor}
                            onChange={(e) => setAccentColor(e.target.value)}
                            className="h-8 w-8 lg:h-6 lg:w-6 rounded border border-[#DDE3E8] cursor-pointer p-0"
                            aria-label="Custom accent color"
                          />
                        </div>
                      </PanelRow>

                      <PanelRow label="Font family">
                        <select className="field" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                          {FONT_OPTIONS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </PanelRow>

                      <PanelRow label="Heading alignment">
                        <select className="field" value={headingAlign} onChange={(e) => setHeadingAlign(e.target.value)}>
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </PanelRow>

                      <PanelRow label="Line spacing">
                        <div className="flex items-center gap-3 w-full max-w-[220px]">
                          <input
                            type="range"
                            min="1.2"
                            max="2.0"
                            step="0.1"
                            value={lineHeight}
                            onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                            className="w-full accent-[#A47E3B]"
                          />
                          <span className="text-xs text-[#5B6B7F] w-8 text-right shrink-0">
                            {lineHeight.toFixed(1)}
                          </span>
                        </div>
                      </PanelRow>

                      <PanelRow label="Letter spacing">
                        <div className="flex items-center gap-3 w-full max-w-[220px]">
                          <input
                            type="range"
                            min="-0.5"
                            max="2"
                            step="0.1"
                            value={letterSpacing}
                            onChange={(e) => setLetterSpacing(parseFloat(e.target.value))}
                            className="w-full accent-[#A47E3B]"
                          />
                          <span className="text-xs text-[#5B6B7F] w-8 text-right shrink-0">
                            {letterSpacing.toFixed(1)}
                          </span>
                        </div>
                      </PanelRow>

                      <PanelRow label="Page margin">
                        <div className="flex items-center gap-3 w-full max-w-[220px]">
                          <input
                            type="range"
                            min="16"
                            max="72"
                            step="1"
                            value={pageMargin}
                            onChange={(e) => setPageMargin(parseInt(e.target.value, 10))}
                            className="w-full accent-[#A47E3B]"
                          />
                          <span className="text-xs text-[#5B6B7F] w-10 text-right shrink-0">{pageMargin}px</span>
                        </div>
                      </PanelRow>

                      {format === "pdf" && pdfPageCount === "multi" && (
                        <PanelRow label="PDF page size">
                          <select className="field" value={pdfPageSize} onChange={(e) => setPdfPageSize(e.target.value)}>
                            <option value="a4">A4</option>
                            <option value="letter">US Letter</option>
                          </select>
                        </PanelRow>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-[#EEF0F2] px-5 sm:px-6 py-4 flex items-center justify-end gap-3"
                style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
              >
                <button
                  onClick={() => setPanelOpen(false)}
                  disabled={exporting}
                  className="text-sm font-medium text-[#3E4C5E] border border-[#DDE3E8] hover:border-[#C4CCD4] rounded-md px-4 py-2.5 min-h-[44px] transition disabled:opacity-50 touch-manipulation"
                >
                  Cancel
                </button>
                <button onClick={handleExport} disabled={exporting} className="btn-primary min-h-[44px]">
                  {exporting ? "Preparing…" : "Download"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen capture node — unchanged behaviour. */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: "-10000px",
          pointerEvents: "none",
          background: "#fff",
        }}
        aria-hidden="true"
      >
        <div
          ref={captureRef}
          className="cv-print-area bg-white"
          style={{ padding: `${pageMargin}px`, lineHeight, fontFamily, letterSpacing: `${letterSpacing}px` }}
        >
          <CvDocument cv={cv} user={user} templateId={activeTemplate} {...docStyleProps} />
        </div>
      </div>
    </div>
  );
}

function AlignIcon({ value }) {
  const lines = {
    left: ["0,0 14,0", "0,4 10,4", "0,8 14,8", "0,12 8,12"],
    center: ["1,0 13,0", "2,4 12,4", "0,8 14,8", "3,12 11,12"],
    right: ["0,0 14,0", "4,4 14,4", "0,8 14,8", "6,12 14,12"],
    justify: ["0,0 14,0", "0,4 14,4", "0,8 14,8", "0,12 14,12"],
  }[value];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      {lines.map((pts, i) => (
        <polyline key={i} points={pts} />
      ))}
    </svg>
  );
}

function PanelRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-[#3E4C5E] shrink-0">{label}</span>
      <div className="flex-1 flex justify-end min-w-0">{children}</div>
    </div>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div>
      <h2 className="font-serif text-xl">{title}</h2>
      {subtitle && <p className="text-sm text-[#5B6B7F] mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[#5B6B7F] mb-1.5">{label}</span>
      {children}
      {error && <span className="block text-xs text-[#A23B3B] mt-1">{error}</span>}
    </label>
  );
}

function Section({ id, title, subtitle, items, errors, onAdd, onRemove, onSave, render, emptyLabel, summary }) {
  return (
    <section id={id} className="bg-white rounded-lg border border-[#DDE3E8] p-5 sm:p-7 space-y-5 scroll-mt-20 md:scroll-mt-10">
      <div className="flex items-start justify-between gap-4">
        <SectionHeading title={title} subtitle={subtitle} />
        <button
          onClick={onAdd}
          className="shrink-0 text-sm font-medium text-[#8A6529] hover:text-[#6B4E1D] border border-[#DDE3E8] hover:border-[#A47E3B] rounded-md px-3 py-2 min-h-[40px] transition touch-manipulation"
        >
          + Add
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-[#9AA6B2] border border-dashed border-[#DDE3E8] rounded-md py-6 text-center">
          {emptyLabel}
        </p>
      )}

      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={item.id || `new-${i}`} className="border border-[#E6EAEE] rounded-md p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[#1B2A41] truncate">{summary(item)}</p>
              {item._new && (
                <span className="shrink-0 text-[11px] text-[#A47E3B] border border-[#A47E3B]/40 rounded-full px-2 py-0.5">
                  Unsaved
                </span>
              )}
            </div>

            <div className="space-y-4">{render(item, i, (errors && errors[i]) || {})}</div>

            <div className="flex gap-4 pt-1 border-t border-[#F0F2F4]">
              <button onClick={() => onSave(i)} className="text-sm font-medium text-[#2F6F4F] hover:text-[#20573B] py-2.5 min-h-[44px] touch-manipulation">
                Save entry
              </button>
              <button onClick={() => onRemove(i)} className="text-sm font-medium text-[#A23B3B] hover:text-[#822D2D] py-2.5 min-h-[44px] touch-manipulation">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}