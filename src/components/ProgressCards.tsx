import { Flame, MessageCircle, Heart } from "lucide-react";
import { useActivityStats } from "@/hooks/useActivities";

const ProgressCards = () => {
  const { completed, total } = useActivityStats();

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="bg-card rounded-2xl p-3 shadow-card">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center mb-2">
          <Flame className="w-4 h-4 text-primary" />
        </div>
        <p className="text-xl font-bold text-foreground">1</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Weekly Streak</p>
      </div>
      <div className="bg-card rounded-2xl p-3 shadow-card">
        <div className="w-8 h-8 rounded-lg bg-success-light flex items-center justify-center mb-2">
          <MessageCircle className="w-4 h-4 text-success" />
        </div>
        <p className="text-xl font-bold text-foreground">{completed}/{total}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Topics Complete</p>
      </div>
      <div className="bg-card rounded-2xl p-3 shadow-card">
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center mb-2">
          <Heart className="w-4 h-4 text-secondary-foreground" />
        </div>
        <p className="text-xl font-bold text-foreground">78%</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Alignment</p>
      </div>
    </div>
  );
};

export default ProgressCards;
