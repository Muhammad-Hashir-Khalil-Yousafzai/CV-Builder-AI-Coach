import React from "react";
import { motion } from "framer-motion";
import SignupForm from "../components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="min-h-screen w-full flex">
      {/* Form side */}
      <div className="flex-1 flex items-center justify-center px-6 bg-[#F5F6F3]">
        <SignupForm />
      </div>

      {/* Visual side — swap the background image for something that fits your brand */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex flex-1 relative items-end p-10 overflow-hidden"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-[#1B1F27]/60" />
        <div className="relative text-white max-w-sm">
          <p className="text-lg font-medium leading-snug">
            Build a CV that keeps itself up to date.
          </p>
          <p className="text-sm text-white/70 mt-2">
            Edit your details once, use them everywhere.
          </p>
        </div>
      </motion.div>
    </div>
  );
}