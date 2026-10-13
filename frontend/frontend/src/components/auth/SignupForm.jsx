import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useNavigate, Link } from "react-router-dom";
import { UserPlus, Mail, Lock, User, Loader2 } from "lucide-react";
import { signupSchema } from "../../schemas/authSchemas";
import { useAuth } from "../../context/AuthContext";
import GoogleButton from "./GoogleButton";

export default function SignupForm() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (values) => {
    setSubmitting(true);
    const result = await signup(values);
    setSubmitting(false);

    if (result.success) {
      toast.success("Account created!");
      navigate("/dashboard");
      return;
    }

    // Server is the source of truth here — e.g. duplicate email only
    // ever gets caught at this point, not by the schema above.
    const { fieldErrors } = result;
    if (fieldErrors.email) {
      setError("email", { message: Array.isArray(fieldErrors.email) ? fieldErrors.email[0] : fieldErrors.email });
    } else {
      toast.error(fieldErrors.non_field_errors?.[0] || "Something went wrong");
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-sm space-y-4"
    >
      <div>
        <h1 className="text-2xl font-semibold text-[#1B1F27]">Create your account</h1>
        <p className="text-sm text-[#6B7280] mt-1">Start building your CV in minutes.</p>
      </div>

      <GoogleButton />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#E4E1D9]" />
        <span className="text-xs text-[#6B7280]">or sign up with email</span>
        <div className="h-px flex-1 bg-[#E4E1D9]" />
      </div>

      <Field icon={User} label="Full name" error={errors.fullName?.message}>
        <input
          {...register("fullName")}
          type="text"
          placeholder="Jane Doe"
          className="w-full bg-transparent outline-none text-sm"
        />
      </Field>

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
          placeholder="At least 8 characters"
          className="w-full bg-transparent outline-none text-sm"
        />
      </Field>

      <Field icon={Lock} label="Confirm password" error={errors.confirmPassword?.message}>
        <input
          {...register("confirmPassword")}
          type="password"
          placeholder="Repeat your password"
          className="w-full bg-transparent outline-none text-sm"
        />
      </Field>

      <motion.button
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-[#1B1F27] text-white py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
        {submitting ? "Creating account..." : "Sign up"}
      </motion.button>

      <p className="text-sm text-[#6B7280] text-center">
        Already have an account?{" "}
        <Link to="/login" className="text-[#1B1F27] font-medium underline underline-offset-2">
          Log in
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
      {error && <span className="text-xs text-[#B34B3E] mt-1 block">{error}</span>}
    </label>
  );
}