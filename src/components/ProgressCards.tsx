import { Flame, MessageCircle, Heart } from "lucide-react";
import { useActivityStats } from "@/hooks/useActivities";

const ProgressCards = () => {
  const { completed, total } = useActivityStats();

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="bg-card rounded-lg p-3 shadow-card flex flex-col items-center">
        <p className="text-[10px] text-muted-foreground mb-1">Streak</p>
        <div className="flex items-center gap-[8px]">
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center">
            <Flame className="w-3 h-3 text-secondary-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">1</p>
        </div>
      </div>
      <div className="bg-card rounded-lg p-3 shadow-card flex flex-col items-center">
        <p className="text-[10px] text-muted-foreground mb-1">Activities</p>
        <div className="flex items-center gap-[8px]">
          <div className="w-6 h-6 rounded-md bg-success-light flex items-center justify-center">
            <MessageCircle className="w-3 h-3 text-success" />
          </div>
          <p className="text-xl font-bold text-foreground">{completed}<span className="text-xs font-medium text-muted-foreground"> / {total}</span></p>
        </div>
      </div>
      <div className="bg-card rounded-lg p-3 shadow-card flex flex-col items-center">
        <p className="text-[10px] text-muted-foreground mb-1">Compatibility</p>
        <div className="flex items-center gap-[8px]">
          <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center">
            <Heart className="w-3 h-3 text-secondary-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">78%</p>
        </div>
      </div>
    </div>);

};

export default ProgressCards;