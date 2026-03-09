import { Flame, MessageCircle, Heart } from "lucide-react";
import { useActivityStats } from "@/hooks/useActivities";

const ProgressCards = () => {
  const { completed, total } = useActivityStats();

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="bg-card rounded-xl p-3 shadow-card flex flex-col items-center">
        <p className="text-[10px] text-muted-foreground mb-1">Week Streak</p>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-secondary-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">1</p>
        </div>
      </div>
      <div className="bg-card rounded-xl p-3 shadow-card flex flex-col items-center">
        <p className="text-[10px] text-muted-foreground mb-1">Activities</p>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-success-light flex items-center justify-center">
            <MessageCircle className="w-3.5 h-3.5 text-success" />
          </div>
          <p className="text-xl font-bold text-foreground">{completed}<span className="text-xs font-medium text-muted-foreground"> / {total}</span></p>
        </div>
      </div>
      <div className="bg-card rounded-xl p-3 shadow-card flex flex-col items-start">
        <p className="text-[10px] text-muted-foreground mb-1">Compatibility</p>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
            <Heart className="w-3.5 h-3.5 text-secondary-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">78%</p>
        </div>
      </div>
    </div>
  );
};

export default ProgressCards;
