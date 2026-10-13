// CvTemplates2.jsx
// Six more CV templates: Aurora, Compass, Nordic, Pulse, Atlas, Ink.
// Self-contained on purpose (no import from CvTemplates.jsx) so there is no circular import.
// CvTemplates.jsx imports from this file and merges these into CV_TEMPLATES.
//
// Export safety notes (PDF / PNG / JPG use html2canvas):
//  - No Tailwind slash-opacity colours (bg-white/10 etc.). Tints are computed as solid hex.
//  - Dynamic colours are always inline styles, never Tailwind arbitrary classes.
//  - No clip-path / gradients / filters / CSS grid tricks that html2canvas can't paint.
//  - Word (.doc) uses its own table-based markup in buildWordHtml2 (Word ignores flex/grid/Tailwind).

export const CV_TEMPLATES_2 = [
  {
    id: "aurora",
    name: "Aurora",
    blurb:
      "A full-width colour band carries your name and contact details, with a clean single column beneath. Suits marketing, sales, and modern corporate roles.",
    accent: "#1F6F8B",
  },
  {
    id: "compass",
    name: "Compass",
    blurb:
      "A light side rail holds contact, skills, education and certifications; the main column is for experience and projects. Suits graduates and career changers.",
    accent: "#6B4E9B",
  },
  {
    id: "nordic",
    name: "Nordic",
    blurb:
      "Section titles sit in a quiet left column, a light oversized name on top, skills as a simple line. Calm and airy for design-minded and product roles.",
    accent: "#5C6F7B",
  },
  {
    id: "pulse",
    name: "Pulse",
    blurb:
      "Bold accent bars mark each section and skills show proficiency as level bars, using the level you set in your profile. Suits developers and analysts.",
    accent: "#0F766E",
  },
  {
    id: "atlas",
    name: "Atlas",
    blurb:
      "A compact, dense layout with education, skills and certifications in three columns at the bottom. Fits a lot of content on one page.",
    accent: "#8C4A1E",
  },
  {
    id: "ink",
    name: "Ink",
    blurb:
      "Plain black on white, centred heading, no icons, no colour blocks. Reads cleanly in applicant-tracking systems and suits academic and public-sector roles.",
    accent: "#111827",
  },
];

const IDS_2 = CV_TEMPLATES_2.map((t) => t.id);
export const isTemplate2 = (id) => IDS_2.includes(id);

/* --------------------------------- helpers --------------------------------- */

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

function yearRange(start, end) {
  return `${start || ""}${end ? ` – ${end}` : ""}`;
}

