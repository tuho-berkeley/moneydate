import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MessageCircle, BookOpen, PiggyBank, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type ActivityType = Database["public"]["Enums"]["activity_type"];

const typeConfig: Record<ActivityType, {label: string;icon: typeof MessageCircle;color: string;}> = {
  conversation: { label: "Conversation", icon: MessageCircle, color: "bg-primary" },
  lesson: { label: "Lesson", icon: BookOpen, color: "bg-secondary" },
  planning: { label: "Plan", icon: PiggyBank, color: "bg-accent" }
};

const Activity = () => {
  const { slug } = useParams<{slug: string;}>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: activity, isLoading } = useQuery({
    queryKey: ["activity", slug],
    queryFn: async () => {
      if (!slug) throw new Error("No activity slug");
      const { data, error } = await supabase.from("activities").select("*").eq("slug", slug as any).single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug
  });

  const id = activity?.id;

  // Check if activity is completed/insights_generated via user_activities
  const { data: activityStatus } = useQuery({
    queryKey: ["activity-status", id, user?.id],
    queryFn: async () => {
      if (!id || !user) return null;
      const { data } = await supabase
        .from("user_activities")
        .select("status")
        .eq("activity_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!id && !!user
  });

  const isActivityCompleted = activityStatus?.status === "completed" || activityStatus?.status === "insights_generated";

  // Per-mode completion badges — uses conversations.completed flag
  const { data: completedTypes } = useQuery({
    queryKey: ["completed-conversation-types", id, user?.id],
    queryFn: async () => {
      if (!id || !user) return new Set<string>();
      const { data } = await supabase
        .from("conversations")
        .select("type, completed")
        .eq("activity_id", id)
        .eq("completed", true);
      return new Set((data || []).map(c => c.type));
    },
    enabled: !!id && !!user
  });

  const lessonCompleted = isActivityCompleted;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>);

  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-background p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <p className="text-center text-muted-foreground">Activity not found</p>
      </div>);

  }

  const config = typeConfig[activity.type];
  const Icon = config.icon;

  const handleStartConversation = (mode: "solo" | "together" | "face_to_face") => {
    navigate(`/conversation/${(activity as any).slug}?mode=${mode}`);
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="px-6 pt-14 pb-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary-foreground bg-secondary px-3 py-1 rounded-full">
              {config.label}
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold text-foreground text-pretty">{activity.title}</h1>
          {(activity.type === "conversation" || activity.type === "planning") && activity.description && (
            <p className="text-sm text-muted-foreground mt-2 text-pretty">{activity.description}</p>
          )}
          
        </div>

        {/* Content based on activity type */}
        <div className="px-6 space-y-4">
          {activity.type === "conversation" &&
          <>
              <div className="bg-card rounded-2xl p-5 border border-border">
                <h3 className="font-semibold text-foreground mb-2">Choose how to start</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You can have this conversation on your own, with your partner via chat, or face-to-face.
                </p>

                <div className="space-y-3">
                  <Button
                  variant="outline"
                  className="w-full justify-start h-auto p-4 rounded-xl"
                  onClick={() => handleStartConversation("solo")}>
                  
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mr-3">
                      <MessageCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      {completedTypes?.has("solo") &&
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-success"><span className="w-2 h-2 rounded-full bg-success inline-block" />Completed</span>
                    }
                      <p className="font-semibold text-foreground">Self Discovery</p>
                      <p className="text-xs text-muted-foreground text-pretty">Reflect on your own first</p>
                    </div>
                  </Button>

                  <Button
                  variant="outline"
                  className="w-full justify-start h-auto p-4 rounded-xl"
                  onClick={() => handleStartConversation("together")}>
                  
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mr-3">
                      <span className="text-lg">👥</span>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      {completedTypes?.has("together") &&
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-success"><span className="w-2 h-2 rounded-full bg-success inline-block" />Completed</span>
                    }
                      <p className="font-semibold text-foreground">Chat Together</p>
                      <p className="text-xs text-muted-foreground text-pretty">Have a guided conversation together</p>
                    </div>
                  </Button>

                  <Button variant="outline"
                className="w-full justify-start h-auto p-4 rounded-xl"
                onClick={() => handleStartConversation("face_to_face")}>
                  
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mr-3">
                      <span className="text-lg">💬</span>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      {completedTypes?.has("face_to_face") &&
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-success"><span className="w-2 h-2 rounded-full bg-success inline-block" />Completed</span>
                    }
                      <p className="font-semibold text-foreground">Face-to-Face</p>
                      <p className="text-xs text-muted-foreground text-pretty">In-person with voice recording</p>
                    </div>
                  </Button>
                </div>
              </div>
            </>
          }

          {activity.type === "lesson" &&
          <div className="bg-card rounded-2xl p-5 border border-border text-center">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4 mx-auto">
                <BookOpen className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Lesson Content</h3>
              <p className="text-sm text-muted-foreground mb-4 text-pretty">
                {activity.description || "This lesson will teach you important concepts about managing finances as a couple."}
              </p>
              <Button className="w-full rounded-xl" onClick={() => navigate(`/lesson/${slug}`)}>
                {lessonCompleted ? "Review Lesson" : "Start Lesson"}
              </Button>
            </div>
          }

          {activity.type === "planning" &&
          <div className="bg-card rounded-2xl p-5 border border-border">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <PiggyBank className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Financial Planning</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Work together with AI to create a concrete financial plan based on your conversations.
              </p>
              <Button className="w-full rounded-xl">Start Planning</Button>
            </div>
          }
        </div>
      </div>
    </div>);

};

export default Activity;