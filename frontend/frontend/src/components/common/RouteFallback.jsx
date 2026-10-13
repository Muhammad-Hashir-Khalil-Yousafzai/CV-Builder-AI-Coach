import { useLocation } from "react-router-dom";
import BrandLoader, { SIGN_IN_MESSAGES } from "./BrandLoader";

// Shown while a route's code downloads. On the sign-in return page it shows the SAME screen the
// page itself uses, so "loading" and "signing you in" read as one continuous screen.
export default function RouteFallback() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/auth/callback")) return <BrandLoader title="Signing you in" messages={SIGN_IN_MESSAGES} />;
  return <BrandLoader title="Loading" />;
}
