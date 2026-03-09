import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MessageCircle, BookOpen, PiggyBank, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type ActivityType = Database["public"]["Enums"]["activity_type"];

const typeConfig: Record<ActivityType, { label: string; icon: typeof MessageCircle; color: string }> = {
  conversation: { label: "Conversation", icon: MessageCircle, color: "bg-primary" },
  lesson: { label: "Lesson", icon: BookOpen, color: "bg-secondary" },
  planning: { label: "Plan", icon: PiggyBank, color: "bg-accent" },
};

const Activity = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: activity, isLoading } = useQuery({
    queryKey: ["activity", id],
    queryFn: async () => {
      if (!id) throw new Error("No activity ID");
      const { data, error } = await supabase.from("activities").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Check which conversation types have been completed for this activity
  const { data: completedTypes } = useQuery({
    queryKey: ["completed-conversation-types", id, user?.id],
    queryFn: async () => {
      if (!id || !user) return new Set<string>();
      
      // Get conversations for this activity by this user
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("id, type")
        .eq("activity_id", id)
        .eq("user_id", user.id);
      
      if (error || !conversations) return new Set<string>();
      
      const completed = new Set<string>();
      
      for (const conv of conversations) {
        if (conv.type === "solo") {
          // Solo: completed when user answered at least 3 questions
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .eq("role", "user");
          if ((count || 0) >= 3) completed.add("solo");
        } else if (conv.type === "together") {
          // Together: completed when each partner answered at least 1
          const { data: msgs } = await supabase
            .from("messages")
            .select("sender_id")
            .eq("conversation_id", conv.id)
            .in("role", ["user", "partner"]);
          const senders = new Set(msgs?.map(m => m.sender_id).filter(Boolean));
          if (senders.size >= 2) completed.add("together");
        } else if (conv.type === "face_to_face") {
          // Face-to-face: completed when each partner recorded at least 1
          const { data: msgs } = await supabase
            .from("messages")
            .select("sender_id")
            .eq("conversation_id", conv.id)
            .in("role", ["user", "partner"]);
          const senders = new Set(msgs?.map(m => m.sender_id).filter(Boolean));
          if (senders.size >= 2) completed.add("face_to_face");
        }
      }
      
      return completed;
    },
    enabled: !!id && !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-background p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <p className="text-center text-muted-foreground">Activity not found</p>
      </div>
    );
  }

  const config = typeConfig[activity.type];
  const Icon = config.icon;

  const handleStartConversation = (mode: "solo" | "together" | "face_to_face") => {
    navigate(`/conversation/${activity.id}?mode=${mode}`);
  };

  return (
    <div className="min-h-screen bg-background pb-28">
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

        <h1 className="font-display text-2xl font-bold text-foreground">{activity.title}</h1>
        {activity.description && <p className="text-muted-foreground mt-2">{activity.description}</p>}
      </div>

      {/* Content based on activity type */}
      <div className="px-6 space-y-4">
        {activity.type === "conversation" && (
          <>
            <div className="bg-card rounded-2xl p-5 border border-border">
              <h3 className="font-semibold text-foreground mb-2">Choose how to start</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You can have this conversation on your own, with your partner, or face-to-face.
              </p>

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto p-4 rounded-xl"
                  onClick={() => handleStartConversation("solo")}
                >
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mr-3">
                    {completedTypes?.has("solo") ? <Check className="w-5 h-5 text-primary" /> : <MessageCircle className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">Solo Chat</p>
                      {completedTypes?.has("solo") && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground bg-secondary px-2 py-0.5 rounded-full">Done</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Reflect on your own first</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto p-4 rounded-xl"
                  onClick={() => handleStartConversation("together")}
                >
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mr-3">
                    {completedTypes?.has("together") ? <Check className="w-5 h-5 text-primary" /> : <span className="text-lg">👥</span>}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">Together Chat</p>
                      {completedTypes?.has("together") && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground bg-secondary px-2 py-0.5 rounded-full">Done</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Chat with your partner & guided by AI</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto p-4 rounded-xl"
                  onClick={() => handleStartConversation("face_to_face")}
                >
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mr-3">
                    {completedTypes?.has("face_to_face") ? <Check className="w-5 h-5 text-primary" /> : <span className="text-lg">💬</span>}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="font-semibold text-foreground">Face-to-Face</p>
                    <p className="text-xs text-muted-foreground">In-person with voice recording</p>
                  </div>
                  {completedTypes?.has("face_to_face") && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground bg-secondary px-2 py-1 rounded-full flex-shrink-0">Completed</span>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {activity.type === "lesson" && (
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-secondary-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Lesson Content</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This lesson will teach you important concepts about managing finances as a couple.
            </p>
            <Button className="w-full rounded-xl">Start Lesson</Button>
          </div>
        )}

        {activity.type === "planning" && (
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
        )}
      </div>
    </div>
  );
};

export default Activity;
