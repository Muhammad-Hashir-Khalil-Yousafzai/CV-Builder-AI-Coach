import { useEffect, useRef, useState } from "react";
import FunLoader from "./FunLoader";

export const SIGN_IN_MESSAGES = ["Verifying your account", "Securing your session", "Preparing your workspace"];

const CSS = `
@keyframes blSpin{to{transform:rotate(360deg)}}
@keyframes blPulse{0%{transform:scale(.72);opacity:.55}100%{transform:scale(1.3);opacity:0}}
@keyframes blLetter{from{opacity:0;transform:translateY(20px);filter:blur(6px)}to{opacity:1;transform:none;filter:blur(0)}}
@keyframes blFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes blSweep{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
@keyframes blDot{0%,80%,100%{opacity:.25}40%{opacity:1}}
@keyframes blFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.bl-spin{animation:blSpin 1.4s linear infinite;transform-origin:center}
.bl-pulse{animation:blPulse 2s ease-out infinite}
.bl-pulse2{animation-delay:1s}
.bl-letter{display:inline-block;opacity:0;animation:blLetter .7s cubic-bezier(.22,1,.36,1) forwards}
.bl-fade{opacity:0;animation:blFade .55s ease-out forwards}
.bl-sweep{animation:blSweep 1.4s ease-in-out infinite}
.bl-dot{animation:blDot 1.2s infinite}
.bl-float{animation:blFloat 3s ease-in-out infinite}
.bl-par{transition:transform .25s ease-out;transform:translate(calc(var(--mx,0) * 14px),calc(var(--my,0) * 14px));will-change:transform}
@media (prefers-reduced-motion:reduce){
  .bl-spin,.bl-pulse,.bl-sweep,.bl-dot,.bl-float{animation:none}
  .bl-letter,.bl-fade{animation:none;opacity:1;filter:none;transform:none}
  .bl-par{transition:none;transform:none}
}`;

// Shared across remounts, so the route-loading fallback and the page that replaces it
// (e.g. /auth/callback) look like ONE continuous screen instead of replaying the intro.
const shared = { start: 0, last: 0, revealed: false };

function Mark({ size = 96 }) {
  const inset = Math.round(size * 0.125);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <span className="bl-pulse absolute inset-0 rounded-full" style={{ border: "1px solid rgba(15,118,110,.35)" }} />
      <span className="bl-pulse bl-pulse2 absolute inset-0 rounded-full" style={{ border: "1px solid rgba(15,118,110,.35)" }} />
      <svg className="bl-spin absolute inset-0" viewBox="0 0 96 96" fill="none" aria-hidden="true">
        <circle cx="48" cy="48" r="44" stroke="#E2E8E6" strokeWidth="3" />
        <circle cx="48" cy="48" r="44" stroke="#0F766E" strokeWidth="3" strokeLinecap="round" strokeDasharray="70 210" />
      </svg>
      <div className="bl-float absolute flex items-center justify-center rounded-2xl bg-white shadow-lg" style={{ inset }}>
        <svg width={size * 0.31} height={size * 0.31} viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6M9 17h4" />
        </svg>
      </div>
    </div>
  );
}

// Full-screen branded loader (covers the navbar). Used for route loading and sign-in.
export default function BrandLoader({ title = "Loading", messages = ["Reading your CV", "Scanning for keywords", "Polishing the details", "Almost there"] }) {
  const first = useRef(null);
  if (first.current === null) {
    const t = Date.now();
    if (t - shared.last > 1500) {
      shared.start = t; // a fresh loading session
      shared.revealed = false;
    }
    first.current = {
      animate: !shared.revealed,
      idx0: Math.min(messages.length - 1, Math.floor((t - shared.start) / 1400)),
      phase: Math.round(performance.now()) % 1400,
    };
  }
  const { animate, idx0, phase } = first.current;
  const [now, setNow] = useState(() => Date.now());
  const wrap = useRef(null);

  useEffect(() => {
    shared.revealed = true;
    const id = setInterval(() => {
      shared.last = Date.now();
      setNow(Date.now());
    }, 300);
    return () => {
      shared.last = Date.now();
      clearInterval(id);
    };
  }, []);

  const idx = Math.min(messages.length - 1, Math.floor((now - shared.start) / 1400));
  const fadeMsg = animate || idx !== idx0;

  // Tiny interactive touch: the logo mark drifts toward the pointer.
  const onMove = (e) => {
    const el = wrap.current;
    if (!el) return;
    el.style.setProperty("--mx", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
    el.style.setProperty("--my", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
  };

  return (
    <div
      onMouseMove={onMove}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "radial-gradient(circle at 50% 38%, #FFFFFF 0%, #F3F5F7 62%)" }}
      role="status"
      aria-live="polite"
    >
      <style>{CSS}</style>
      <span className="sr-only">{title}. {messages[idx]}.</span>

      <div ref={wrap} className="bl-par">
        <Mark />
      </div>

      <p className={`${animate ? "bl-fade" : ""} mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-[#0F766E]`}>CV Builder</p>

      <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-[#1B1F27] sm:text-5xl" aria-hidden="true">
        {animate
          ? [...title].map((ch, i) => (
              <span key={i} className="bl-letter" style={{ animationDelay: `${150 + i * 55}ms` }}>
                {ch === " " ? "\u00A0" : ch}
              </span>
            ))
          : title}
      </h1>

      <div className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-stone-200">
        <div className="bl-sweep h-full w-1/3 rounded-full bg-[#0F766E]" style={{ animationDelay: `-${phase}ms` }} />
      </div>

      <p key={idx} className={`${fadeMsg ? "bl-fade" : ""} mt-4 text-sm text-[#6B7280]`}>
        {messages[idx]}
        <span className="bl-dot">.</span>
        <span className="bl-dot" style={{ animationDelay: ".2s" }}>.</span>
        <span className="bl-dot" style={{ animationDelay: ".4s" }}>.</span>
      </p>
    </div>
  );
}

// Content-area loader while a page's code/data loads (the navbar stays visible).
export function PageLoader({ label = "Loading your CV" }) {
  return <FunLoader title={label} />;
}
