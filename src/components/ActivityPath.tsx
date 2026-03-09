import { useNavigate } from "react-router-dom";
import { MessageCircle, BookOpen, PiggyBank, Lock, Check, Loader2 } from "lucide-react";
import { useActivities, useStartActivity, type ActivityWithProgress } from "@/hooks/useActivities";
import type { Database } from "@/integrations/supabase/types";

type ActivityType = Database["public"]["Enums"]["activity_type"];
type ActivityStatus = Database["public"]["Enums"]["activity_status"];

const typeConfig: Record<ActivityType, { label: string; icon: typeof MessageCircle }> = {
  conversation: { label: "Conversation", icon: MessageCircle },
  lesson: { label: "Lesson", icon: BookOpen },
  planning: { label: "Plan", icon: PiggyBank },
};

const statusStyles: Record<ActivityStatus, string> = {
  completed: "bg-card border-border shadow-card",
  available: "bg-card border-primary/30 shadow-soft",
  in_progress: "bg-card border-primary/20 shadow-card",
  locked: "bg-muted/50 border-border/50 opacity-60",
};

const ActivityPath = () => {
  const navigate = useNavigate();
  const { data: activities, isLoading, error } = useActivities();
  const startActivity = useStartActivity();

  const handleStartActivity = (activity: ActivityWithProgress) => {
    if (activity.userStatus === "locked") return;

    // Start the activity if not already started
    if (activity.userStatus === "available") {
      startActivity.mutate(activity.id);
    }

    // Navigate to activity based on type
    navigate(`/activity/${activity.id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground px-1">
          Your Journey
        </h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground px-1">
          Your Journey
        </h2>
        <p className="text-sm text-destructive px-1">Failed to load activities</p>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground px-1">
          Your Journey
        </h2>
        <div className="bg-card rounded-2xl border border-border p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No activities available yet. Check back soon!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-foreground px-1">
        Your Journey
      </h2>
      <div className="space-y-3">
        {activities.map((activity) => {
          const config = typeConfig[activity.type];
          const Icon = activity.userStatus === "completed" 
            ? Check 
            : activity.userStatus === "locked" 
              ? Lock 
              : config.icon;

          const isClickable = activity.userStatus !== "locked";
          const showStartButton = activity.userStatus === "available" || activity.userStatus === "in_progress";

          return (
            <div
              key={activity.id}
              onClick={() => isClickable && handleStartActivity(activity)}
              className={`rounded-2xl border p-4 transition-all duration-200 ${statusStyles[activity.userStatus]} ${
                isClickable ? "cursor-pointer hover:shadow-soft active:scale-[0.99]" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    activity.userStatus === "completed"
                      ? "bg-secondary text-secondary-foreground"
                      : activity.userStatus === "available" || activity.userStatus === "in_progress"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        activity.userStatus === "locked" ? "text-muted-foreground" : "text-secondary-foreground"
                      }`}
                    >
                      {config.label}
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">{activity.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                </div>
                {showStartButton && (
                  <button 
                    className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartActivity(activity);
                    }}
                  >
                    {activity.userStatus === "in_progress" ? "Continue" : "Start"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityPath;
