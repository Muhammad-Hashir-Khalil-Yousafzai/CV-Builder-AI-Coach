import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

// Set VITE_SUPABASE_URL in your .env (same value as your Django SUPABASE_URL).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
console.log("SUPABASE_URL:", SUPABASE_URL);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session

  useEffect(() => {
    const access = localStorage.getItem("access");
    if (!access) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me/")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
      })
      .finally(() => setLoading(false));
  }, []);

  const checkEmail = async (email) => {
    const { data } = await api.get("/auth/check-email/", { params: { email } });
    return data.available;
  };

  const signup = async ({ fullName, email, password, confirmPassword }) => {
    const [first_name, ...rest] = fullName.trim().split(" ");
    const last_name = rest.join(" ") || first_name; // fallback if only one word given

    try {
      const { data } = await api.post("/auth/signup/", {
        email,
        password,
        password2: confirmPassword,
        first_name,
        last_name,
      });
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      const fieldErrors = err.response?.data || {};
      return { success: false, fieldErrors };
    }
  };

  const login = async ({ email, password }) => {
    try {
      const { data } = await api.post("/auth/login/", { email, password });
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      const fieldErrors = err.response?.data || {};
      return { success: false, fieldErrors };
    }
  };

  const logout = async () => {
    const refresh = localStorage.getItem("refresh");
    try {
      if (refresh) await api.post("/auth/logout/", { refresh });
    } catch {
      // even if this fails, still clear the client side below
    }
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setUser(null);
  };

  // ---------------------------------------------------------------------
  // Supabase-backed auth: Google OAuth + Email OTP
  // ---------------------------------------------------------------------

  /** Redirects the browser to Supabase's Google OAuth URL. Called on button click. */
  const loginWithGoogle = () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    window.location.href =
      `${SUPABASE_URL}/auth/v1/authorize` +
      `?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  };

  /**
   * Called by the /auth/callback page once it has parsed access_token out of
   * the URL fragment Supabase redirects back with. Exchanges it for this
   * app's own access/refresh pair via the Django backend.
   */
  const exchangeSupabaseToken = async (accessToken) => {
    try {
      const { data } = await api.post("/auth/supabase/exchange/", {
        access_token: accessToken,
      });
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      const fieldErrors = err.response?.data || {};
      return { success: false, fieldErrors };
    }
  };

  /** Step 1 of OTP login: ask Supabase to email a 6-digit code. */
  const requestOtp = async (email) => {
    try {
      await api.post("/auth/otp/request/", { email });
      return { success: true };
    } catch (err) {
      const fieldErrors = err.response?.data || {};
      return { success: false, fieldErrors };
    }
  };

  /** Step 2 of OTP login: verify the code the user typed in. */
  const verifyOtp = async ({ email, token }) => {
    try {
      const { data } = await api.post("/auth/otp/verify/", { email, token });
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      const fieldErrors = err.response?.data || {};
      return { success: false, fieldErrors };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        checkEmail,
        signup,
        login,
        logout,
        loginWithGoogle,
        exchangeSupabaseToken,
        requestOtp,
        verifyOtp,
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);