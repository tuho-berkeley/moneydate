import { Flame, MessageCircle } from "lucide-react";
import { useActivityStats } from "@/hooks/useActivities";

const ProgressCards = () => {
  const { completed, total } = useActivityStats();

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center mb-3">
          <Flame className="w-5 h-5 text-primary" />
        </div>
        <p className="text-2xl font-bold text-foreground">1</p>
        <p className="text-xs text-muted-foreground mt-0.5">Day Streak</p>
      </div>
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="w-9 h-9 rounded-xl bg-success-light flex items-center justify-center mb-3">
          <MessageCircle className="w-5 h-5 text-success" />
        </div>
        <p className="text-2xl font-bold text-foreground">{completed}/{total}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Topics Complete</p>
      </div>
    </div>
  );
};

export default ProgressCards;
