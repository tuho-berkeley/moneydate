import { MessageCircle, BookOpen, PiggyBank, Lock, Check } from "lucide-react";

type ActivityStatus = "completed" | "current" | "locked" | "in-progress";
type ActivityType = "conversation" | "lesson" | "plan";

interface Activity {
  id: string;
  title: string;
  description: string;
  type: ActivityType;
  status: ActivityStatus;
}

const activities: Activity[] = [
  {
    id: "1",
    title: "Your Money Story",
    description: "Share your earliest money memories",
    type: "conversation",
    status: "completed",
  },
  {
    id: "2",
    title: "Money Scripts 101",
    description: "Learn about the beliefs that shape your finances",
    type: "lesson",
    status: "completed",
  },
  {
    id: "3",
    title: "Money Values Talk",
    description: "Discover what money means to each of you",
    type: "conversation",
    status: "current",
  },
  {
    id: "4",
    title: "Joint Budget Basics",
    description: "Learn how couples manage money together",
    type: "lesson",
    status: "locked",
  },
  {
    id: "5",
    title: "Build Your First Budget",
    description: "Create a spending plan that works for both of you",
    type: "plan",
    status: "locked",
  },
  {
    id: "6",
    title: "Debt & Obligations",
    description: "Have an honest talk about what you each owe",
    type: "conversation",
    status: "locked",
  },
];

const typeConfig: Record<ActivityType, { label: string; icon: typeof MessageCircle }> = {
  conversation: { label: "Conversation", icon: MessageCircle },
  lesson: { label: "Lesson", icon: BookOpen },
  plan: { label: "Plan", icon: PiggyBank },
};

const statusStyles: Record<ActivityStatus, string> = {
  completed: "bg-success-light border-success/20",
  current: "bg-card border-primary/30 shadow-soft",
  "in-progress": "bg-card border-primary/20 shadow-card",
  locked: "bg-muted/50 border-border/50 opacity-60",
};

const ActivityPath = () => {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-foreground px-1">
        Your Journey
      </h2>
      <div className="space-y-3">
        {activities.map((activity) => {
          const config = typeConfig[activity.type];
          const Icon = activity.status === "completed" ? Check : activity.status === "locked" ? Lock : config.icon;

          return (
            <div
              key={activity.id}
              className={`rounded-2xl border p-4 transition-all duration-200 ${statusStyles[activity.status]} ${
                activity.status === "current" ? "" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    activity.status === "completed"
                      ? "bg-success text-primary-foreground"
                      : activity.status === "current"
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
                        activity.status === "locked" ? "text-muted-foreground" : "text-secondary-foreground"
                      }`}
                    >
                      {config.label}
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">{activity.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                </div>
                {activity.status === "current" && (
                  <button className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl flex-shrink-0">
                    Start
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
