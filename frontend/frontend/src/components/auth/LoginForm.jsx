import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useNavigate, Link } from "react-router-dom";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import { loginSchema } from "../../schemas/authSchemas";
import { useAuth } from "../../context/AuthContext";
import GoogleButton from "./GoogleButton";
import OtpLoginForm from "./OtpLoginForm";

export default function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState("password"); // "password" | "otp"

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values) => {
    setSubmitting(true);
    const result = await login(values);
    setSubmitting(false);

    if (result.success) {
      navigate(result.user.role === "admin" ? "/admin" : "/dashboard");
      return;
    }

    const { fieldErrors } = result;
    toast.error(fieldErrors.non_field_errors?.[0] || fieldErrors.detail || "Incorrect email or password.");
    setError("password", { message: " " }); // highlights the field without duplicating the toast text
  };

  if (mode === "otp") {
    return <OtpLoginForm onBack={() => setMode("password")} />;
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-sm space-y-4"
    >
      <div>
        <h1 className="text-2xl font-semibold text-[#1B1F27]">Welcome back</h1>
        <p className="text-sm text-[#6B7280] mt-1">Log in to keep editing your CV.</p>
      </div>

      <GoogleButton />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#E4E1D9]" />
        <span className="text-xs text-[#6B7280]">or</span>
        <div className="h-px flex-1 bg-[#E4E1D9]" />
      </div>

      <Field icon={Mail} label="Email" error={errors.email?.message}>
        <input
          {...register("email")}
          type="email"
          placeholder="you@example.com"
          className="w-full bg-transparent outline-none text-sm"
        />
      </Field>

      <Field icon={Lock} label="Password" error={errors.password?.message}>
        <input
          {...register("password")}
          type="password"
          placeholder="Your password"
          className="w-full bg-transparent outline-none text-sm"
        />
      </Field>

      <motion.button
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-[#1B1F27] text-white py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
        {submitting ? "Logging in..." : "Log in"}
      </motion.button>

      <button
        type="button"
        onClick={() => setMode("otp")}
        className="w-full text-xs text-[#6B7280] hover:text-[#1B1F27] text-center underline underline-offset-2"
      >
        Sign in with a one-time code instead
      </button>

      <p className="text-sm text-[#6B7280] text-center">
        Don't have an account?{" "}
        <Link to="/signup" className="text-[#1B1F27] font-medium underline underline-offset-2">
          Sign up
        </Link>
      </p>
    </motion.form>
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
      {error && error.trim() && <span className="text-xs text-[#B34B3E] mt-1 block">{error}</span>}
    </label>
  );
}