import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, BookOpen, PiggyBank, Lock, Check, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useStagesWithActivities, useStartActivity, type ActivityWithProgress, type StageWithActivities } from "@/hooks/useActivities";
import type { Database } from "@/integrations/supabase/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type ActivityType = Database["public"]["Enums"]["activity_type"];
type ActivityStatus = Database["public"]["Enums"]["activity_status"];

const typeConfig: Record<ActivityType, {label: string;icon: typeof MessageCircle;}> = {
  conversation: { label: "Conversation", icon: MessageCircle },
  lesson: { label: "Lesson", icon: BookOpen },
  planning: { label: "Plan", icon: PiggyBank }
};

const statusStyles: Record<ActivityStatus, string> = {
  completed: "bg-card border-border shadow-card",
  available: "bg-card border-primary/30 shadow-soft",
  in_progress: "bg-card border-primary/20 shadow-card",
  locked: "bg-muted/50 border-border/50 opacity-60"
};

const ActivityPath = () => {
  const navigate = useNavigate();
  const { data: stages, isLoading, error } = useStagesWithActivities();
  const startActivity = useStartActivity();
  // Auto-expand the current (first incomplete unlocked) stage
  const currentStageId = stages?.find(
    (s) => s.isUnlocked && s.completedCount < s.totalCount
  )?.id || stages?.[0]?.id;

  const [openStages, setOpenStages] = useState<Set<string>>(new Set());

  const isStageOpen = (stageId: string) => {
    if (openStages.has(stageId)) return true;
    // Auto-open current stage if user hasn't manually toggled anything
    if (openStages.size === 0 && stageId === currentStageId) return true;
    return false;
  };

  const toggleStage = (stageId: string) => {
    setOpenStages((prev) => {
      const next = new Set(prev);
      // If it's auto-opened and not in the set yet, add all others' closed state
      if (next.size === 0 && stageId === currentStageId) {
        // Closing the auto-opened stage
        next.add("__toggled__");
        return next;
      }
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  const handleStartActivity = (activity: ActivityWithProgress) => {
    if (activity.userStatus === "locked") return;

    if (activity.userStatus === "available") {
      startActivity.mutate(activity.id);
    }

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
      </div>);

  }

  if (error) {
    return (
      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground px-1">
          Your Journey
        </h2>
        <p className="text-sm text-destructive px-1">Failed to load activities</p>
      </div>);

  }

  if (!stages || stages.length === 0) {
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
      </div>);

  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-foreground px-1">
        Your Journey
      </h2>
      
      <div className="space-y-3">
        {stages.map((stage, index) =>
        <StageCard
          key={stage.id}
          stage={stage}
          stageNumber={index + 1}
          isOpen={isStageOpen(stage.id)}
          onToggle={() => toggleStage(stage.id)}
          onActivityClick={handleStartActivity} />

        )}
      </div>
    </div>);

};

interface StageCardProps {
  stage: StageWithActivities;
  stageNumber: number;
  isOpen: boolean;
  onToggle: () => void;
  onActivityClick: (activity: ActivityWithProgress) => void;
}

const StageCard = ({ stage, stageNumber, isOpen, onToggle, onActivityClick }: StageCardProps) => {
  const isComplete = stage.completedCount === stage.totalCount && stage.totalCount > 0;
  const progressPercent = stage.totalCount > 0 ? stage.completedCount / stage.totalCount * 100 : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
      stage.isUnlocked ?
      "bg-card border-border shadow-card" :
      "bg-muted/30 border-border/50 opacity-70"}`
      }>
        <CollapsibleTrigger className="w-full">
          <div className="p-4 flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
            isComplete ?
            "bg-secondary text-secondary-foreground" :
            stage.isUnlocked ?
            "bg-primary/10 text-primary" :
            "bg-muted text-muted-foreground"}`
            }>
              {isComplete ? <Check className="w-6 h-6" /> : stage.isUnlocked ? stage.icon : <Lock className="w-5 h-5" />}
            </div>
            
            <div className="flex-1 text-left min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Stage {stageNumber}
              </p>
              <h3 className="font-semibold text-foreground truncate">{stage.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{stage.goal}</p>
              
              {/* Progress bar */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }} />
                  
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {stage.completedCount}/{stage.totalCount}
                </span>
              </div>
            </div>

            <div className="text-muted-foreground flex-shrink-0">
              {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {stage.activities.map((activity) =>
            <ActivityItem
              key={activity.id}
              activity={activity}
              onClick={() => onActivityClick(activity)} />

            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>);

};

interface ActivityItemProps {
  activity: ActivityWithProgress;
  onClick: () => void;
}

const ActivityItem = ({ activity, onClick }: ActivityItemProps) => {
  const config = typeConfig[activity.type];
  const Icon = activity.userStatus === "completed" ?
  Check :
  activity.userStatus === "locked" ?
  Lock :
  config.icon;

  const isClickable = activity.userStatus !== "locked";
  const showStartButton = activity.userStatus === "available" || activity.userStatus === "in_progress";

  return (
    <div
      onClick={() => isClickable && onClick()}
      className={`rounded-xl border p-3 transition-all duration-200 ${statusStyles[activity.userStatus]} ${
      isClickable ? "cursor-pointer hover:shadow-soft active:scale-[0.99]" : ""}`
      }>
      
      <div className="flex items-center gap-[14px]">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          activity.userStatus === "completed" ?
          "bg-success-light text-success" :
          activity.userStatus === "available" || activity.userStatus === "in_progress" ?
          "bg-primary text-primary-foreground" :
          "bg-muted text-muted-foreground"}`
          }>
          
          <Icon className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${
              activity.userStatus === "locked" ? "text-muted-foreground" : "text-secondary-foreground"}`
              }>
              
              {config.label}
            </span>
          </div>
          <h4 className="font-medium text-sm text-foreground line-clamp-2 text-pretty">{activity.title}</h4>
        </div>
        
        {showStartButton &&
        <button
          className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}>
          
            <ChevronRight className="w-4 h-4" />
          </button>
        }
      </div>
    </div>);

};

export default ActivityPath;