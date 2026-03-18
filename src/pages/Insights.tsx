import { BarChart3 } from "lucide-react";

const Insights = () => {
  return (
    <div className="min-h-screen bg-background pb-28 flex items-center justify-center">
      <div className="text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Coming Soon</h1>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
          We're working on personalized insights about your money conversations. Stay tuned!
        </p>
      </div>
    </div>
  );
};

export default Insights;