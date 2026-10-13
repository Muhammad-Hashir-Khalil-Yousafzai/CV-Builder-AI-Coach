import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import LoadError from "../components/common/LoadError";
import { cacheGet, cacheSet } from "../lib/cache";
import { CvDocument, CV_TEMPLATES } from "./CvTemplates";

const CSS = `
  @keyframes vsUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  @keyframes vsSpin{to{transform:rotate(360deg)}}
  @keyframes vsShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
  .vs-up{opacity:0;animation:vsUp .4s ease-out forwards}
  .vs-spin{width:14px;height:14px;border:2px solid #E3E8EF;border-top-color:#A47E3B;border-radius:50%;animation:vsSpin .7s linear infinite;flex:none}
  .vs-btn{transition:transform .15s,background-color .15s,box-shadow .15s}
  .vs-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 2px 8px rgba(27,42,65,.15)}
  .vs-btn:active:not(:disabled){transform:scale(.97)}
  .vs-btn:disabled{opacity:.5;cursor:not-allowed}
  .vs-skel{position:relative;overflow:hidden;background:#E9EDF1;border-radius:12px}
  .vs-skel:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);animation:vsShimmer 1.2s linear infinite}
  @media (prefers-reduced-motion:reduce){.vs-up{animation:none;opacity:1}}
`;

const fmt = (iso) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const countText = (c) =>
  [["experience", "job"], ["education", "education"], ["skills", "skill"], ["projects", "project"], ["certifications", "certification"]]
    .filter(([k]) => c[k] > 0)
    .map(([k, w]) => `${c[k]} ${w}${c[k] === 1 || w === "education" ? "" : "s"}`)
    .join(" · ") || "Empty CV";

