import React from "react";
import { useAuth } from "../../context/AuthContext";

export default function GoogleButton() {
  const { loginWithGoogle } = useAuth();

  return (
    <button
      type="button"
      onClick={loginWithGoogle}
      className="w-full flex items-center justify-center gap-2 rounded-md border border-[#E4E1D9] bg-white py-2.5 text-sm font-medium text-[#1B1F27] hover:bg-[#F5F6F3] transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 16.3 3 9.7 7.4 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.6c-2.1 1.4-4.8 2.3-7.6 2.3-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.6 40.6 16.2 45 24 45z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.6 5.6C41.4 36 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"
        />
      </svg>
      Continue with Google
    </button>
  );
}
