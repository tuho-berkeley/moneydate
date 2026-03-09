import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UpNextCard from "@/components/UpNextCard";
import ProgressCards from "@/components/ProgressCards";
import ActivityPath from "@/components/ActivityPath";

const Index = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        const name = data?.display_name
          || user.user_metadata?.full_name
          || user.user_metadata?.name
          || "";
        setDisplayName(name);
      });
  }, [user]);

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
          <h1 className="font-display text-2xl font-bold text-foreground mt-1">
            {displayName || "Welcome"}
          </h1>
        </div>
        <div className="px-6 space-y-5">
          <UpNextCard />
          <ProgressCards />
          <ActivityPath />
        </div>
      </div>
    </div>
  );
};

export default Index;
