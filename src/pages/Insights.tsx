import { Heart, TrendingUp, AlertCircle, Sparkles } from "lucide-react";

const insights = [
  {
    icon: Heart,
    title: "Strong Alignment",
    description: "You both value security and long-term planning. This is a great foundation!",
    color: "bg-success-light text-success",
  },
  {
    icon: TrendingUp,
    title: "Spending Styles",
    description: "Sarah tends toward saving while James is more spontaneous. This is normal and manageable.",
    color: "bg-accent text-primary",
  },
  {
    icon: AlertCircle,
    title: "Topic to Explore",
    description: "You haven't discussed debt openly yet. Consider making this your next conversation.",
    color: "bg-secondary text-secondary-foreground",
  },
  {
    icon: Sparkles,
    title: "Communication Win",
    description: "Your recent money values conversation showed excellent active listening from both sides.",
    color: "bg-success-light text-success",
  },
];

const Insights = () => {
  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-6 pt-14 pb-6">
        <p className="text-sm text-muted-foreground font-medium">Your patterns</p>
        <h1 className="font-display text-2xl font-bold text-foreground mt-1">Insights</h1>
      </div>

      <div className="px-6 space-y-3">
        {/* Summary Card */}
        <div className="bg-card rounded-3xl p-6 shadow-soft">
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">Money Compatibility</h3>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-primary">78%</span>
            <span className="text-sm text-muted-foreground pb-1">alignment score</span>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: "78%" }} />
          </div>
        </div>

        {/* Insight Cards */}
        {insights.map((insight, i) => {
          const Icon = insight.icon;
          return (
            <div
              key={i}
              className="bg-card rounded-2xl p-4 shadow-card"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${insight.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">{insight.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Insights;
