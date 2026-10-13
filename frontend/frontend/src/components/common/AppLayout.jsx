import { Suspense } from "react";
import TopNav from "./TopNav";
import { PageLoader } from "./BrandLoader";

// Wraps every logged-in page with the top navigation bar.
export default function AppLayout({ children }) {
  return (
    <>
      <TopNav />
      {/* Nested boundary: while a page's code loads, the navbar stays and only this area shows a loader. */}
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </>
  );
}
