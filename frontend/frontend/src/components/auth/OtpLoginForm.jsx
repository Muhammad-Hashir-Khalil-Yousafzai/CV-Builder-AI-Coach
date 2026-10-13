import React, { useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Mail, KeyRound, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function OtpLoginForm({ onBack }) {
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState("email"); // "email" | "code"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await requestOtp(email.trim().toLowerCase());
    setSubmitting(false);

    if (result.success) {
      toast.success("Code sent — check your inbox.");
      setStep("code");
    } else {
      setError(result.fieldErrors.detail || "Could not send code. Check the email and try again.");
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await verifyOtp({ email: email.trim().toLowerCase(), token: code.trim() });
    setSubmitting(false);

    if (result.success) {
      navigate(result.user.role === "admin" ? "/admin" : "/dashboard");
    } else {
      setError(result.fieldErrors.detail || "Invalid or expired code.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full max-w-sm space-y-4"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#1B1F27]"
      >
        <ArrowLeft size={14} />
        Back to password login
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-[#1B1F27]">Sign in with a code</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {step === "email"
            ? "We'll email you a one-time code — no password needed."
            : `Enter the code we sent to ${email}.`}
        </p>
      </div>

      {step === "email" ? (
        <form onSubmit={handleRequestCode} className="space-y-4">
          <Field icon={Mail} label="Email" error={error}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-transparent outline-none text-sm"
            />
          </Field>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-[#1B1F27] text-white py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            {submitting ? "Sending..." : "Send code"}
          </motion.button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <Field icon={KeyRound} label="6-digit code" error={error}>
            <input
              type="text"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-full bg-transparent outline-none text-sm tracking-widest"
            />
          </Field>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-[#1B1F27] text-white py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {submitting ? "Verifying..." : "Verify & log in"}
          </motion.button>

          <button
            type="button"
            onClick={() => setStep("email")}
            className="w-full text-xs text-[#6B7280] hover:text-[#1B1F27] text-center"
          >
            Use a different email
          </button>
        </form>
      )}
    </motion.div>
  );
}

function Field({ icon: Icon, label, error, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#6B7280]">{label}</span>
      <div
        className={`mt-1 flex items-center gap-2 rounded-md border px-3 py-2 ${
          error ? "border-[#B34B3E]" : "border-[#E4E1D9]"
        }`}
      >
        <Icon size={15} className="text-[#6B7280]" />
        {children}
      </div>
      {error && <span className="text-xs text-[#B34B3E] mt-1 block">{error}</span>}
    </label>
  );
}