function PreviewModal({ state, user, onClose }) {
  const [tpl, setTpl] = useState(CV_TEMPLATES[0].id);
  return (
    <div className="fixed inset-0 z-[60] bg-[#1B2A41]/60 flex flex-col" role="dialog" aria-modal="true">
      <div className="bg-white border-b border-[#DDE3E8] px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{state.version?.name || "Loading…"}</p>
          {state.version && <p className="text-xs text-[#5B6B7F]">{fmt(state.version.created_at)}</p>}
        </div>
        <select value={tpl} onChange={(e) => setTpl(e.target.value)} className="text-sm border border-[#DDE3E8] rounded-md px-2 py-2 bg-white min-h-[40px]">
          {CV_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
        </select>
        <button onClick={onClose} className="vs-btn text-sm font-medium border border-[#DDE3E8] rounded-md px-4 py-2 min-h-[40px]">Close</button>
      </div>
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        {state.loading || !state.version ? (
          <div className="vs-skel mx-auto h-[70vh] max-w-[8.3in]" />
        ) : (
          <div className="shadow-xl mx-auto bg-white" style={{ maxWidth: "100%" }}>
            <CvDocument cv={state.version.data} user={user} templateId={tpl} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function VersionsPage() {
  const { user } = useAuth();
  const cacheKey = `${user?.email || ""}:versions`;
  const [versions, setVersions] = useState(() => cacheGet(cacheKey) || null);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // { id, type: "restore" | "delete" }
  const [busy, setBusy] = useState(null); // { id, type }
  const [preview, setPreview] = useState(null); // { loading, version }

  const load = () => {
    setError(null);
    return api.get("/profile/versions/").then((r) => { setVersions(r.data); cacheSet(cacheKey, r.data); }).catch((err) => { if (!cacheGet(cacheKey)) setError({ status: err.response?.status || 0 }); });
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/profile/versions/", { name });
      setName("");
      await load();
      toast.success("Saved. This version is now in your list.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't save this version");
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async (v) => {
    setPreview({ loading: true, version: null });
    try {
      const { data } = await api.get(`/profile/versions/${v.id}/`);
      setPreview({ loading: false, version: data });
    } catch {
      setPreview(null);
      toast.error("Couldn't open that version");
    }
  };

  const act = async (v, type) => {
    setBusy({ id: v.id, type });
    try {
      if (type === "restore") {
        await api.post(`/profile/versions/${v.id}/restore/`);
        toast.success("Restored. Your previous CV was auto-saved first.", { duration: 6000 });
      } else {
        await api.delete(`/profile/versions/${v.id}/`);
        toast.success("Deleted");
      }
      setConfirm(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F5F7] text-[#1B2A41]">
      <style>{CSS}</style>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
        <header className="vs-up">
          <h1 className="font-serif text-2xl sm:text-3xl">Saved CVs</h1>
          <p className="text-sm text-[#5B6B7F] mt-1">
            Keep copies of your CV, preview them, and restore any of them. Your photo and project images aren't part of saved versions.
          </p>
        </header>

        <section className="vs-up bg-white rounded-xl border border-[#DDE3E8] p-4 sm:p-5" style={{ animationDelay: "60ms" }}>
          <p className="text-sm font-medium">Save your current CV as a new version</p>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <input
              value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
              onKeyDown={(e) => e.key === "Enter" && !saving && save()}
              placeholder='Name it, e.g. "Data Engineer – Acme" (optional)'
              className="flex-1 border border-[#DDE3E8] focus:border-[#A47E3B] outline-none rounded-md px-3 py-2.5 text-sm"
            />
            <button onClick={save} disabled={saving} className="vs-btn text-sm font-medium text-white bg-[#1B2A41] rounded-md px-5 py-2.5 min-h-[44px] flex items-center justify-center gap-2">
              {saving ? <><span className="vs-spin" />Saving…</> : "Save version"}
            </button>
          </div>
        </section>

        {error && <LoadError status={error.status} what="your saved CVs" onRetry={load} />}
        {!versions && !error && (<div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="vs-skel h-24" />)}</div>)}

        {versions && versions.length === 0 && (
          <div className="vs-up text-center bg-white rounded-xl border border-dashed border-[#C9D1DA] p-8">
            <p className="text-3xl">📄</p>
            <p className="mt-2 font-medium">No saved CVs yet</p>
            <p className="text-sm text-[#5B6B7F] mt-1">Save your current CV above. We also auto-save before every import or restore.</p>
          </div>
        )}

        <ul className="space-y-3">
          {(versions || []).map((v, i) => {
            const asking = confirm?.id === v.id ? confirm.type : null;
            const working = busy?.id === v.id ? busy.type : null;
            return (
              <li key={v.id} className="vs-up bg-white rounded-xl border border-[#DDE3E8] p-4 sm:p-5" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{v.name}</p>
                    <p className="text-xs text-[#5B6B7F] mt-0.5">{fmt(v.created_at)}{v.headline ? ` · ${v.headline}` : ""}</p>
                  </div>
                  <span className={`text-[11px] font-semibold rounded-full px-2.5 py-1 ${v.kind === "manual" ? "bg-[#F6EEDD] text-[#8A6529]" : "bg-[#EEF1F5] text-[#5B6B7F]"}`}>
                    {v.kind_label}
                  </span>
                </div>
                <p className="text-sm text-[#5B6B7F] mt-2">{countText(v.counts)}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {working ? (
                    <span className="flex items-center gap-2 text-sm text-[#8A6529] min-h-[40px]"><span className="vs-spin" />{working === "restore" ? "Restoring your CV…" : "Deleting…"}</span>
                  ) : asking ? (
                    <>
                      <span className="text-sm text-[#1B2A41] w-full sm:w-auto">
                        {asking === "restore" ? "Replace your current CV with this one? Your current CV is auto-saved first." : "Delete this saved CV?"}
                      </span>
                      <button onClick={() => act(v, asking)} className={`vs-btn text-sm font-medium text-white rounded-md px-4 py-2 min-h-[40px] ${asking === "delete" ? "bg-[#B4442F]" : "bg-[#A47E3B]"}`}>
                        {asking === "restore" ? "Yes, restore" : "Yes, delete"}
                      </button>
                      <button onClick={() => setConfirm(null)} className="vs-btn text-sm border border-[#DDE3E8] rounded-md px-4 py-2 min-h-[40px]">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => openPreview(v)} className="vs-btn text-sm font-medium border border-[#DDE3E8] rounded-md px-4 py-2 min-h-[40px]">Preview</button>
                      <button onClick={() => setConfirm({ id: v.id, type: "restore" })} className="vs-btn text-sm font-medium text-[#8A6529] border border-[#A47E3B] rounded-md px-4 py-2 min-h-[40px]">Restore</button>
                      <button onClick={() => setConfirm({ id: v.id, type: "delete" })} className="vs-btn text-sm text-[#B4442F] rounded-md px-3 py-2 min-h-[40px]">Delete</button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </main>

      {preview && <PreviewModal state={preview} user={user} onClose={() => setPreview(null)} />}
    </div>
  );
}
