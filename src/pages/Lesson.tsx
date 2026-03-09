import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, BookOpen, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConversationCompletion } from "@/hooks/useConversationCompletion";

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    let videoId: string | null = null;
    if (parsed.hostname.includes("youtube.com")) {
      videoId = parsed.searchParams.get("v");
    } else if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.slice(1);
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

const Lesson = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { markCompleted } = useConversationCompletion(id || "");

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

  // Check completion status
  const { data: isCompleted } = useQuery({
    queryKey: ["lesson-completed", id, user?.id],
    queryFn: async () => {
      if (!id || !user) return false;
      const { data } = await supabase
        .from("user_activities")
        .select("status")
        .eq("activity_id", id)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .maybeSingle();
      return !!data;
    },
    enabled: !!id && !!user,
  });

  if (isLoading || !activity) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const embedUrl = activity.video_url ? getYouTubeEmbedUrl(activity.video_url) : null;

  const handleComplete = () => {
    markCompleted();
    navigate(-1);
  };

  return (
    <div className="h-[100dvh] bg-background">
      <div className="max-w-lg mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            className="text-muted-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground text-sm truncate">{activity.title}</h1>
            <p className="text-xs text-muted-foreground">Lesson</p>
          </div>
          {isCompleted && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              Completed
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-6 space-y-6">
          {/* Video */}
          {embedUrl ? (
            <div className="rounded-2xl overflow-hidden border border-border shadow-soft">
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={embedUrl}
                  title={activity.title}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-secondary/50 border border-border p-8 flex flex-col items-center gap-3 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No video available for this lesson.</p>
            </div>
          )}

          {/* Description */}
          {activity.description && (
            <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
              <h2 className="font-semibold text-foreground">About this lesson</h2>
              <p className="text-sm text-muted-foreground text-pretty leading-relaxed">
                {activity.description}
              </p>
            </div>
          )}
        </div>

        {/* Bottom action */}
        <div className="sticky bottom-0 px-4 pb-6 pt-3 bg-background">
          {isCompleted ? (
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            >
              Back to Activity
            </Button>
          ) : (
            <Button className="w-full rounded-xl" onClick={handleComplete}>
              Mark as Complete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Lesson;
