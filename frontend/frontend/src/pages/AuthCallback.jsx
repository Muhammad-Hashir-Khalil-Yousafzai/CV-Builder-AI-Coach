import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import BrandLoader, { SIGN_IN_MESSAGES } from "../components/common/BrandLoader";

/**
 * Route this at /auth/callback — it's where Supabase redirects back to after
 * Google OAuth. Supabase puts the session in the URL fragment
 * (#access_token=...), which the browser never sends to a server, so this
 * page reads it client-side and hands it to Django to exchange for our own
 * access/refresh pair.
 */
export default function AuthCallback() {
  const { exchangeSupabaseToken } = useAuth();
  const navigate = useNavigate();
  const ran = useRef(false); // guards against double-run in React StrictMode

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = params.get("access_token");
      console.log("ACCESS TOKEN:", accessToken);
      const errorDescription = params.get("error_description");

      if (errorDescription) {
        toast.error(decodeURIComponent(errorDescription));
        navigate("/login");
        return;
      }

      if (!accessToken) {
        toast.error("Sign-in did not complete. Please try again.");
        navigate("/login");
        return;
      }

      const result = await exchangeSupabaseToken(accessToken);

      if (result.success) {
        navigate(result.user.role === "admin" ? "/admin" : "/dashboard");
      } else {
        toast.error(result.fieldErrors.detail || "Could not complete sign-in.");
        navigate("/login");
      }
    };

    run();
  }, [exchangeSupabaseToken, navigate]);

  return <BrandLoader title="Signing you in" messages={SIGN_IN_MESSAGES} />;
}
