import { Suspense, lazy } from "react";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Skeleton } from "@/components/ui";
import { StoreProvider } from "@/state/store";

import Home from "@/screens/Home";
import Search from "@/screens/Search";
import Results from "@/screens/Results";

// Everything past the three core screens is split out so first paint stays light.
const OfferDetail = lazy(() => import("@/screens/OfferDetail"));
const Ticket = lazy(() => import("@/screens/Ticket"));
const Hotels = lazy(() => import("@/screens/Hotels"));
const HotelDetail = lazy(() => import("@/screens/HotelDetail"));
const Cars = lazy(() => import("@/screens/Cars"));
const Packages = lazy(() => import("@/screens/Packages"));
const Esim = lazy(() => import("@/screens/Esim"));
const Planner = lazy(() => import("@/screens/Planner"));
const Assistant = lazy(() => import("@/screens/Assistant"));
const Trips = lazy(() => import("@/screens/Trips"));
const Deals = lazy(() => import("@/screens/Deals"));
const More = lazy(() => import("@/screens/More"));
const Profile = lazy(() => import("@/screens/Profile"));
const Notifications = lazy(() => import("@/screens/Notifications"));

/** Tabs keep the bar; pushed detail screens are full-bleed. */
const TAB_ROUTES = ["/", "/trips", "/deals", "/more"];

function Shell() {
  const { pathname } = useLocation();
  const showNav = TAB_ROUTES.includes(pathname);

  return (
    <div className="app-shell">
      <Suspense
        fallback={
          <div className="screen space-y-3 px-5 pt-16">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/results" element={<Results />} />
          <Route path="/offer/:offerId" element={<OfferDetail />} />
          <Route path="/ticket/:bookingId" element={<Ticket />} />
          <Route path="/hotels" element={<Hotels />} />
          <Route path="/hotels/:hotelId" element={<HotelDetail />} />
          <Route path="/cars" element={<Cars />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/esim" element={<Esim />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/more" element={<More />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
      {showNav && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      {/* HashRouter keeps deep links working from a file:// WebView and from
          GitHub Pages, neither of which can rewrite unknown paths. */}
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  );
}
