import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UpNextCard from "@/components/UpNextCard";
import ProgressCards from "@/components/ProgressCards";
import ActivityPath from "@/components/ActivityPath";

const SCROLL_KEY = "homepage_scrollY";

const Index = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    supabase.
    from("profiles").
    select("display_name").
    eq("id", user.id).
    single().
    then(({ data }) => {
      const name = data?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      "";
      setDisplayName(name);
    });
  }, [user]);

  // Save scroll position on scroll (debounced)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
      }, 100);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Restore scroll position after content renders
  useEffect(() => {
    if (restoredRef.current) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (!saved || saved === "0") return;
    const y = parseInt(saved, 10);
    if (isNaN(y)) return;
    // Wait for DOM to settle
    const raf = requestAnimationFrame(() => {
      window.scrollTo(0, y);
      restoredRef.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [displayName]); // trigger after profile loads

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning ☀️";
    if (hour < 18) return "Good afternoon 🌤️";
    return "Good evening ✨";
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="max-w-lg mx-auto">
        <div className="px-6 pt-8 pb-6">
          <p className="text-sm text-muted-foreground font-medium">{greeting()}</p>
          <h1 className="font-display font-bold text-foreground mt-1 text-base">
            {displayName || "Welcome"}
          </h1>
        </div>
        <div className="px-6 space-y-5">
          <UpNextCard />
          <ProgressCards />
          <ActivityPath />
        </div>
      </div>
    </div>);

};

export default Index;