import { Home, BarChart3, Target, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRef, useState, useEffect, useLayoutEffect } from "react";

const tabs = [
  { path: "/", label: "Home", icon: Home },
  { path: "/insights", label: "Insights", icon: BarChart3 },
  { path: "/plan", label: "Plan", icon: Target },
  { path: "/profile", label: "Profile", icon: User },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const navRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const updateIndicator = () => {
    if (!navRef.current) return;
    const activeIndex = tabs.findIndex((t) => t.path === location.pathname);
    if (activeIndex === -1) {
      setIndicator(null);
      return;
    }
    const buttons = navRef.current.querySelectorAll<HTMLButtonElement>("button");
    const btn = buttons[activeIndex];
    if (btn) {
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  };

  useLayoutEffect(() => {
    updateIndicator();
  }, [location.pathname]);

  useEffect(() => {
    // Recalculate after fonts/layout settle
    const raf = requestAnimationFrame(updateIndicator);
    window.addEventListener("resize", updateIndicator);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [location.pathname]);

  if (!session) return null;
  if (location.pathname === "/onboarding") return null;
  if (location.pathname.startsWith("/activity/") || location.pathname.startsWith("/conversation/")) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <nav
        ref={navRef}
        className="relative flex items-center gap-1 bg-card/90 backdrop-blur-xl rounded-full px-2 py-1.5 shadow-soft border border-border/50"
      >
        {indicator && (
          <div
            className="absolute top-1.5 bottom-1.5 bg-primary rounded-full transition-all duration-300 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
        )}
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`relative z-10 flex flex-col items-center gap-0 px-4 py-1.5 rounded-full transition-colors duration-200 ${
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
