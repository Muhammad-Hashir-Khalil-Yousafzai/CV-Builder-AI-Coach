import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, FileText, Gauge, Briefcase, Bookmark, ShieldCheck, LogOut, Menu, X, FileCheck2, ListChecks, MessageCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profile", label: "My CV", icon: FileText },
  { to: "/ats", label: "ATS & Improve", icon: Gauge },
  { to: "/job-matches", label: "Job Matches", icon: Briefcase },
  { to: "/tracker", label: "Tracker", icon: ListChecks },
  { to: "/coach", label: "AI Coach", icon: MessageCircle },
  { to: "/versions", label: "Saved CVs", icon: Bookmark },
];

// Sticky top bar (h-14). Desktop: logo left, tabs centered, user + logout right.
// Mobile: logo + menu button (drawer) + logout icon.
export default function TopNav() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const links = isAdmin ? [...LINKS, { to: "/admin", label: "Admin", icon: ShieldCheck }] : LINKS;

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const initial = (user?.email || "U")[0].toUpperCase();

  return (
    <>
      <nav className="sticky top-0 z-50 h-14 bg-white/90 backdrop-blur-md border-b border-[#DDE3E8] shadow-[0_1px_8px_rgba(27,42,65,.05)]">
        <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(true)} aria-label="Open menu" className="md:hidden grid place-items-center w-10 h-10 rounded-lg text-[#1B2A41] hover:bg-[#F3F5F7]">
              <Menu size={22} />
            </button>
            <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-[#1B2A41] text-[#D8B873]"><FileCheck2 size={18} /></span>
              <span className="font-serif text-lg text-[#1B2A41] hidden sm:block">CV Builder</span>
            </Link>
          </div>

          <div className="hidden md:flex justify-center items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 rounded-lg px-3 min-h-[40px] text-sm font-medium transition ${
                    isActive ? "text-[#8A6529] bg-[#F6EEDD]" : "text-[#3E4C5E] hover:bg-[#F3F5F7] hover:text-[#1B2A41]"}`}>
                {({ isActive }) => (
                  <>
                    <Icon size={16} />
                    <span className="whitespace-nowrap">{label}</span>
                    {isActive && <motion.span layoutId="navUnderline" className="absolute left-3 right-3 -bottom-[7px] h-[2px] rounded bg-[#A47E3B]" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
          <div className="md:hidden" />

          <div className="flex items-center gap-2 justify-end">
            <span className="hidden xl:block text-xs text-[#9AA6B2] truncate max-w-[180px]">{user?.email}</span>
            <span className="hidden sm:grid place-items-center w-8 h-8 rounded-full bg-[#F6EEDD] text-[#8A6529] text-sm font-semibold">{initial}</span>
            <button onClick={logout} aria-label="Log out" title="Log out"
              className="grid place-items-center w-10 h-10 rounded-lg text-[#8A6529] hover:bg-[#F6EEDD] hover:text-[#6B4E1D] transition">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <>
            <motion.div key="bd" className="fixed inset-0 z-[60] bg-[#1B2A41]/50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside key="dr" className="fixed top-0 left-0 bottom-0 z-[61] w-72 max-w-[85%] bg-white shadow-2xl md:hidden flex flex-col"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }}>
              <div className="h-14 px-4 flex items-center justify-between border-b border-[#DDE3E8]">
                <span className="font-serif text-lg text-[#1B2A41]">CV Builder</span>
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid place-items-center w-10 h-10 rounded-lg hover:bg-[#F3F5F7]"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {links.map(({ to, label, icon: Icon }, i) => (
                  <motion.div key={to} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.05 }}>
                    <NavLink to={to}
                      className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 min-h-[48px] text-[15px] font-medium transition ${isActive ? "bg-[#F6EEDD] text-[#8A6529]" : "text-[#3E4C5E] hover:bg-[#F3F5F7]"}`}>
                      <Icon size={19} />{label}
                    </NavLink>
                  </motion.div>
                ))}
              </div>
              <div className="p-4 border-t border-[#DDE3E8] text-xs text-[#9AA6B2] truncate">{user?.email}</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
