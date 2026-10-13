import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Download, Copy, RefreshCw, X } from "lucide-react";
import api from "../../api/axios";

const letterCache = new Map(); // reopening the same job is instant

export default function CoverLetterModal({ job, onClose }) {
  const [text, setText] = useState(() => letterCache.get(job.id) || "");
  const [loading, setLoading] = useState(!letterCache.has(job.id));
  const [error, setError] = useState("");

  const generate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/jobs/cover-letter/", { job_id: job.id });
      letterCache.set(job.id, data.letter);
      setText(data.letter);
    } catch (e) {
      setError(e.response?.data?.detail || "Couldn't generate the letter. Try again.");
    } finally {
      setLoading(false);
    }
  }, [job.id]);

  useEffect(() => { if (!letterCache.has(job.id)) generate(); }, [job.id, generate]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const downloadPdf = async () => {
    const { jsPDF } = await import("jspdf"); // loaded only when needed
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(text, 595 - 144);
    let y = 72;
    for (const line of lines) {
      if (y > 770) { doc.addPage(); y = 72; }
      doc.text(line, 72, y);
      y += 18;
    }
    const safe = (job.company || "Company").replace(/[^a-z0-9]+/gi, "_");
    doc.save(`Cover_Letter_${safe}.pdf`);
  };

  const copy = () => navigator.clipboard.writeText(text).then(() => toast.success("Copied"));

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Cover letter" className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#E3E8EF] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#1B2A41]">Cover letter</h2>
            <p className="truncate text-sm text-[#5B6B7F]">{job.title}{job.company ? ` · ${job.company}` : ""}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-[#9AA6B2] hover:bg-[#EEF1F4]"><X size={16} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              {[95, 100, 88, 100, 70, 100, 92, 60].map((w, i) => (
                <div key={i} className="job-skel h-3.5 rounded" style={{ width: `${w}%` }} />
              ))}
              <p className="pt-2 text-xs text-[#9AA6B2]">Writing your letter…</p>
            </div>
          ) : error ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
          ) : (
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14}
              className="w-full resize-y rounded-lg border border-[#E3E8EF] bg-[#FAFBFC] p-3 text-sm leading-relaxed text-[#1B2A41] outline-none focus:border-[#A47E3B]" />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E3E8EF] px-5 py-3">
          <button onClick={generate} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md border border-[#E3E8EF] px-3 py-2 text-sm font-medium text-[#5B6B7F] hover:bg-[#F4F6F8] disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "job-spin" : ""} /> Regenerate
          </button>
          <button onClick={copy} disabled={!text || loading} className="inline-flex items-center gap-1.5 rounded-md border border-[#E3E8EF] px-3 py-2 text-sm font-medium text-[#5B6B7F] hover:bg-[#F4F6F8] disabled:opacity-50">
            <Copy size={14} /> Copy
          </button>
          <button onClick={downloadPdf} disabled={!text || loading} className="inline-flex items-center gap-1.5 rounded-md bg-[#1B2A41] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2C4268] disabled:opacity-50">
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