function displayName(cv, user) {
  return (
    cv?.full_name || user?.full_name || user?.name || user?.email || "Your Name"
  );
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

function hexToRgb(hex) {
  let h = String(hex || "#000000").replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Blend a colour with white and return SOLID hex (safe for html2canvas and Word).
function tintHex(hex, amount = 0.12) {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => Math.round(255 - (255 - c) * amount);
  return (
    "#" +
    [mix(r), mix(g), mix(b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

// White or dark text, whichever is readable on the given background.
function readableOn(hex) {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#1B2A41" : "#FFFFFF";
}

const justifyOf = (align) =>
  align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
const justifyClass = (align) =>
  align === "center"
    ? "justify-center"
    : align === "right"
      ? "justify-end"
      : "";
const LEVELS = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
const LEVEL_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

const skillNames = (cv) => (cv.skills || []).map((s) => s.name).filter(Boolean);

function contactList(cv, user) {
  return [
    { icon: "mail", text: user?.email },
    { icon: "phone", text: cv.phone },
    { icon: "pin", text: cv.address },
    { icon: "link", text: bareUrl(cv.linkedin_url) },
    { icon: "code", text: bareUrl(cv.github_url) },
    { icon: "globe", text: bareUrl(cv.portfolio_url) },
  ].filter((c) => c.text);
}

// Normalised entries so every template (and the Word export) reads the same data the same way.
const expItems = (cv) =>
  (cv.experience || []).map((e, i) => ({
    key: e.id || i,
    title: e.role,
    sub: e.company,
    date: fmtRange(e.start_date, e.end_date, e.is_current),
    desc: e.description,
  }));
const eduItems = (cv) =>
  (cv.education || []).map((e, i) => ({
    key: e.id || i,
    title: e.degree,
    sub: e.institute,
    date: yearRange(e.start_year, e.end_year),
    desc: e.description,
  }));
const projItems = (cv) =>
  (cv.projects || []).map((p, i) => ({
    key: p.id || i,
    title: p.title,
    sub: p.link ? bareUrl(p.link) : "",
    date: "",
    desc: p.description,
  }));
const certItems = (cv) =>
  (cv.certifications || []).map((c, i) => ({
    key: c.id || i,
    title: c.title,
    sub: c.issuer,
    date: c.year ? String(c.year) : "",
    desc: "",
  }));

const SECTION_TITLES = {
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
};
const itemsFor = (cv, key) =>
  ({
    experience: expItems,
    projects: projItems,
    education: eduItems,
    certifications: certItems,
  })[key]?.(cv) || [];

/* ---------------------------------- icons ------------------------------------ */

const ICON_PATHS = {
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  phone: (
    <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 9 9 0 0 0 2.8.45 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.3a1 1 0 0 1 1 1 9 9 0 0 0 .45 2.8 1 1 0 0 1-.25 1Z" />
  ),
  pin: (
    <>
      <path d="M19 10c0 5.5-7 11-7 11S5 15.5 5 10a7 7 0 0 1 14 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.5-1.5" />
    </>
  ),
  code: <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" />
    </>
  ),
};

function Icon({ name, size = 12, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/* ------------------------------ shared pieces -------------------------------- */

function Photo({ cv, include, size = 60, radius = "9999px" }) {
  if (!include || !cv.photo) return null;
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

function ContactLine({
  items,
  className = "",
  style,
  iconStyle,
  vertical = false,
}) {
  if (!items.length) return null;
  return (
    <div
      className={`flex ${vertical ? "flex-col gap-y-2" : "flex-wrap items-center gap-x-4 gap-y-1.5"} ${className}`}
      style={style}
    >
      {items.map((it, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5"
          style={{ lineHeight: 1 }}
        >
          <Icon name={it.icon} style={iconStyle} />
          <span
            style={{
              verticalAlign: "middle",
              ...(vertical ? { wordBreak: "break-all", lineHeight: 1.3 } : {}),
            }}
          >
            {it.text}
          </span>
        </span>
      ))}
    </div>
  );
}

function Entry({
  title,
  sub,
  date,
  desc,
  accent,
  lineHeight,
  mono = false,
  compact = false,
  subMuted = false,
}) {
  return (
    <div
      className={`${compact ? "mb-3" : "mb-4"} last:mb-0 break-inside-avoid`}
    >
      <div className="flex justify-between items-baseline gap-4">
        <p className="text-[13.5px] font-semibold">{title}</p>
        {date && (
          <p
            className={`text-[11px] text-[#8A96A3] whitespace-nowrap tabular-nums ${mono ? "font-mono" : ""}`}
          >
            {date}
          </p>
        )}
      </div>
      {sub && (
        <p
          className="text-[12px] font-medium mt-0.5"
          style={{ color: subMuted ? "#5B6B7F" : accent }}
        >
          {sub}
        </p>
      )}
      {desc && (
        <p
          className="mt-1 text-[12px] text-[#3E4C5E] leading-relaxed"
          style={{ lineHeight, whiteSpace: "pre-line" }}
        >
          {desc}
        </p>
      )}
    </div>
  );
}

function Items({ items, accent, lineHeight, mono, compact, subMuted }) {
  return items.map(({ key, ...it }) => (
    <Entry
      key={key}
      {...it}
      accent={accent}
      lineHeight={lineHeight}
      mono={mono}
      compact={compact}
      subMuted={subMuted}
    />
  ));
}

function SectionTitle({ title, variant, accent, align }) {
  if (variant === "aurora") {
    return (
      <div
        className="flex items-center gap-3"
        style={{ justifyContent: justifyOf(align) }}
      >
        <h2 className="text-[13.5px] font-bold" style={{ color: accent }}>
          {title}
        </h2>
        {align === "left" && (
          <span
            className="flex-1 h-px"
            style={{ backgroundColor: tintHex(accent, 0.35) }}
          />
        )}
      </div>
    );
  }
  if (variant === "pulse") {
    return (
      <h2
        className="flex items-center gap-2.5 text-[14px] font-bold text-[#1B2A41]"
        style={{ justifyContent: justifyOf(align) }}
      >
        <span
          className="h-4 w-1 rounded-sm shrink-0"
          style={{ backgroundColor: accent }}
        />
        {title}
      </h2>
    );
  }
  if (variant === "atlas") {
    return (
      <h2
        className="text-[11px] font-bold pb-1 border-b border-[#1B2A41]"
        style={{
          textAlign: align,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
    );
  }
  if (variant === "ink") {
    return (
      <h2
        className="font-serif text-[12px] pb-1 border-b border-[#111827] text-center"
        style={{ letterSpacing: "2px", textTransform: "uppercase" }}
      >
        {title}
      </h2>
    );
  }
  // compass
  return (
    <h2
      className="text-[13px] font-bold"
      style={{ color: accent, textAlign: align }}
    >
      {title}
    </h2>
  );
}

function Sec({
  title,
  variant,
  accent,
  align = "left",
  className = "mt-6",
  children,
}) {
  return (
    <section className={`${className} break-inside-avoid-page`}>
      <SectionTitle
        title={title}
        variant={variant}
        accent={accent}
        align={align}
      />
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* skills renderers */
function SkillChips({ cv, accent }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(cv.skills || []).map((s, i) =>
        s.name ? (
          <span
            key={s.id || i}
            className="text-[11px] px-2.5 py-1 rounded-[4px]"
            style={{ backgroundColor: tintHex(accent, 0.12), color: accent }}
          >
            {s.name}
          </span>
        ) : null,
      )}
    </div>
  );
}

function SkillLevels({ cv, accent }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
      {(cv.skills || []).map((s, i) => {
        if (!s.name) return null;
        const lvl = LEVELS[s.level] || 2;
        return (
          <div
            key={s.id || i}
            className="flex items-center justify-between gap-3 break-inside-avoid"
          >
            <span className="text-[12px] text-[#3E4C5E]">{s.name}</span>
            <span className="flex gap-[3px] shrink-0">
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className="h-[6px] w-5 rounded-sm"
                  style={{ backgroundColor: n <= lvl ? accent : "#E6EAEE" }}
                />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* Renders the listed sections in order. `skills` is a render function for the skills section. */
function SectionsBlock({
  cv,
  include,
  variant,
  accent,
  align,
  lineHeight,
  skills,
  mono,
  compact,
  subMuted,
  gap = "mt-7",
}) {
  return (
    <>
      {include.map((key) => {
        if (key === "skills") {
          if (!skillNames(cv).length) return null;
          return (
            <Sec
              key={key}
              title={SECTION_TITLES[key]}
              variant={variant}
              accent={accent}
              align={align}
              className={gap}
            >
              {skills()}
            </Sec>
          );
        }
        const items = itemsFor(cv, key);
        if (!items.length) return null;
        return (
          <Sec
            key={key}
            title={SECTION_TITLES[key]}
            variant={variant}
            accent={accent}
            align={align}
            className={gap}
          >
            <Items
              items={items}
              accent={accent}
              lineHeight={lineHeight}
              mono={mono}
              compact={compact}
              subMuted={subMuted}
            />
          </Sec>
        );
      })}
    </>
  );
}

const Summary = ({ cv, lineHeight, className = "", style }) =>
  cv.summary ? (
    <p
      className={`text-[13px] leading-relaxed text-[#3E4C5E] break-inside-avoid ${className}`}
      style={{ lineHeight, whiteSpace: "pre-line", ...style }}
    >
      {cv.summary}
    </p>
  ) : null;

/* -------------------------------- Aurora -------------------------------- */

function AuroraDoc({
  cv,
  user,
  accent,
  fontFamily,
  lineHeight,
  textAlign,
  headingAlign,
  letterSpacing,
  includePhoto,
}) {
  const name = displayName(cv, user);
  const ink = readableOn(accent);
  return (
    <div
      className="bg-white text-[#1B2A41] w-full max-w-[8.3in] mx-auto p-[0.6in] font-sans text-[13px]"
      style={{
        fontFamily,
        lineHeight,
        textAlign,
        letterSpacing: `${letterSpacing || 0}px`,
      }}
    >
      <header
        className="rounded-md px-7 py-6 flex items-center gap-5"
        style={{ backgroundColor: accent, color: ink, textAlign: "left" }}
      >
        <Photo cv={cv} include={includePhoto} size={68} />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[30px] leading-tight tracking-tight">
            {name}
          </h1>
          {cv.headline && (
            <p className="mt-1 text-[13.5px]" style={{ color: ink }}>
              {cv.headline}
            </p>
          )}
          <ContactLine
            items={contactList(cv, user)}
            className="mt-3.5 text-[11.5px]"
            style={{ color: ink }}
          />
        </div>
      </header>

      <Summary cv={cv} lineHeight={lineHeight} className="mt-6" />

      <SectionsBlock
        cv={cv}
        include={[
          "experience",
          "projects",
          "education",
          "skills",
          "certifications",
        ]}
        variant="aurora"
        accent={accent}
        align={headingAlign}
        lineHeight={lineHeight}
        skills={() => <SkillChips cv={cv} accent={accent} />}
      />
    </div>
  );
}

/* -------------------------------- Compass -------------------------------- */

function CompassDoc({
  cv,
  user,
  accent,
  fontFamily,
  lineHeight,
  textAlign,
  headingAlign,
  letterSpacing,
  includePhoto,
}) {
  const name = displayName(cv, user);
  const showPhoto = includePhoto && cv.photo;
  const railBg = tintHex(accent, 0.07);
  const edu = eduItems(cv);
  const certs = certItems(cv);
  const skills = skillNames(cv);
  return (
    <div
      className="bg-white text-[#1B2A41] w-full max-w-[8.3in] mx-auto flex font-sans text-[13px]"
      style={{
        fontFamily,
        lineHeight,
        letterSpacing: `${letterSpacing || 0}px`,
      }}
    >
      <aside
        className="w-[2.4in] shrink-0 p-7 flex flex-col gap-7"
        style={{ backgroundColor: railBg }}
      >
        {showPhoto ? (
          <Photo cv={cv} include size={84} radius="8px" />
        ) : (
          <div
            className="h-[72px] w-[72px] rounded-lg flex items-center justify-center font-serif text-[24px]"
            style={{ backgroundColor: accent, color: readableOn(accent) }}
          >
            {initials(name)}
          </div>
        )}

        <ContactLine
          items={contactList(cv, user)}
          vertical
          className="text-[11px] text-[#3E4C5E]"
          iconStyle={{ color: accent }}
        />

        {skills.length > 0 && (
          <div>
            <SectionTitle
              title="Skills"
              variant="compass"
              accent={accent}
              align="left"
            />
            <div className="mt-2.5 space-y-1.5">
              {skills.map((s, i) => (
                <p key={i} className="text-[11.5px] text-[#3E4C5E]">
                  {s}
                </p>
              ))}
            </div>
          </div>
        )}

        {edu.length > 0 && (
          <div>
            <SectionTitle
              title="Education"
              variant="compass"
              accent={accent}
              align="left"
            />
            <div className="mt-2.5 space-y-3">
              {edu.map((e) => (
                <div key={e.key} className="break-inside-avoid">
                  <p className="text-[12px] font-semibold">{e.title}</p>
                  {e.sub && (
                    <p className="text-[11px] text-[#5B6B7F]">{e.sub}</p>
                  )}
                  {e.date && (
                    <p className="text-[10.5px] text-[#8A96A3] tabular-nums">
                      {e.date}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {certs.length > 0 && (
          <div>
            <SectionTitle
              title="Certifications"
              variant="compass"
              accent={accent}
              align="left"
            />
            <div className="mt-2.5 space-y-3">
              {certs.map((c) => (
                <div key={c.key} className="break-inside-avoid">
                  <p className="text-[12px] font-semibold">{c.title}</p>
                  <p className="text-[11px] text-[#5B6B7F]">
                    {[c.sub, c.date].filter(Boolean).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 min-w-0 p-8">
        <h1
          className="font-serif text-[30px] leading-tight tracking-tight"
          style={{ textAlign: headingAlign }}
        >
          {name}
        </h1>
        {cv.headline && (
          <p
            className="mt-1 text-[14px] font-medium"
            style={{ color: accent, textAlign: headingAlign }}
          >
            {cv.headline}
          </p>
        )}
        <Summary
          cv={cv}
          lineHeight={lineHeight}
          className="mt-5"
          style={{ textAlign }}
        />
        <SectionsBlock
          cv={cv}
          include={["experience", "projects"]}
          variant="compass"
          accent={accent}
          align={headingAlign}
          lineHeight={lineHeight}
          skills={() => null}
        />
      </main>
    </div>
  );
}

/* -------------------------------- Nordic -------------------------------- */

function NordicDoc({
  cv,
  user,
  accent,
  fontFamily,
  lineHeight,
  textAlign,
  headingAlign,
  letterSpacing,
  includePhoto,
}) {
  const name = displayName(cv, user);
  const sections = [
    ["experience", expItems(cv)],
    ["projects", projItems(cv)],
    ["education", eduItems(cv)],
    ["skills", skillNames(cv)],
    ["certifications", certItems(cv)],
  ].filter(([, v]) => v.length);
  return (
    <div
      className="bg-white text-[#1B2A41] w-full max-w-[8.3in] mx-auto p-[0.9in] font-sans text-[13px]"
      style={{
        fontFamily,
        lineHeight,
        letterSpacing: `${letterSpacing || 0}px`,
      }}
    >
      <header className="flex items-start gap-5" style={{ textAlign }}>
        <Photo cv={cv} include={includePhoto} size={64} radius="6px" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[40px] leading-[1.05] font-light tracking-tight">
            {name}
          </h1>
          {cv.headline && (
            <p className="mt-2.5 text-[14px]" style={{ color: accent }}>
              {cv.headline}
            </p>
          )}
          <ContactLine
            items={contactList(cv, user)}
            className={`mt-4 text-[11.5px] text-[#5B6B7F] ${justifyClass(textAlign)}`}
            iconStyle={{ color: accent }}
          />
        </div>
      </header>

      {cv.summary && (
        <div className="mt-8 grid grid-cols-[1.4in_1fr] gap-6 break-inside-avoid">
          <p
            className="text-[12px] text-[#8A96A3] pt-0.5"
            style={{ textAlign: headingAlign }}
          >
            About
          </p>
          <Summary cv={cv} lineHeight={lineHeight} style={{ textAlign }} />
        </div>
      )}

      {sections.map(([key, data]) => (
        <section
          key={key}
          className="mt-8 pt-6 border-t border-[#E6EAEE] grid grid-cols-[1.4in_1fr] gap-6 break-inside-avoid-page"
        >
          <h2
            className="text-[12px] text-[#8A96A3] pt-0.5"
            style={{ textAlign: headingAlign }}
          >
            {SECTION_TITLES[key]}
          </h2>
          <div>
            {key === "skills" ? (
              <p
                className="text-[12.5px] text-[#3E4C5E] leading-relaxed"
                style={{ lineHeight }}
              >
                {data.join("  ·  ")}
              </p>
            ) : (
              <Items
                items={data}
                accent={accent}
                lineHeight={lineHeight}
                subMuted
              />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/* -------------------------------- Pulse -------------------------------- */

function PulseDoc({
  cv,
  user,
  accent,
  fontFamily,
  lineHeight,
  textAlign,
  headingAlign,
  letterSpacing,
  includePhoto,
}) {
  const name = displayName(cv, user);
  return (
    <div
      className="bg-white text-[#1B2A41] w-full max-w-[8.3in] mx-auto p-[0.7in] font-sans text-[13px]"
      style={{
        fontFamily,
        lineHeight,
        textAlign,
        letterSpacing: `${letterSpacing || 0}px`,
      }}
    >
      <header
        className="pb-5 flex items-start gap-4"
        style={{ borderBottom: `3px solid ${accent}` }}
      >
        <Photo cv={cv} include={includePhoto} size={64} radius="8px" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[34px] leading-tight font-bold tracking-tight">
            {name}
          </h1>
          {cv.headline && (
            <p
              className="mt-1 text-[14px] font-medium"
              style={{ color: accent }}
            >
              {cv.headline}
            </p>
          )}
          <ContactLine
            items={contactList(cv, user)}
            className={`mt-3.5 text-[11.5px] text-[#5B6B7F] ${justifyClass(textAlign)}`}
            iconStyle={{ color: accent }}
          />
        </div>
      </header>

      <Summary cv={cv} lineHeight={lineHeight} className="mt-6" />

      <SectionsBlock
        cv={cv}
        include={[
          "experience",
          "projects",
          "skills",
          "education",
          "certifications",
        ]}
        variant="pulse"
        accent={accent}
        align={headingAlign}
        lineHeight={lineHeight}
        mono
        skills={() => <SkillLevels cv={cv} accent={accent} />}
      />
    </div>
  );
}

/* -------------------------------- Atlas -------------------------------- */

function AtlasDoc({
  cv,
  user,
  accent,
  fontFamily,
  lineHeight,
  textAlign,
  headingAlign,
  letterSpacing,
  includePhoto,
}) {
  const name = displayName(cv, user);
  const edu = eduItems(cv);
  const certs = certItems(cv);
  const skills = skillNames(cv);
  const hasBottom = edu.length || skills.length || certs.length;
  return (
    <div
      className="bg-white text-[#1B2A41] w-full max-w-[8.3in] mx-auto p-[0.55in] font-sans text-[12px]"
      style={{
        fontFamily,
        lineHeight,
        textAlign,
        letterSpacing: `${letterSpacing || 0}px`,
      }}
    >
      <header
        className="flex items-start justify-between gap-6 pb-4"
        style={{ borderBottom: `2px solid ${accent}` }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <Photo cv={cv} include={includePhoto} size={58} radius="6px" />
          <div className="min-w-0">
            <h1 className="font-serif text-[28px] leading-tight tracking-tight">
              {name}
            </h1>
            {cv.headline && (
              <p
                className="mt-0.5 text-[13px] font-medium"
                style={{ color: accent }}
              >
                {cv.headline}
              </p>
            )}
          </div>
        </div>
        <ContactLine
          items={contactList(cv, user)}
          vertical
          className="text-[10.5px] text-[#5B6B7F] items-end shrink-0"
          iconStyle={{ color: accent }}
        />
      </header>

      <Summary
        cv={cv}
        lineHeight={lineHeight}
        className="mt-4"
        style={{ fontSize: 12 }}
      />

      <SectionsBlock
        cv={cv}
        include={["experience", "projects"]}
        variant="atlas"
        accent={accent}
        align={headingAlign}
        lineHeight={lineHeight}
        compact
        gap="mt-5"
        skills={() => null}
      />

      {hasBottom ? (
        <div className="mt-5 grid grid-cols-3 gap-6">
          {edu.length > 0 && (
            <section className="break-inside-avoid">
              <SectionTitle
                title="Education"
                variant="atlas"
                accent={accent}
                align={headingAlign}
              />
              <div className="mt-2.5 space-y-2.5">
                {edu.map((e) => (
                  <div key={e.key}>
                    <p className="text-[12px] font-semibold">{e.title}</p>
                    {e.sub && (
                      <p className="text-[11px] text-[#5B6B7F]">{e.sub}</p>
                    )}
                    {e.date && (
                      <p className="text-[10.5px] text-[#8A96A3] tabular-nums">
                        {e.date}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          {skills.length > 0 && (
            <section className="break-inside-avoid">
              <SectionTitle
                title="Skills"
                variant="atlas"
                accent={accent}
                align={headingAlign}
              />
              <div className="mt-2.5 space-y-1">
                {skills.map((s, i) => (
                  <p key={i} className="text-[11.5px] text-[#3E4C5E]">
                    {s}
                  </p>
                ))}
              </div>
            </section>
          )}
          {certs.length > 0 && (
            <section className="break-inside-avoid">
              <SectionTitle
                title="Certifications"
                variant="atlas"
                accent={accent}
                align={headingAlign}
              />
              <div className="mt-2.5 space-y-2.5">
                {certs.map((c) => (
                  <div key={c.key}>
                    <p className="text-[12px] font-semibold">{c.title}</p>
                    <p className="text-[11px] text-[#5B6B7F]">
                      {[c.sub, c.date].filter(Boolean).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------- Ink --------------------------------- */

function InkDoc({
  cv,
  user,
  accent,
  fontFamily,
  lineHeight,
  textAlign,
  headingAlign,
  letterSpacing,
  includePhoto,
}) {
  const name = displayName(cv, user);
  const contact = contactList(cv, user)
    .map((c) => c.text)
    .join("  |  ");
  const skills = skillNames(cv);
  const certs = certItems(cv);
  return (
    <div
      className="bg-white text-[#111827] w-full max-w-[8.3in] mx-auto p-[0.8in] font-serif text-[13px]"
      style={{
        fontFamily,
        lineHeight,
        letterSpacing: `${letterSpacing || 0}px`,
      }}
    >
      <header className="flex flex-col items-center text-center pb-4">
        <Photo cv={cv} include={includePhoto} size={64} />
        <h1
          className={`text-[26px] leading-tight ${includePhoto && cv.photo ? "mt-3" : ""}`}
          style={{ letterSpacing: "3px", textTransform: "uppercase" }}
        >
          {name}
        </h1>
        {cv.headline && (
          <p className="mt-1 italic text-[13.5px] text-[#374151]">
            {cv.headline}
          </p>
        )}
        {contact && (
          <p className="mt-2.5 text-[11px] text-[#374151]">{contact}</p>
        )}
      </header>

      {cv.summary && (
        <p
          className="mt-2 text-[12.5px] text-[#1F2937] break-inside-avoid"
          style={{
            lineHeight,
            whiteSpace: "pre-line",
            textAlign: textAlign === "left" ? "justify" : textAlign,
          }}
        >
          {cv.summary}
        </p>
      )}

      <SectionsBlock
        cv={cv}
        include={["experience", "projects", "education"]}
        variant="ink"
        accent={accent}
        align="center"
        lineHeight={lineHeight}
        subMuted
        gap="mt-6"
        skills={() => null}
      />

      {skills.length > 0 && (
        <Sec title="Skills" variant="ink" accent={accent} className="mt-6">
          <p className="text-[12.5px] text-[#1F2937]" style={{ lineHeight }}>
            {skills.join(", ")}
          </p>
        </Sec>
      )}

      {certs.length > 0 && (
        <Sec
          title="Certifications"
          variant="ink"
          accent={accent}
          className="mt-6"
        >
          <div className="space-y-1.5">
            {certs.map((c) => (
              <div
                key={c.key}
                className="flex justify-between items-baseline gap-4"
              >
                <p className="text-[12.5px]">
                  {c.title}
                  {c.sub && <span className="text-[#4B5563]">, {c.sub}</span>}
                </p>
                {c.date && (
                  <p className="text-[11px] text-[#6B7280] tabular-nums">
                    {c.date}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Sec>
      )}
    </div>
  );
}

/* ------------------------------- dispatcher ------------------------------- */

export function CvDocument2({ templateId, ...props }) {
  if (templateId === "compass") return <CompassDoc {...props} />;
  if (templateId === "nordic") return <NordicDoc {...props} />;
  if (templateId === "pulse") return <PulseDoc {...props} />;
  if (templateId === "atlas") return <AtlasDoc {...props} />;
  if (templateId === "ink") return <InkDoc {...props} />;
  return <AuroraDoc {...props} />;
}

/* -------------------------------- thumbnails -------------------------------- */

export function TemplateThumb2({ id, accent }) {
  const box = "w-full h-24 rounded-md overflow-hidden border border-[#E6EAEE]";
  if (id === "compass") {
    return (
      <div className={`${box} flex`}>
        <div
          className="w-[34%] h-full p-2 space-y-1.5"
          style={{ backgroundColor: tintHex(accent, 0.12) }}
        >
          <div
            className="h-4 w-4 rounded-sm"
            style={{ backgroundColor: accent }}
          />
          <div className="h-1 w-4/5 rounded-sm bg-[#C4CCD4]" />
          <div className="h-1 w-3/5 rounded-sm bg-[#C4CCD4]" />
        </div>
        <div className="flex-1 p-2.5 space-y-1.5">
          <div className="h-2 w-2/3 rounded-sm bg-[#1B2A41]" />
          <div className="h-1 w-full rounded-sm bg-[#F0F2F4]" />
          <div className="h-1 w-5/6 rounded-sm bg-[#F0F2F4]" />
          <div className="h-1 w-3/4 rounded-sm bg-[#F0F2F4]" />
        </div>
      </div>
    );
  }
  if (id === "nordic") {
    return (
      <div className={`${box} p-3 space-y-2`}>
        <div className="h-3 w-1/2 rounded-sm bg-[#C4CCD4]" />
        <div className="h-px w-full bg-[#E6EAEE]" />
        <div className="flex gap-3">
          <div className="h-1 w-6 rounded-sm bg-[#C4CCD4]" />
          <div className="flex-1 space-y-1">
            <div className="h-1 w-full rounded-sm bg-[#F0F2F4]" />
            <div className="h-1 w-2/3 rounded-sm bg-[#F0F2F4]" />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="h-1 w-6 rounded-sm bg-[#C4CCD4]" />
          <div className="h-1 flex-1 rounded-sm bg-[#F0F2F4]" />
        </div>
      </div>
    );
  }
  if (id === "pulse") {
    return (
      <div className={`${box} p-3 space-y-2`}>
        <div className="h-2 w-1/2 rounded-sm bg-[#1B2A41]" />
        <div className="h-[2px] w-full" style={{ backgroundColor: accent }} />
        <div className="flex items-center gap-1.5">
          <span
            className="h-3 w-[3px] rounded-sm"
            style={{ backgroundColor: accent }}
          />
          <div className="h-1.5 w-1/4 rounded-sm bg-[#3E4C5E]" />
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className="h-1.5 w-4 rounded-sm"
              style={{ backgroundColor: n < 4 ? accent : "#E6EAEE" }}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className="h-1.5 w-4 rounded-sm"
              style={{ backgroundColor: n < 3 ? accent : "#E6EAEE" }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (id === "atlas") {
    return (
      <div className={`${box} p-2.5 space-y-1.5`}>
        <div className="flex justify-between">
          <div className="h-2 w-1/3 rounded-sm bg-[#1B2A41]" />
          <div className="h-1 w-1/5 rounded-sm bg-[#C4CCD4]" />
        </div>
        <div className="h-[2px] w-full" style={{ backgroundColor: accent }} />
        <div className="h-1 w-full rounded-sm bg-[#F0F2F4]" />
        <div className="h-1 w-5/6 rounded-sm bg-[#F0F2F4]" />
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[0, 1, 2].map((n) => (
            <div key={n} className="space-y-1">
              <div className="h-px w-full bg-[#1B2A41]" />
              <div className="h-1 w-full rounded-sm bg-[#F0F2F4]" />
              <div className="h-1 w-2/3 rounded-sm bg-[#F0F2F4]" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (id === "ink") {
    return (
      <div className={`${box} p-3 flex flex-col items-center gap-1.5`}>
        <div className="h-2 w-1/2 rounded-sm bg-[#111827]" />
        <div className="h-1 w-1/3 rounded-sm bg-[#C4CCD4]" />
        <div className="h-px w-full bg-[#111827] mt-1.5" />
        <div className="h-1 w-full rounded-sm bg-[#F0F2F4]" />
        <div className="h-px w-full bg-[#111827] mt-1" />
        <div className="h-1 w-5/6 rounded-sm bg-[#F0F2F4]" />
      </div>
    );
  }
  // aurora (default)
  return (
    <div className={`${box} p-2.5 space-y-2`}>
      <div
        className="h-7 w-full rounded-sm flex flex-col justify-center gap-1 px-2"
        style={{ backgroundColor: accent }}
      >
        <div className="h-1.5 w-1/2 rounded-sm bg-white" />
        <div
          className="h-1 w-1/3 rounded-sm"
          style={{ backgroundColor: tintHex(accent, 0.4) }}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <div
          className="h-1.5 w-8 rounded-sm"
          style={{ backgroundColor: accent }}
        />
        <div
          className="h-px flex-1"
          style={{ backgroundColor: tintHex(accent, 0.35) }}
        />
      </div>
      <div className="h-1 w-full rounded-sm bg-[#F0F2F4]" />
      <div className="h-1 w-3/4 rounded-sm bg-[#F0F2F4]" />
    </div>
  );
}

/* ------------------------------ Word (.doc) export ------------------------------ */
// Table-based, fully inlined markup with solid hex colours only (Word does not understand
// flex, grid, Tailwind, rgba() or CSS variables). Mirrors each template's structure.

const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const escNl = (s) => esc(s).replace(/\r?\n/g, "<br>");

function wHead(title, variant, accent, align) {
  const t = esc(title);
  const base = `margin:18px 0 6px 0;text-align:${align};`;
  if (variant === "aurora")
    return `<h2 style="${base}font-size:12.5pt;color:${accent};border-bottom:.75pt solid ${tintHex(accent, 0.45)};padding-bottom:3px;">${t}</h2>`;
  if (variant === "pulse")
    return `<h2 style="${base}font-size:13pt;color:#1B2A41;border-left:4pt solid ${accent};padding-left:8px;">${t}</h2>`;
  if (variant === "atlas")
    return `<h2 style="${base}font-size:10pt;color:#1B2A41;letter-spacing:1pt;border-bottom:1pt solid #1B2A41;padding-bottom:2px;">${t.toUpperCase()}</h2>`;
  if (variant === "ink")
    return `<h2 style="margin:18px 0 6px 0;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:10.5pt;color:#111827;letter-spacing:2pt;border-bottom:.75pt solid #111827;padding-bottom:2px;">${t.toUpperCase()}</h2>`;
  if (variant === "nordic")
    return `<h2 style="${base}font-size:10.5pt;color:#8A96A3;font-weight:normal;border-bottom:.5pt solid #E6EAEE;padding-bottom:3px;">${t}</h2>`;
  return `<h2 style="${base}font-size:11.5pt;color:${accent};">${t}</h2>`; // compass
}

function wEntry({ title, sub, date, desc }, accent, muted) {
  const subColor = muted ? "#5B6B7F" : accent;
  return `<table style="width:100%;border-collapse:collapse;margin:0;"><tr>
    <td style="padding:0;font-weight:bold;font-size:11pt;">${esc(title)}</td>
    <td style="padding:0;font-size:9.5pt;color:#8A96A3;text-align:right;white-space:nowrap;vertical-align:baseline;">${esc(date)}</td>
  </tr></table>
  ${sub ? `<p style="margin:1px 0 0 0;font-size:10pt;color:${subColor};">${esc(sub)}</p>` : ""}
  ${desc ? `<p style="margin:3px 0 0 0;font-size:10.5pt;color:#3E4C5E;">${escNl(desc)}</p>` : ""}
  <p style="margin:0 0 8px 0;font-size:4pt;">&nbsp;</p>`;
}

function wSkills(cv, variant) {
  const names = skillNames(cv);
  if (!names.length) return "";
  if (variant === "pulse") {
    const txt = (cv.skills || [])
      .filter((s) => s.name)
      .map((s) => `${esc(s.name)} (${LEVEL_LABELS[s.level] || "Intermediate"})`)
      .join(" &nbsp;|&nbsp; ");
    return `<p style="margin:0;font-size:10.5pt;">${txt}</p>`;
  }
  const sep = variant === "nordic" ? " &nbsp;&middot;&nbsp; " : ", ";
  return `<p style="margin:0;font-size:10.5pt;">${names.map(esc).join(sep)}</p>`;
}

function wSection(cv, key, variant, accent, align, muted) {
  const title = SECTION_TITLES[key];
  if (key === "skills") {
    const body = wSkills(cv, variant);
    return body ? wHead(title, variant, accent, align) + body : "";
  }
  const items = itemsFor(cv, key);
  if (!items.length) return "";
  return (
    wHead(title, variant, accent, align) +
    items.map((it) => wEntry(it, accent, muted)).join("")
  );
}

function wPhoto(cv, include, size = 72, center = false) {
  if (!include || !cv.photo) return "";
  // Word loads the photo from its URL, so it only appears if that URL is reachable when the .doc opens.
  return `<img src="${esc(cv.photo)}" width="${size}" height="${size}" style="display:block;${center ? "margin:0 auto 10px auto;" : "margin:0 0 8px 0;"}" />`;
}

export function buildWordHtml2(cv, user, opts = {}) {
  const {
    templateId = "aurora",
    accent = "#1B2A41",
    fontFamily = "Georgia, 'Times New Roman', serif",
    lineHeight = 1.5,
    textAlign = "left",
    headingAlign = "left",
    includePhoto = false,
  } = opts;
  const variant = isTemplate2(templateId) ? templateId : "aurora";
  const name = displayName(cv, user);
  const contactArr = contactList(cv, user).map((c) => esc(c.text));
  const contact = contactArr.join("&nbsp;&nbsp;|&nbsp;&nbsp;");
  const bodyStyle = `font-family:${fontFamily};font-size:11pt;line-height:${lineHeight};color:#1B2A41;text-align:${textAlign};`;
  const summary = (style = "") =>
    cv.summary
      ? `<p style="margin:10px 0 4px 0;${style}">${escNl(cv.summary)}</p>`
      : "";
  const order = [
    "experience",
    "projects",
    "education",
    "skills",
    "certifications",
  ];
  let html = `<div style="${bodyStyle}">`;

  if (variant === "compass") {
    const railBg = tintHex(accent, 0.07);
    const left =
      wPhoto(cv, includePhoto, 80) +
      contactArr
        .map(
          (c) =>
            `<p style="margin:0 0 5px 0;font-size:9.5pt;color:#3E4C5E;">${c}</p>`,
        )
        .join("") +
      wSection(cv, "skills", "compass", accent, "left", false).replace(
        /<p style="margin:0;/g,
        '<p style="margin:0 0 2px 0;',
      ) +
      wSection(cv, "education", "compass", accent, "left", true) +
      wSection(cv, "certifications", "compass", accent, "left", true);
    const right =
      `<div style="font-family:Georgia,'Times New Roman',serif;font-size:24pt;color:#1B2A41;text-align:${headingAlign};">${esc(name)}</div>` +
      (cv.headline
        ? `<div style="font-size:12pt;color:${accent};text-align:${headingAlign};margin-top:3px;">${esc(cv.headline)}</div>`
        : "") +
      summary() +
      wSection(cv, "experience", "compass", accent, headingAlign, false) +
      wSection(cv, "projects", "compass", accent, headingAlign, false);
    html += `<table style="width:100%;border-collapse:collapse;"><tr>
      <td width="32%" bgcolor="${railBg}" style="width:32%;background:${railBg};padding:18px;vertical-align:top;">${left}</td>
      <td style="padding:18px 8px 0 22px;vertical-align:top;">${right}</td>
    </tr></table>`;
  } else {
    if (variant === "aurora") {
      const ink = readableOn(accent);
      html += `<table style="width:100%;border-collapse:collapse;" bgcolor="${accent}"><tr><td bgcolor="${accent}" style="background:${accent};padding:16px 20px;color:${ink};text-align:left;">
        ${wPhoto(cv, includePhoto, 64)}
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:24pt;color:${ink};">${esc(name)}</div>
        ${cv.headline ? `<div style="font-size:11.5pt;color:${ink};margin-top:3px;">${esc(cv.headline)}</div>` : ""}
        ${contact ? `<div style="font-size:9.5pt;color:${ink};margin-top:8px;">${contact}</div>` : ""}
      </td></tr></table>`;
    } else if (variant === "ink") {
      html += `<div style="text-align:center;padding-bottom:10px;">
        ${wPhoto(cv, includePhoto, 64, true)}
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:22pt;color:#111827;letter-spacing:3pt;">${esc(name).toUpperCase()}</div>
        ${cv.headline ? `<div style="font-style:italic;font-size:11.5pt;color:#374151;margin-top:3px;">${esc(cv.headline)}</div>` : ""}
        ${contact ? `<div style="font-size:9.5pt;color:#374151;margin-top:6px;">${contact}</div>` : ""}
      </div>`;
    } else {
      const rule =
        variant === "pulse"
          ? `3pt solid ${accent}`
          : variant === "atlas"
            ? `1.5pt solid ${accent}`
            : `.5pt solid #E6EAEE`;
      const nameStyle =
        variant === "nordic"
          ? "font-size:30pt;color:#1B2A41;"
          : variant === "pulse"
            ? "font-size:26pt;font-weight:bold;color:#1B2A41;"
            : "font-size:24pt;color:#1B2A41;";
      html += `<div style="padding-bottom:12px;border-bottom:${rule};">
        ${wPhoto(cv, includePhoto, 64)}
        <div style="font-family:Georgia,'Times New Roman',serif;${nameStyle}">${esc(name)}</div>
        ${cv.headline ? `<div style="font-size:11.5pt;color:${accent};margin-top:3px;">${esc(cv.headline)}</div>` : ""}
        ${contact ? `<div style="font-size:9.5pt;color:#5B6B7F;margin-top:8px;">${contact}</div>` : ""}
      </div>`;
    }

    html += summary(variant === "ink" ? "text-align:justify;" : "");

    const muted = variant === "ink" || variant === "nordic";
    const ord =
      variant === "pulse"
        ? ["experience", "projects", "skills", "education", "certifications"]
        : variant === "ink"
          ? ["experience", "projects", "education", "skills", "certifications"]
          : order;
    ord.forEach((key) => {
      html += wSection(
        cv,
        key,
        variant,
        accent,
        variant === "ink" ? "center" : headingAlign,
        muted,
      );
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
