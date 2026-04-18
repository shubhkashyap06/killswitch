import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig } from "@/lib/wagmi";
import { ThreatProvider } from "@/context/ThreatContext";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useAccount } from "wagmi";

import Index        from "./pages/Index.tsx";
import Landing      from "./pages/Landing.tsx";
import Transactions from "./pages/Transactions.tsx";
import Alerts       from "./pages/Alerts.tsx";
import Analytics    from "./pages/Analytics.tsx";
import Settings     from "./pages/Settings.tsx";
import NotFound     from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

// SEO Component for Dynamic Titles
const PageTracker = () => {
  const location = useLocation();
  useEffect(() => {
    const titleMap: Record<string, string> = {
      "/":              "Welcome | Killswitch",
      "/dashboard":      "Dashboard | Killswitch",
      "/transactions":  "Ledger | Killswitch",
      "/alerts":        "Incidents | Killswitch",
      "/analytics":     "Intelligence | Killswitch",
      "/settings":      "Governance | Killswitch",
    };
    document.title = titleMap[location.pathname] || "Killswitch";
  }, [location]);
  return null;
};

// Auth guard — redirect to /landing if wallet not connected
function RequireWallet({ children }: { children: React.ReactNode }) {
  const { isConnected, isReconnecting } = useAccount();
  // Wait for reconnecting to settle before redirect
  if (isReconnecting) return null;
  if (!isConnected) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, x: 10 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -10 }}
    transition={{ duration: 0.25, ease: "easeInOut" }}
    className="w-full h-full"
  >
    {children}
  </motion.div>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Landing */}
        <Route path="/" element={<PageTransition><Landing /></PageTransition>} />

        {/* Protected — wallet required */}
        <Route path="/dashboard"    element={<RequireWallet><PageTransition><Index /></PageTransition></RequireWallet>} />
        <Route path="/transactions" element={<RequireWallet><PageTransition><Transactions /></PageTransition></RequireWallet>} />
        <Route path="/alerts"       element={<RequireWallet><PageTransition><Alerts /></PageTransition></RequireWallet>} />
        <Route path="/analytics"    element={<RequireWallet><PageTransition><Analytics /></PageTransition></RequireWallet>} />
        <Route path="/settings"     element={<RequireWallet><PageTransition><Settings /></PageTransition></RequireWallet>} />

        {/* Root redirect — go to landing if not connected */}
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={darkTheme({ borderRadius: "small", accentColor: "#3b82f6" })}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ThreatProvider>
              <PageTracker />
              <AnimatedRoutes />
            </ThreatProvider>
          </BrowserRouter>
        </TooltipProvider>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
