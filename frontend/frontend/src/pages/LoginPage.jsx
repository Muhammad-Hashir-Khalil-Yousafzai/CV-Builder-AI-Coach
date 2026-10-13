import React from "react";
import { motion } from "framer-motion";
import LoginForm from "../components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex flex-1 relative items-end p-10 overflow-hidden"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-[#1B1F27]/60" />
        <div className="relative text-white max-w-sm">
          <p className="text-lg font-medium leading-snug">Welcome back.</p>
          <p className="text-sm text-white/70 mt-2">
            Your CV picked up right where you left it.
          </p>
        </div>
      </motion.div>

      <div className="flex-1 flex items-center justify-center px-6 bg-[#F5F6F3]">
        <LoginForm />
      </div>
    </div>
  );
}
