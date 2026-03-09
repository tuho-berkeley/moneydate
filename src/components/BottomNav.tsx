import { Home, BarChart3, Target, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";

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
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  const updateIndicator = () => {
    if (!navRef.current) return;
    const activeIndex = tabs.findIndex((t) => t.path === location.pathname);
    if (activeIndex === -1) {
      setIndicator(null);
      return;
    }

    const buttons = navRef.current.querySelectorAll<HTMLButtonElement>("button");
    const btn = buttons[activeIndex];

    if (!btn) {
      setIndicator(null);
      return;
    }

    const width = btn.offsetWidth;
    if (width <= 0) {
      setIndicator(null);
      return;
    }

    setIndicator({ left: btn.offsetLeft, width });
  };

  useLayoutEffect(() => {
    updateIndicator();
  }, [location.pathname]);

  useEffect(() => {
    const raf = requestAnimationFrame(updateIndicator);
    window.addEventListener("resize", updateIndicator);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > 80 && currentY > lastScrollY.current) {
        setHidden(true);
      } else if (currentY < lastScrollY.current) {
        setHidden(false);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!session) return null;
  if (location.pathname === "/onboarding") return null;
  if (location.pathname.startsWith("/activity/") || location.pathname.startsWith("/conversation/") || location.pathname.startsWith("/lesson/")) return null;

  const hasValidIndicator = Boolean(indicator && indicator.width > 0);

  return (
    <div className={`fixed bottom-2 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-6 transition-transform ${hidden ? "duration-[600ms] ease-in translate-y-[calc(100%+1rem)]" : "duration-300 ease-out"}`}>
      {/* Fade overlay behind navbar */}
      <div className="absolute -inset-x-4 -top-16 -bottom-2 bg-gradient-to-t from-background via-background/60 to-transparent rounded-b-3xl pointer-events-none" />
      <nav
        ref={navRef}
        className="relative flex items-center gap-1.5 bg-card/90 backdrop-blur-xl rounded-full px-3 py-2 shadow-soft border border-border/50"
      >
        {hasValidIndicator && indicator && (
          <div
            className="absolute top-2 bottom-2 bg-primary rounded-full transition-all duration-300 ease-out"
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
              className={`relative z-10 flex flex-col items-center gap-0.5 px-5 py-2 rounded-full transition-colors duration-200 ${
                isActive
                  ? hasValidIndicator
                    ? "text-primary-foreground"
                    : "text-foreground bg-primary/15"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
