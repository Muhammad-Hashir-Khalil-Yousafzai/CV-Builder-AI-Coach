// CvTemplates.jsx
// Template gallery (pick a look) + CvDocument (renders the user's CV data in that look).
// Drop this next to ProfilePage.jsx and adjust the import path if your folder layout differs.
// The second set of six templates lives in CvTemplates2.jsx and is merged into CV_TEMPLATES below.

import { CV_TEMPLATES_2, TemplateThumb2, CvDocument2, isTemplate2, buildWordHtml2 } from "./CvTemplates2";

const BASE_TEMPLATES = [
  {
    id: "ledger",
    name: "Ledger",
    blurb: "A single ruled column, serif headings, gold rules under each heading like an accountant's page. Suits traditional and corporate roles.",
    accent: "#A47E3B",
  },
  {
    id: "lattice",
    name: "Lattice",
    blurb: "Two columns with a dark sidebar for contact and skills, a grid-node marker before each heading. Built for engineering and technical roles.",
    accent: "#2F6F4F",
  },
  {
    id: "brief",
    name: "Brief",
    blurb: "One confident name treatment, generous margins, nothing else competing for attention. Quiet, restrained, and fast to scan.",
    accent: "#1B2A41",
  },
  {
    id: "folio",
    name: "Folio",
    blurb: "A single editorial column with a serif drop cap on the summary and skills set as flowing prose instead of tags. Suits creative, content, and design roles.",
    accent: "#B5563C",
  },
  {
    id: "meridian",
    name: "Meridian",
    blurb: "A connected timeline runs down the experience column with outlined skill pills. Suits consulting, product, and client-facing roles.",
    accent: "#3D5A80",
  },
  {
    id: "monogram",
    name: "Monogram",
    blurb: "A centered layout anchored by an initials mark, wide margins, and quiet rule dividers. Suits senior, executive, and academic roles.",
    accent: "#7A2E44",
  },
];

export const CV_TEMPLATES = [...BASE_TEMPLATES, ...CV_TEMPLATES_2];

/* ---------------------------------- helpers --------------------------------- */

function fmtMonthYear(value) {
  if (!value) return "";
  const parts = String(value).split("-");
  if (parts.length < 2) return value;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function fmtRange(start, end, current) {
  if (!start) return "";
  const s = fmtMonthYear(start);
  if (current) return `${s} – Present`;
  if (!end) return s;
  return `${s} – ${fmtMonthYear(end)}`;
}

function displayName(cv, user) {
  return cv?.full_name || user?.full_name || user?.name || user?.email || "Your Name";
}

function initials(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function bareUrl(url) {
  return url ? url.replace(/^https?:\/\//i, "").replace(/\/$/, "") : "";
}

// Renders the uploaded profile photo when the "Include photo" toggle is on; renders
// nothing otherwise (Lattice/Monogram fall back to their own initials mark instead).
// Shows a multi-line description as real bullets (one per line); a single line stays a paragraph.
function Description({ text, className = "", style }) {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.replace(/^[\s\u2022\-*\u2013]+/, "").trim())
    .filter(Boolean);
  if (lines.length <= 1) return <p className={className} style={style}>{lines[0] || ""}</p>;
  return (
    <ul className={`${className} list-disc pl-4 space-y-0.5`} style={style}>
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ul>
  );
}

function Avatar({ cv, includePhoto, size = 60, radius = "9999px" }) {
  if (!includePhoto || !cv.photo) return null;
  return (
    <img
      src={cv.photo}
      alt=""
      crossOrigin="anonymous"
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: radius,
        objectFit: "cover",
        display: "block",
      }}
    />
  );
}

function buildContactItems(cv, user) {
  return [
    { icon: IconMail, text: user?.email },
    { icon: IconPhone, text: cv.phone },
    { icon: IconPin, text: cv.address },
    { icon: IconLink, text: bareUrl(cv.linkedin_url) },
    { icon: IconCode, text: bareUrl(cv.github_url) },
    { icon: IconGlobe, text: bareUrl(cv.portfolio_url) },
  ];
}

/* ---------------------------------- icons ------------------------------------ */
// Minimal stroke glyphs, inline so this file has no extra dependencies.

