import { Target } from "lucide-react";

const Plan = () => {
  return (
    <div className="min-h-screen bg-background pb-28 flex items-center justify-center">
      <div className="text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Target className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Coming Soon</h1>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
          Joint financial plans and goal tracking are on the way. Stay tuned!
        </p>
      </div>
    </div>
  );
};

export default Plan;