import { useNavigate } from "react-router-dom";
import { MessageCircle, BookOpen, PiggyBank, ArrowRight, Loader2 } from "lucide-react";
import { useActivityStats, useStartActivity } from "@/hooks/useActivities";
import type { Database } from "@/integrations/supabase/types";

type ActivityType = Database["public"]["Enums"]["activity_type"];

const typeIcons: Record<ActivityType, typeof MessageCircle> = {
  conversation: MessageCircle,
  lesson: BookOpen,
  planning: PiggyBank
};

const typeLabels: Record<ActivityType, string> = {
  conversation: "Conversation",
  lesson: "Lesson",
  planning: "Planning"
};

const UpNextCard = () => {
  const navigate = useNavigate();
  const { current, completed, total } = useActivityStats();
  const startActivity = useStartActivity();

  const handleStart = () => {
    if (!current) return;

    if (current.userStatus === "available") {
      startActivity.mutate(current.id);
    }

    navigate(`/activity/${current.id}`);
  };

  // All activities completed
  if (!current && completed === total && total > 0) {
    return (
      <div className="bg-card rounded-3xl p-6 shadow-soft">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary-foreground bg-secondary px-3 py-1 rounded-full">
            🎉 Complete
          </span>
        </div>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🏆</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">
              Journey Complete!
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You've completed all available activities. Check back soon for new content!
            </p>
          </div>
        </div>
      </div>);

  }

  // No activities available
  if (!current) {
    return (
      <div className="bg-card rounded-3xl p-6 shadow-soft">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>);

  }

  const Icon = typeIcons[current.type];

  return (
    <div className="bg-card rounded-xl p-5 shadow-soft">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary-foreground bg-secondary px-3 py-1 rounded-full">
          {typeLabels[current.type]}
        </span>
      </div>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-foreground mb-0.5 text-pretty py-[6px] text-2xl">
            {current.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-snug text-pretty">
            {current.description}
          </p>
        </div>
      </div>
      <button
        onClick={handleStart}
        className="mt-3.5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3 font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]">
        
        {current.userStatus === "in_progress" ? "Continue" : "Start"}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>);

};

export default UpNextCard;