const iconProps = {
  width: 12,
  height: 12,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const IconMail = (p) => (
  <svg {...iconProps} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
const IconPhone = (p) => (
  <svg {...iconProps} {...p}>
    <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 9 9 0 0 0 2.8.45 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.3a1 1 0 0 1 1 1 9 9 0 0 0 .45 2.8 1 1 0 0 1-.25 1Z" />
  </svg>
);
const IconPin = (p) => (
  <svg {...iconProps} {...p}>
    <path d="M19 10c0 5.5-7 11-7 11S5 15.5 5 10a7 7 0 0 1 14 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
const IconLink = (p) => (
  <svg {...iconProps} {...p}>
    <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.5-1.5" />
  </svg>
);
const IconCode = (p) => (
  <svg {...iconProps} {...p}>
    <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
  </svg>
);
const IconGlobe = (p) => (
  <svg {...iconProps} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" />
  </svg>
);

/* ------------------------------- contact row ---------------------------------- */
// iconStyle lets a template tint the glyphs with the live accent color via an
// inline style (which always wins over a class), instead of a static Tailwind color class.

function ContactRow({ items, className = "", iconClassName = "opacity-60 shrink-0", iconStyle }) {
  const visible = items.filter((it) => it.text);
  if (visible.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {visible.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5" style={{ lineHeight: 1 }}>
          {/* display:block removes the SVG's inline descender gap; verticalAlign is a
              second belt-and-braces fix for renderers (like html2canvas) that don't fully
              honor flex centering on inline-flex spans. */}
          <it.icon
            className={iconClassName}
            style={{ ...iconStyle, display: "block", verticalAlign: "middle", flexShrink: 0 }}
          />
          <span style={{ verticalAlign: "middle" }}>{it.text}</span>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------- thumbnails ---------------------------------- */

function TemplateThumb({ id, accent }) {
  if (isTemplate2(id)) return <TemplateThumb2 id={id} accent={accent} />;
  if (id === "lattice") {
    return (
      <div className="w-full h-24 rounded-md overflow-hidden border border-[#E6EAEE] flex">
        <div className="w-[36%] h-full bg-[#1B2A41] p-2.5 flex flex-col gap-1.5">
          <span className="h-2 w-2 self-start rotate-45" style={{ background: accent }} />
          <div className="h-1 w-4/5 rounded-sm bg-white/25 mt-0.5" />
          <div className="h-1 w-3/5 rounded-sm bg-white/15" />
        </div>
        <div className="flex-1 p-2.5 space-y-1.5">
          <div className="h-1.5 w-2/3 rounded-sm bg-[#DDE3E8]" />
          <div className="h-1 w-full rounded-sm bg-[#F0F2F4]" />
          <div className="h-1 w-5/6 rounded-sm bg-[#F0F2F4]" />
        </div>
      </div>
    );
  }
  if (id === "brief") {
    return (
      <div className="w-full h-24 rounded-md overflow-hidden border border-[#E6EAEE] p-3.5 flex flex-col justify-center gap-2.5">
        <div className="h-3 w-2/3 rounded-sm bg-[#1B2A41]" />
        <div className="h-1 w-1/3 rounded-sm bg-[#DDE3E8]" />
        <div className="mt-2 h-px w-full bg-[#1B2A41]" />
        <div className="flex gap-3">
          <div className="h-1 w-6 rounded-sm bg-[#C4CCD4]" />
          <div className="h-1 flex-1 rounded-sm bg-[#F0F2F4]" />
        </div>
      </div>
    );
  }
  if (id === "folio") {
    return (
      <div className="w-full h-24 rounded-md overflow-hidden border border-[#E6EAEE] p-3 flex gap-2.5">
        <div className="w-[3px] rounded-full shrink-0" style={{ background: accent }} />
        <div className="flex-1 space-y-2">
          <div className="h-2 w-2/3 rounded-sm bg-[#1B2A41]" />
          <div className="h-1 w-1/3 rounded-sm opacity-60" style={{ background: accent }} />
          <div className="flex gap-1.5 pt-1">
            <div className="h-4 w-4 rounded-sm shrink-0 opacity-85" style={{ background: accent }} />
            <div className="flex-1 space-y-1 pt-0.5">
              <div className="h-1 w-full rounded-sm bg-[#F0F2F4]" />
              <div className="h-1 w-4/5 rounded-sm bg-[#F0F2F4]" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (id === "meridian") {
    return (
      <div className="w-full h-24 rounded-md overflow-hidden border border-[#E6EAEE] p-3">
        <div className="h-2 w-1/2 rounded-sm bg-[#1B2A41] mb-1.5" />
        <div className="h-[2px] w-full rounded-full mb-2.5" style={{ background: accent }} />
        <div className="flex gap-2">
          <div className="flex flex-col items-center w-2 shrink-0 pt-0.5">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: accent }} />
            <span className="w-px flex-1 bg-[#DDE3E8] mt-1" />
            <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-1" style={{ background: accent }} />
          </div>
          <div className="flex-1 space-y-2.5">
            <div className="space-y-1">
              <div className="h-1 w-4/5 rounded-sm bg-[#F0F2F4]" />
              <div className="h-1 w-3/5 rounded-sm bg-[#F0F2F4]" />
            </div>
            <div className="space-y-1">
              <div className="h-1 w-4/5 rounded-sm bg-[#F0F2F4]" />
              <div className="h-1 w-2/5 rounded-sm bg-[#F0F2F4]" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (id === "monogram") {
    return (
      <div className="w-full h-24 rounded-md overflow-hidden border border-[#E6EAEE] p-3 flex flex-col items-center justify-center gap-1.5">
        <div className="h-6 w-6 rounded-full border-2" style={{ borderColor: accent }} />
        <div className="h-1.5 w-1/2 rounded-sm bg-[#1B2A41] mt-1" />
        <div className="h-1 w-1/3 rounded-sm bg-[#DDE3E8]" />
        <div className="flex items-center gap-1.5 pt-1">
          <span className="h-px w-4" style={{ background: accent }} />
          <span className="h-1 w-1 rotate-45" style={{ background: accent }} />
          <span className="h-px w-4" style={{ background: accent }} />
        </div>
      </div>
    );
  }
  // ledger (default)
  return (
    <div className="w-full h-24 rounded-md overflow-hidden border border-[#E6EAEE] p-3 space-y-1.5">
      <div className="h-2 w-1/2 rounded-sm bg-[#1B2A41]" />
      <div className="h-[2px] w-full" style={{ background: accent }} />
      <div className="grid grid-cols-3 gap-1.5 pt-1">
        <div className="h-1 rounded-sm bg-[#F0F2F4]" />
        <div className="h-1 rounded-sm bg-[#F0F2F4]" />
        <div className="h-1 rounded-sm bg-[#F0F2F4]" />
      </div>
      <div className="h-1 w-full rounded-sm bg-[#F0F2F4]" />
      <div className="h-1 w-3/4 rounded-sm bg-[#F0F2F4]" />
    </div>
  );
}

export function TemplatePicker({ selected, onSelect }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {CV_TEMPLATES.map((t) => {
        const isSelected = selected === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-pressed={isSelected}
            className={`relative text-left rounded-lg border p-4 transition ${
              isSelected
                ? "border-[#A47E3B] ring-2 ring-[#A47E3B]/20 bg-[#FBF8F2]"
                : "border-[#DDE3E8] hover:border-[#C4CCD4] bg-white"
            }`}
          >
            {isSelected && (
              <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-[#A47E3B] text-white flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            )}
            <TemplateThumb id={t.id} accent={t.accent} />
            <p className="mt-3 font-serif text-base text-[#1B2A41]">{t.name}</p>
            <p className="mt-1 text-xs text-[#5B6B7F] leading-relaxed">{t.blurb}</p>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------- Ledger -------------------------------- */
// Concept: a page from a ruled ledger book. Serif ink, a gold rule under every
// heading (the ruled line), figures set right and tabular like an amount column.

function LedgerDoc({ cv, user, accent, fontFamily, lineHeight, textAlign, headingAlign, letterSpacing, includePhoto }) {
  const contactItems = buildContactItems(cv, user);
  return (
    <div
      className="bg-white text-[#1B2A41] w-full max-w-[8.3in] mx-auto p-[0.75in] font-sans text-[13px]"
      style={{ fontFamily, lineHeight, textAlign, letterSpacing: `${letterSpacing || 0}px` }}
    >
      <header className="pb-5 border-b border-[#1B2A41] flex items-start gap-4">
        <Avatar cv={cv} includePhoto={includePhoto} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[33px] leading-tight tracking-tight">{displayName(cv, user)}</h1>
          {cv.headline && <p className="mt-1.5 text-[13.5px] text-[#5B6B7F]">{cv.headline}</p>}
          <ContactRow
            items={contactItems}
            className={`mt-3.5 text-[11.5px] text-[#5B6B7F] ${textAlign === "center" ? "justify-center" : textAlign === "right" ? "justify-end" : ""}`}
            iconClassName="opacity-70 shrink-0"
            iconStyle={{ color: accent }}
          />
        </div>
      </header>

      {cv.summary && (
        <section className="mt-6 break-inside-avoid">
          <p className="text-[13px] leading-relaxed text-[#3E4C5E]" style={{ lineHeight }}>
            {cv.summary}
          </p>
        </section>
      )}

      {cv.experience?.length > 0 && (
        <LedgerSection title="Experience" accent={accent} headingAlign={headingAlign}>
          {cv.experience.map((e, i) => (
            <div key={e.id || i} className="mb-4 last:mb-0 break-inside-avoid">
              <div className="flex justify-between items-baseline gap-4">
                <p className="text-[13.5px] font-semibold">
                  {e.role}
                  {e.company && <span className="font-normal text-[#5B6B7F]"> · {e.company}</span>}
                </p>
                <p className="text-[11px] text-[#8A96A3] whitespace-nowrap tabular-nums">
                  {fmtRange(e.start_date, e.end_date, e.is_current)}
                </p>
              </div>
              {e.description && <Description text={e.description} className="mt-1 text-[12px] text-[#3E4C5E] leading-relaxed" style={{ lineHeight }} />}
            </div>
          ))}
        </LedgerSection>
      )}

      {cv.education?.length > 0 && (
        <LedgerSection title="Education" accent={accent} headingAlign={headingAlign}>
          {cv.education.map((e, i) => (
            <div key={e.id || i} className="mb-3 last:mb-0 break-inside-avoid">
              <div className="flex justify-between items-baseline gap-4">
                <p className="text-[13.5px] font-semibold">
                  {e.degree}
                  {e.institute && <span className="font-normal text-[#5B6B7F]"> · {e.institute}</span>}
                </p>
                <p className="text-[11px] text-[#8A96A3] whitespace-nowrap tabular-nums">
                  {e.start_year}{e.end_year ? ` – ${e.end_year}` : ""}
                </p>
              </div>
              {e.description && <Description text={e.description} className="mt-1 text-[12px] text-[#3E4C5E] leading-relaxed" style={{ lineHeight }} />}
            </div>
          ))}
        </LedgerSection>
      )}

      {cv.projects?.length > 0 && (
        <LedgerSection title="Projects" accent={accent} headingAlign={headingAlign}>
          {cv.projects.map((p, i) => (
            <div key={p.id || i} className="mb-3 last:mb-0 break-inside-avoid">
              <p className="text-[13.5px] font-semibold">
                {p.title}
                {p.link && (
                  <span className="ml-2 text-[11px] font-normal" style={{ color: accent }}>
                    {bareUrl(p.link)}
                  </span>
                )}
              </p>
              {p.description && <Description text={p.description} className="mt-1 text-[12px] text-[#3E4C5E] leading-relaxed" style={{ lineHeight }} />}
            </div>
          ))}
        </LedgerSection>
      )}

      {cv.skills?.length > 0 && (
        <LedgerSection title="Skills" accent={accent} headingAlign={headingAlign}>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1">
            {cv.skills.map((s, i) => s.name && (
              <p key={s.id || i} className="text-[12px] text-[#3E4C5E]">{s.name}</p>
            ))}
          </div>
        </LedgerSection>
      )}

      {cv.certifications?.length > 0 && (
        <LedgerSection title="Certifications" accent={accent} headingAlign={headingAlign}>
          <div className="space-y-1.5">
            {cv.certifications.map((c, i) => (
              <div key={c.id || i} className="flex justify-between items-baseline gap-4">
                <p className="text-[12.5px]">
                  {c.title}
                  {c.issuer && <span className="text-[#8A96A3]"> — {c.issuer}</span>}
                </p>
                {c.year && <p className="text-[11px] text-[#8A96A3] tabular-nums">{c.year}</p>}
              </div>
            ))}
          </div>
        </LedgerSection>
      )}
    </div>
  );
}

function LedgerSection({ title, children, accent, headingAlign }) {
  return (
    <section className="mt-7 break-inside-avoid-page">
      <h2 className="font-serif text-[15px] text-[#1B2A41]" style={{ textAlign: headingAlign }}>{title}</h2>
      {/* Was border-[#A47E3B]/70 — the slash-opacity arbitrary color broke html2canvas exports. */}
      <div className="mt-1.5 border-b-2" style={{ borderColor: accent, opacity: 0.7 }} />
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* -------------------------------- Lattice -------------------------------- */
// Concept: a structural grid. A diamond "node" marks each heading, contact and
// skills live in a dark sidebar column, dates set in mono like data points.

function LatticeDoc({ cv, user, accent, fontFamily, lineHeight, textAlign, headingAlign, letterSpacing, includePhoto }) {
  const contactItems = buildContactItems(cv, user);
  const name = displayName(cv, user);
  const showPhoto = includePhoto && cv.photo;
  return (
    <div
      className="bg-white text-[#1B2A41] w-full max-w-[8.3in] mx-auto flex font-sans min-h-[11in] text-[13px]"
      style={{ fontFamily, lineHeight, letterSpacing: `${letterSpacing || 0}px` }}
    >
      <aside className="w-[2.65in] bg-[#1B2A41] text-white p-8 flex flex-col gap-8" style={{ textAlign }}>
        <div className="flex items-center gap-3">
          {showPhoto ? (
            <Avatar cv={cv} includePhoto size={44} />
          ) : (
            <div
              className="h-11 w-11 shrink-0 rounded-full text-white font-serif font-semibold flex items-center justify-center text-sm"
              style={{ background: accent }}
            >
              {initials(name)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-serif text-lg leading-tight truncate">{name}</h1>
            {cv.headline && <p className="text-[11px] text-[#9FB0C3] mt-0.5 truncate">{cv.headline}</p>}
          </div>
        </div>

        <div className="space-y-2 text-[11px] text-[#C3CDDA]">
          {contactItems.filter((c) => c.text).map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <c.icon className="opacity-60 shrink-0" />
              <span className="break-all">{c.text}</span>
            </div>
          ))}
        </div>

        {cv.skills?.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-[#8FA3B8] mb-2.5">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {cv.skills.map((s, i) => s.name && (
                // Was bg-white/10 — replaced with an explicit rgba() so html2canvas never
                // has to parse a Tailwind slash-opacity color function.
                <span
                  key={s.id || i}
                  className="text-[10.5px] px-2 py-1 rounded-[4px] text-[#E6EAEE]"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {cv.certifications?.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-[#8FA3B8] mb-2.5">Certifications</p>
            <div className="space-y-2.5">
              {cv.certifications.map((c, i) => (
                <div key={c.id || i} className="text-[11px] text-[#C3CDDA]">
                  <p className="font-medium text-white">{c.title}</p>
                  <p>{[c.issuer, c.year].filter(Boolean).join(" · ")}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 p-8 space-y-7" style={{ textAlign }}>
        {cv.summary && (
          <p className="text-[12.5px] leading-relaxed text-[#3E4C5E] break-inside-avoid" style={{ lineHeight }}>
            {cv.summary}
          </p>
        )}

        {cv.experience?.length > 0 && (
          <LatticeSection title="Experience" accent={accent} headingAlign={headingAlign}>
            {cv.experience.map((e, i) => (
              <div key={e.id || i} className="mb-5 last:mb-0 break-inside-avoid">
                <div className="flex justify-between items-baseline gap-4">
                  <p className="text-[13px] font-semibold">{e.role}</p>
                  <p className="text-[10.5px] text-[#9AA6B2] whitespace-nowrap tabular-nums font-mono">
                    {fmtRange(e.start_date, e.end_date, e.is_current)}
                  </p>
                </div>
                {e.company && (
                  <p className="text-[11.5px] font-medium mt-0.5" style={{ color: accent }}>
                    {e.company}
                  </p>
                )}
                {e.description && <Description text={e.description} className="mt-1.5 text-[12px] text-[#3E4C5E] leading-relaxed" style={{ lineHeight }} />}
              </div>
            ))}
          </LatticeSection>
        )}

        {cv.projects?.length > 0 && (
          <LatticeSection title="Projects" accent={accent} headingAlign={headingAlign}>
            {cv.projects.map((p, i) => (
              <div key={p.id || i} className="mb-4 last:mb-0 break-inside-avoid">
                <p className="text-[13px] font-semibold">
                  {p.title}
                  {p.link && (
                    <span className="ml-2 text-[10.5px] font-normal font-mono" style={{ color: accent }}>
                      {bareUrl(p.link)}
                    </span>
                  )}
                </p>
                {p.description && <Description text={p.description} className="mt-1.5 text-[12px] text-[#3E4C5E] leading-relaxed" style={{ lineHeight }} />}
              </div>
            ))}
          </LatticeSection>
        )}

        {cv.education?.length > 0 && (
          <LatticeSection title="Education" accent={accent} headingAlign={headingAlign}>
            {cv.education.map((e, i) => (
              <div key={e.id || i} className="mb-4 last:mb-0 break-inside-avoid">
                <div className="flex justify-between items-baseline gap-4">
                  <p className="text-[13px] font-semibold">{e.degree}</p>
                  <p className="text-[10.5px] text-[#9AA6B2] whitespace-nowrap tabular-nums font-mono">
                    {e.start_year}{e.end_year ? `–${e.end_year}` : ""}
                  </p>
                </div>
                {e.institute && <p className="text-[11.5px] text-[#5B6B7F] mt-0.5">{e.institute}</p>}
              </div>
            ))}
          </LatticeSection>
        )}
      </main>
    </div>
  );
}

function LatticeSection({ title, children, accent, headingAlign }) {
  return (
    <section className="break-inside-avoid-page">
      <h2 className="flex items-center gap-2.5 text-[12.5px] font-semibold text-[#1B2A41]" style={{ justifyContent: headingAlign === "center" ? "center" : headingAlign === "right" ? "flex-end" : "flex-start" }}>
        <span className="h-[7px] w-[7px] rotate-45 border-2 shrink-0" style={{ borderColor: accent }} />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* --------------------------------- Brief ---------------------------------- */
// Concept: restraint. One name treatment, one ink color, dates set apart in a
// quiet left column so the eye can scan years without re-reading each line.

function BriefDoc({ cv, user, accent, fontFamily, lineHeight, textAlign, headingAlign, letterSpacing, includePhoto }) {
  const contactItems = buildContactItems(cv, user);
  return (
    <div
      className="bg-white text-[#1B2A41] w-full max-w-[8.3in] mx-auto p-[1in] font-sans text-[13px]"
      style={{ fontFamily, lineHeight, textAlign, letterSpacing: `${letterSpacing || 0}px` }}
    >
      <header className="pb-6 border-b flex items-start gap-5" style={{ borderColor: accent }}>
        <Avatar cv={cv} includePhoto={includePhoto} size={72} radius="6px" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[44px] leading-[1.05] tracking-tight">{displayName(cv, user)}</h1>
          {cv.headline && <p className="mt-3 text-[15px] text-[#5B6B7F]">{cv.headline}</p>}
          <ContactRow
            items={contactItems}
            className={`mt-5 text-[11.5px] text-[#5B6B7F] ${textAlign === "center" ? "justify-center" : textAlign === "right" ? "justify-end" : ""}`}
            iconClassName="opacity-50 shrink-0"
          />
        </div>
      </header>

      {cv.summary && (
        <p className="mt-8 text-[13.5px] leading-loose text-[#3E4C5E] max-w-[6in] break-inside-avoid" style={{ lineHeight }}>
          {cv.summary}
        </p>
      )}

      {cv.experience?.length > 0 && (
        <BriefSection title="Experience" headingAlign={headingAlign}>
          {cv.experience.map((e, i) => (
            <div key={e.id || i} className="mb-6 last:mb-0 grid grid-cols-[1.3in_1fr] gap-5 break-inside-avoid">
              <p className="text-[11px] text-[#9AA6B2] pt-0.5 tabular-nums">
                {fmtRange(e.start_date, e.end_date, e.is_current)}
              </p>
              <div>
                <p className="text-[13.5px] font-semibold">{e.role}</p>
                {e.company && <p className="text-[12px] text-[#5B6B7F] mt-0.5">{e.company}</p>}
                {e.description && <Description text={e.description} className="mt-1.5 text-[12px] text-[#3E4C5E] leading-relaxed" style={{ lineHeight }} />}
              </div>
            </div>
          ))}
        </BriefSection>
      )}

      {cv.projects?.length > 0 && (
        <BriefSection title="Projects" headingAlign={headingAlign}>
          {cv.projects.map((p, i) => (
            <div key={p.id || i} className="mb-5 last:mb-0 grid grid-cols-[1.3in_1fr] gap-5 break-inside-avoid">
              <p className="text-[11px] text-[#9AA6B2] pt-0.5">{p.link ? bareUrl(p.link) : ""}</p>
              <div>
                <p className="text-[13.5px] font-semibold">{p.title}</p>
                {p.description && <Description text={p.description} className="mt-1.5 text-[12px] text-[#3E4C5E] leading-relaxed" style={{ lineHeight }} />}
              </div>
            </div>
          ))}
        </BriefSection>
      )}

      {cv.education?.length > 0 && (
        <BriefSection title="Education" headingAlign={headingAlign}>
          {cv.education.map((e, i) => (
            <div key={e.id || i} className="mb-4 last:mb-0 grid grid-cols-[1.3in_1fr] gap-5 break-inside-avoid">
              <p className="text-[11px] text-[#9AA6B2] pt-0.5 tabular-nums">
                {e.start_year}{e.end_year ? ` – ${e.end_year}` : ""}
              </p>
              <div>
                <p className="text-[13.5px] font-semibold">{e.degree}</p>
                {e.institute && <p className="text-[12px] text-[#5B6B7F] mt-0.5">{e.institute}</p>}
              </div>
            </div>
          ))}
        </BriefSection>
      )}

      {(cv.skills?.length > 0 || cv.certifications?.length > 0) && (
        <BriefSection title="Skills & certifications" headingAlign={headingAlign}>
          <div className="grid grid-cols-[1.3in_1fr] gap-5">
            <div />
            <p className="text-[12px] text-[#3E4C5E] leading-relaxed" style={{ lineHeight }}>
              {[...(cv.skills || []).map((s) => s.name), ...(cv.certifications || []).map((c) => c.title)]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        </BriefSection>
      )}
    </div>
  );
}

function BriefSection({ title, children, headingAlign }) {
  return (
    <section className="mt-10 break-inside-avoid-page">
      <h2 className="text-[11px] text-[#9AA6B2]" style={{ textAlign: headingAlign }}>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* --------------------------------- Folio ---------------------------------- */
// Concept: a magazine profile page. A serif drop cap opens the summary, an
// accent spine runs the height of the header, and skills read as prose, not tags.

function FolioSection({ title, children, accent, headingAlign }) {
  return (
    <section className="mt-8 break-inside-avoid-page">
      <h2 className="flex items-center gap-2 font-serif italic text-[15px] text-[#1B2A41]" style={{ justifyContent: headingAlign === "center" ? "center" : headingAlign === "right" ? "flex-end" : "flex-start" }}>
        <span className="h-[5px] w-[5px] rounded-full shrink-0" style={{ backgroundColor: accent }} />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FolioDoc({ cv, user, accent, fontFamily, lineHeight, textAlign, headingAlign, letterSpacing, includePhoto }) {
  const contactItems = buildContactItems(cv, user);
  const summary = cv.summary || "";
  const dropCap = summary.charAt(0);
  const restOfSummary = summary.slice(1);

  return (
    <div
      className="bg-white text-[#1B2A41] w-full max-w-[8.3in] mx-auto p-[0.85in] font-sans text-[13px]"
      style={{ fontFamily, lineHeight, letterSpacing: `${letterSpacing || 0}px` }}
    >
      <header className="flex items-start gap-5 pb-6">
        <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: accent }} />
        <Avatar cv={cv} includePhoto={includePhoto} size={64} radius="6px" />
        <div className="min-w-0 flex-1" style={{ textAlign }}>
          <h1 className="font-serif text-[36px] leading-[1.05] tracking-tight">{displayName(cv, user)}</h1>
          {cv.headline && (
            <p className="mt-2 font-serif italic text-[15px]" style={{ color: accent }}>
              {cv.headline}
            </p>
          )}
        </div>
      </header>

      <div className="pl-6" style={{ textAlign }}>
        <ContactRow
          items={contactItems}
          className={`pb-6 text-[11.5px] text-[#5B6B7F] border-b border-[#E6EAEE] ${textAlign === "center" ? "justify-center" : textAlign === "right" ? "justify-end" : ""}`}
          iconClassName="opacity-60 shrink-0"
          iconStyle={{ color: accent }}
        />

        {summary && (
          <p className="mt-7 text-[14px] leading-loose text-[#3E4C5E] max-w-[6.1in] break-inside-avoid" style={{ lineHeight }}>
            <span
              className="float-left font-serif text-[46px] leading-[0.75] pr-2.5 pt-1"
              style={{ color: accent }}
            >
              {dropCap}
            </span>
            {restOfSummary}
          </p>
        )}

        {cv.experience?.length > 0 && (
          <FolioSection title="Experience" accent={accent} headingAlign={headingAlign}>
            {cv.experience.map((e, i) => (
              <div key={e.id || i} className="mb-5 last:mb-0 break-inside-avoid">
                <div className="flex justify-between items-baseline gap-4 flex-wrap">
                  <p className="text-[13.5px] font-semibold">{e.role}</p>
                  <p className="text-[11px] text-[#9AA6B2] whitespace-nowrap tabular-nums">
                    {fmtRange(e.start_date, e.end_date, e.is_current)}
                  </p>
                </div>
                {e.company && (
                  <p className="font-serif italic text-[12.5px] mt-0.5" style={{ color: accent }}>
                    {e.company}
                  </p>
                )}
                {e.description && <Description text={e.description} className="mt-1.5 text-[12px] text-[#3E4C5E] leading-relaxed max-w-[6.1in]" style={{ lineHeight }} />}
              </div>
            ))}
          </FolioSection>
        )}

        {cv.projects?.length > 0 && (
          <FolioSection title="Projects" accent={accent} headingAlign={headingAlign}>
            {cv.projects.map((p, i) => (
              <div key={p.id || i} className="mb-4 last:mb-0 break-inside-avoid">
                <p className="text-[13.5px] font-semibold">
                  {p.title}
                  {p.link && (
                    <span className="ml-2 text-[11px] font-normal font-serif italic" style={{ color: accent }}>
                      {bareUrl(p.link)}
                    </span>
                  )}
                </p>
                {p.description && <Description text={p.description} className="mt-1.5 text-[12px] text-[#3E4C5E] leading-relaxed max-w-[6.1in]" style={{ lineHeight }} />}
              </div>
            ))}
          </FolioSection>
        )}

        {cv.education?.length > 0 && (
          <FolioSection title="Education" accent={accent} headingAlign={headingAlign}>
            {cv.education.map((e, i) => (
              <div key={e.id || i} className="mb-4 last:mb-0 break-inside-avoid">
                <div className="flex justify-between items-baseline gap-4 flex-wrap">
                  <p className="text-[13.5px] font-semibold">{e.degree}</p>
                  <p className="text-[11px] text-[#9AA6B2] whitespace-nowrap tabular-nums">
                    {e.start_year}{e.end_year ? ` – ${e.end_year}` : ""}
                  </p>
                </div>
                {e.institute && (
                  <p className="font-serif italic text-[12.5px] mt-0.5" style={{ color: accent }}>
                    {e.institute}
                  </p>
                )}
                {e.description && <Description text={e.description} className="mt-1.5 text-[12px] text-[#3E4C5E] leading-relaxed max-w-[6.1in]" style={{ lineHeight }} />}
              </div>
            ))}
          </FolioSection>
        )}

        {cv.skills?.length > 0 && (
          <FolioSection title="Skills" accent={accent} headingAlign={headingAlign}>
            <p className="text-[12.5px] text-[#3E4C5E] leading-relaxed max-w-[6.1in]" style={{ lineHeight }}>
              {cv.skills.map((s) => s.name).filter(Boolean).join(", ")}
            </p>
          </FolioSection>
        )}

        {cv.certifications?.length > 0 && (
          <FolioSection title="Certifications" accent={accent} headingAlign={headingAlign}>
            <div className="space-y-2">
              {cv.certifications.map((c, i) => (
                <div key={c.id || i} className="flex justify-between items-baseline gap-4">
                  <p className="text-[12.5px]">
                    {c.title}
                    {c.issuer && <span className="text-[#8A96A3]">, {c.issuer}</span>}
                  </p>
                  {c.year && <p className="text-[11px] text-[#9AA6B2] tabular-nums shrink-0">{c.year}</p>}
                </div>
              ))}
            </div>
          </FolioSection>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Meridian -------------------------------- */
// Concept: a route across a career. Experience reads as a connected timeline —
// a line and node for every stop — since that content is genuinely a sequence.

function MeridianDoc({ cv, user, accent, fontFamily, lineHeight, textAlign, headingAlign, letterSpacing, includePhoto }) {
  const contactItems = buildContactItems(cv, user);
  return (
    <div
      className="bg-white text-[#1B2A41] w-full max-w-[8.3in] mx-auto p-[0.8in] font-sans text-[13px]"
      style={{ fontFamily, lineHeight, textAlign, letterSpacing: `${letterSpacing || 0}px` }}
    >
      <header className="pb-6 flex items-start gap-4">
        <Avatar cv={cv} includePhoto={includePhoto} size={58} />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[32px] leading-tight tracking-tight">{displayName(cv, user)}</h1>
          {cv.headline && <p className="mt-1.5 text-[13.5px] text-[#5B6B7F]">{cv.headline}</p>}
          <ContactRow
            items={contactItems}
            className={`mt-3.5 text-[11.5px] text-[#5B6B7F] ${textAlign === "center" ? "justify-center" : textAlign === "right" ? "justify-end" : ""}`}
            iconClassName="opacity-70 shrink-0"
            iconStyle={{ color: accent }}
          />
        </div>
      </header>
      <div className="mt-5 h-[3px] w-full rounded-full" style={{ backgroundColor: accent }} />

      {cv.summary && (
        <p className="mt-6 text-[13px] leading-relaxed text-[#3E4C5E] break-inside-avoid" style={{ lineHeight }}>
          {cv.summary}
        </p>
      )}

      {cv.experience?.length > 0 && (
        <section className="mt-8 break-inside-avoid-page">
          <h2 className="text-[15px] font-serif text-[#1B2A41] mb-4" style={{ textAlign: headingAlign }}>Experience</h2>
          <div>
            {cv.experience.map((e, i, arr) => (
              <div key={e.id || i} className="flex gap-4 break-inside-avoid">
                <div className="flex flex-col items-center w-2.5 shrink-0 pt-1.5">
                  <span className="h-[7px] w-[7px] rounded-full shrink-0" style={{ backgroundColor: accent }} />
                  {i < arr.length - 1 && <span className="flex-1 w-px mt-1.5 bg-[#DDE3E8]" />}
                </div>
                <div className="flex-1 pb-6 last:pb-0">
                  <div className="flex justify-between items-baseline gap-4 flex-wrap">
                    <p className="text-[13.5px] font-semibold">{e.role}</p>
                    <p className="text-[11px] text-[#9AA6B2] whitespace-nowrap tabular-nums">
                      {fmtRange(e.start_date, e.end_date, e.is_current)}
                    </p>
                  </div>
                  {e.company && (
                    <p className="text-[12px] font-medium mt-0.5" style={{ color: accent }}>
                      {e.company}
                    </p>
                  )}
                  {e.description && <Description text={e.description} className="mt-1.5 text-[12px] text-[#3E4C5E] leading-relaxed" style={{ lineHeight }} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {cv.projects?.length > 0 && (
        <section className="mt-8 break-inside-avoid-page">
          <h2 className="text-[15px] font-serif text-[#1B2A41] mb-4" style={{ textAlign: headingAlign }}>Projects</h2>
          <div className="space-y-4">
            {cv.projects.map((p, i) => (
              <div key={p.id || i} className="break-inside-avoid">
                <p className="text-[13px] font-semibold">
                  {p.title}
                  {p.link && (
                    <span className="ml-2 text-[11px] font-normal" style={{ color: accent }}>
                      {bareUrl(p.link)}
                    </span>
                  )}
                </p>
                {p.description && <Description text={p.description} className="mt-1 text-[12px] text-[#3E4C5E] leading-relaxed" style={{ lineHeight }} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {cv.education?.length > 0 && (
        <section className="mt-8 break-inside-avoid-page">
          <h2 className="text-[15px] font-serif text-[#1B2A41] mb-4" style={{ textAlign: headingAlign }}>Education</h2>
          <div className="space-y-3">
            {cv.education.map((e, i) => (
              <div key={e.id || i} className="flex justify-between items-baseline gap-4 flex-wrap break-inside-avoid">
                <div>
                  <p className="text-[13px] font-semibold">{e.degree}</p>
                  {e.institute && <p className="text-[12px] text-[#5B6B7F] mt-0.5">{e.institute}</p>}
                </div>
                <p className="text-[11px] text-[#9AA6B2] whitespace-nowrap tabular-nums">
                  {e.start_year}{e.end_year ? `–${e.end_year}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {cv.skills?.length > 0 && (
        <section className="mt-8 break-inside-avoid-page">
          <h2 className="text-[15px] font-serif text-[#1B2A41] mb-4" style={{ textAlign: headingAlign }}>Skills</h2>
          <div className={`flex flex-wrap gap-2 ${textAlign === "center" ? "justify-center" : textAlign === "right" ? "justify-end" : ""}`}>
            {cv.skills.map((s, i) => s.name && (
              <span
                key={s.id || i}
                className="text-[11px] px-2.5 py-1 rounded-full border"
                style={{ borderColor: accent, color: accent }}
              >
                {s.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {cv.certifications?.length > 0 && (
        <section className="mt-8 break-inside-avoid-page">
          <h2 className="text-[15px] font-serif text-[#1B2A41] mb-4" style={{ textAlign: headingAlign }}>Certifications</h2>
          <div className="space-y-2">
            {cv.certifications.map((c, i) => (
              <div key={c.id || i} className="flex justify-between items-baseline gap-4">
                <p className="text-[12.5px]">
                  {c.title}
                  {c.issuer && <span className="text-[#8A96A3]">, {c.issuer}</span>}
                </p>
                {c.year && <p className="text-[11px] text-[#9AA6B2] tabular-nums shrink-0">{c.year}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* -------------------------------- Monogram -------------------------------- */
// Concept: fine stationery. A centered mark and symmetric rule dividers, set
// the way a letterhead or an invitation is set, for a formal, senior CV.

function MonogramSection({ title, children, accent }) {
  return (
    <section className="mt-9 break-inside-avoid-page">
      <div className="flex items-center justify-center gap-3">
        <span className="h-px w-10" style={{ backgroundColor: accent }} />
        <h2 className="font-serif text-[14px] text-[#1B2A41]">{title}</h2>
        <span className="h-px w-10" style={{ backgroundColor: accent }} />
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MonogramDoc({ cv, user, accent, fontFamily, lineHeight, textAlign, letterSpacing, includePhoto }) {
  const contactItems = buildContactItems(cv, user);
  const name = displayName(cv, user);
  const showPhoto = includePhoto && cv.photo;
  return (
    <div
      className="bg-white text-[#1B2A41] w-full max-w-[8.3in] mx-auto p-[0.9in] font-sans text-[13px]"
      style={{ fontFamily, lineHeight, letterSpacing: `${letterSpacing || 0}px` }}
    >
      <header className="flex flex-col items-center text-center pb-7 border-b border-[#E6EAEE]">
        {showPhoto ? (
          <Avatar cv={cv} includePhoto size={64} />
        ) : (
          <div
            className="h-16 w-16 rounded-full border-2 flex items-center justify-center font-serif text-[19px]"
            style={{ borderColor: accent, color: accent }}
          >
            {initials(name)}
          </div>
        )}
        <h1 className="mt-4 font-serif text-[28px] tracking-wide">{name}</h1>
        {cv.headline && <p className="mt-1.5 text-[13px] text-[#5B6B7F]">{cv.headline}</p>}
        <ContactRow
          items={contactItems}
          className="mt-4 justify-center text-[11.5px] text-[#5B6B7F]"
          iconClassName="opacity-60 shrink-0"
          iconStyle={{ color: accent }}
        />
      </header>

      {cv.summary && (
        <p className="mt-7 text-[13px] leading-loose text-[#3E4C5E] max-w-[5.6in] mx-auto text-center break-inside-avoid" style={{ lineHeight }}>
          {cv.summary}
        </p>
      )}

      {cv.experience?.length > 0 && (
        <MonogramSection title="Experience" accent={accent}>
          <div className="space-y-6">
            {cv.experience.map((e, i) => (
              <div key={e.id || i} className="max-w-[5.8in] mx-auto break-inside-avoid">
                <p className="text-center text-[13.5px] font-semibold">{e.role}</p>
                {e.company && <p className="text-center text-[12px] text-[#5B6B7F] mt-0.5">{e.company}</p>}
                <p className="text-center text-[10.5px] text-[#9AA6B2] mt-0.5 tabular-nums">
                  {fmtRange(e.start_date, e.end_date, e.is_current)}
                </p>
                {e.description && <Description text={e.description} className="mt-2 text-[12px] text-[#3E4C5E] leading-relaxed" style={{ lineHeight }} />}
              </div>
            ))}
          </div>
        </MonogramSection>
      )}

      {cv.projects?.length > 0 && (
        <MonogramSection title="Projects" accent={accent}>
          <div className="space-y-5">
            {cv.projects.map((p, i) => (
              <div key={p.id || i} className="max-w-[5.8in] mx-auto break-inside-avoid">
                <p className="text-center text-[13px] font-semibold">{p.title}</p>
                {p.link && (
                  <p className="text-center text-[11px] mt-0.5" style={{ color: accent }}>
                    {bareUrl(p.link)}
                  </p>
                )}
                {p.description && <Description text={p.description} className="mt-2 text-[12px] text-[#3E4C5E] leading-relaxed" style={{ lineHeight }} />}
              </div>
            ))}
          </div>
        </MonogramSection>
      )}

      {cv.education?.length > 0 && (
        <MonogramSection title="Education" accent={accent}>
          <div className="space-y-4">
            {cv.education.map((e, i) => (
              <div key={e.id || i} className="max-w-[5.8in] mx-auto text-center break-inside-avoid">
                <p className="text-[13px] font-semibold">{e.degree}</p>
                {e.institute && <p className="text-[12px] text-[#5B6B7F] mt-0.5">{e.institute}</p>}
                <p className="text-[10.5px] text-[#9AA6B2] mt-0.5 tabular-nums">
                  {e.start_year}{e.end_year ? ` – ${e.end_year}` : ""}
                </p>
              </div>
            ))}
          </div>
        </MonogramSection>
      )}

      {cv.skills?.length > 0 && (
        <MonogramSection title="Skills" accent={accent}>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 max-w-[5.8in] mx-auto">
            {cv.skills.map((s, i) => s.name && (
              <span key={s.id || i} className="text-[12px] text-[#3E4C5E]">{s.name}</span>
            ))}
          </div>
        </MonogramSection>
      )}

      {cv.certifications?.length > 0 && (
        <MonogramSection title="Certifications" accent={accent}>
          <div className="space-y-3 max-w-[5.8in] mx-auto">
            {cv.certifications.map((c, i) => (
              <div key={c.id || i} className="text-center">
                <p className="text-[12.5px] font-medium">{c.title}</p>
                {(c.issuer || c.year) && (
                  <p className="text-[11px] text-[#9AA6B2] mt-0.5">
                    {[c.issuer, c.year].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </MonogramSection>
      )}
    </div>
  );
}

/* --------------------------------- export --------------------------------- */

export function CvDocument({ cv, templateId, user, accentColor, accent, fontFamily, lineHeight, textAlign = "left", headingAlign = "left", letterSpacing = 0, includePhoto = false }) {
  if (!cv) return null;
  const template = CV_TEMPLATES.find((t) => t.id === templateId) || CV_TEMPLATES[0];
  // Accept either `accent` or the older `accentColor` prop name so existing call sites
  // (and the new ones in ProfilePage) both work.
  const resolvedAccent = accent || accentColor || template.accent;
  const docProps = { cv, user, accent: resolvedAccent, fontFamily, lineHeight, textAlign, headingAlign, letterSpacing, includePhoto };
  if (isTemplate2(templateId)) return <CvDocument2 templateId={templateId} {...docProps} />;
  if (templateId === "lattice") return <LatticeDoc {...docProps} />;
  if (templateId === "brief") return <BriefDoc {...docProps} />;
  if (templateId === "folio") return <FolioDoc {...docProps} />;
  if (templateId === "meridian") return <MeridianDoc {...docProps} />;
  if (templateId === "monogram") return <MonogramDoc {...docProps} />;
  return <LedgerDoc {...docProps} />;
}

/* ------------------------------ Word (.doc) export ------------------------------ */
// Word's renderer doesn't run the Tailwind CDN script and doesn't understand flexbox
// or grid, so feeding it the same className-based markup used for the on-screen
// preview/PDF just produces an unstyled wall of text. This builds a separate,
// Word-native document — real <table> layout, every rule fully inlined — that carries
// over the same content plus the accent color, font, spacing and alignment settings.
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wordHeading(title, accent, headingAlign) {
  return `<h2 style="font-family:Georgia,'Times New Roman',serif;font-size:14pt;color:#1B2A41;margin:22px 0 6px 0;text-align:${headingAlign};border-bottom:1.5pt solid ${accent};padding-bottom:4px;">${escapeHtml(title)}</h2>`;
}

function wordRow(left, right) {
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 2px 0;"><tr>
    <td style="padding:0;font-weight:bold;font-size:11pt;">${left}</td>
    <td style="padding:0;font-size:9.5pt;color:#8A96A3;text-align:right;white-space:nowrap;vertical-align:baseline;">${right}</td>
  </tr></table>`;
}

export function buildWordHtml(cv, user, opts = {}) {
  // The six templates in CvTemplates2.jsx have their own Word layouts.
  if (isTemplate2(opts.templateId)) return buildWordHtml2(cv, user, opts);

  const { accent = "#1B2A41", fontFamily = "Georgia, 'Times New Roman', serif", lineHeight = 1.5, textAlign = "left", headingAlign = "left", includePhoto = false } = opts;
  const name = escapeHtml(displayName(cv, user));
  const contact = [user?.email, cv.phone, cv.address, bareUrl(cv.linkedin_url), bareUrl(cv.github_url), bareUrl(cv.portfolio_url)]
    .filter(Boolean)
    .map(escapeHtml)
    .join("&nbsp;&nbsp;|&nbsp;&nbsp;");

  const bodyStyle = `font-family:${fontFamily};font-size:11pt;line-height:${lineHeight};color:#1B2A41;text-align:${textAlign};`;
  // Word loads the photo from its live URL rather than embedding bytes, so it only shows
  // up if that URL is reachable when the .doc is opened (fine for a hosted/CDN photo URL,
  // not for a local blob: URL).
  const photoImg = includePhoto && cv.photo
    ? `<img src="${cv.photo}" width="72" height="72" style="border-radius:50%;object-fit:cover;display:block;margin:0 auto 10px auto;" />`
    : "";

  let html = `<div style="${bodyStyle}">`;
  html += `<div style="text-align:center;padding-bottom:14px;border-bottom:1.5pt solid ${accent};margin-bottom:14px;">`;
  html += photoImg;
  html += `<div style="font-family:Georgia,'Times New Roman',serif;font-size:26pt;color:#1B2A41;">${name}</div>`;
  if (cv.headline) html += `<div style="font-size:11pt;color:#5B6B7F;margin-top:4px;">${escapeHtml(cv.headline)}</div>`;
  if (contact) html += `<div style="font-size:9.5pt;color:#5B6B7F;margin-top:8px;">${contact}</div>`;
  html += `</div>`;

  if (cv.summary) {
    html += `<p style="margin:0 0 6px 0;">${escapeHtml(cv.summary)}</p>`;
  }

  if (cv.experience?.length) {
    html += wordHeading("Experience", accent, headingAlign);
    cv.experience.forEach((e) => {
      const left = `${escapeHtml(e.role)}${e.company ? ` &mdash; ${escapeHtml(e.company)}` : ""}`;
      html += wordRow(left, escapeHtml(fmtRange(e.start_date, e.end_date, e.is_current)));
      if (e.description) html += `<p style="margin:2px 0 10px 0;font-size:10.5pt;color:#3E4C5E;">${escapeHtml(e.description)}</p>`;
    });
  }

  if (cv.projects?.length) {
    html += wordHeading("Projects", accent, headingAlign);
    cv.projects.forEach((p) => {
      const left = `${escapeHtml(p.title)}${p.link ? ` &mdash; <span style="color:${accent};">${escapeHtml(bareUrl(p.link))}</span>` : ""}`;
      html += `<p style="margin:0;font-weight:bold;font-size:11pt;">${left}</p>`;
      if (p.description) html += `<p style="margin:2px 0 10px 0;font-size:10.5pt;color:#3E4C5E;">${escapeHtml(p.description)}</p>`;
    });
  }

  if (cv.education?.length) {
    html += wordHeading("Education", accent, headingAlign);
    cv.education.forEach((e) => {
      const left = `${escapeHtml(e.degree)}${e.institute ? ` &mdash; ${escapeHtml(e.institute)}` : ""}`;
      const right = `${e.start_year || ""}${e.end_year ? ` &ndash; ${e.end_year}` : ""}`;
      html += wordRow(left, right);
      if (e.description) html += `<p style="margin:2px 0 10px 0;font-size:10.5pt;color:#3E4C5E;">${escapeHtml(e.description)}</p>`;
    });
  }

  if (cv.skills?.length) {
    html += wordHeading("Skills", accent, headingAlign);
    html += `<p style="margin:0 0 6px 0;font-size:10.5pt;">${cv.skills.map((s) => escapeHtml(s.name)).filter(Boolean).join(", ")}</p>`;
  }

  if (cv.certifications?.length) {
    html += wordHeading("Certifications", accent, headingAlign);
    cv.certifications.forEach((c) => {
      const left = `${escapeHtml(c.title)}${c.issuer ? ` &mdash; ${escapeHtml(c.issuer)}` : ""}`;
      html += wordRow(left, c.year || "");
    });
  }

  html += `</div>`;

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>CV</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
  @page { margin: 1in; }
  body { margin: 0; }
</style>
</head>
<body>${html}</body></html>`;
}