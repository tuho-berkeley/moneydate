import { Flame, MessageCircle, Heart } from "lucide-react";
import { useActivityStats } from "@/hooks/useActivities";

const ProgressCards = () => {
  const { completed, total } = useActivityStats();

  return (
    <div className="grid grid-cols-3 gap-2.5">
      <div className="bg-card rounded-2xl px-3 py-3.5 shadow-card flex flex-col items-start">
        <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center mb-2.5">
          <Flame className="w-4 h-4 text-secondary-foreground" />
        </div>
        <p className="text-2xl font-bold text-foreground leading-none">1</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Week Streak</p>
      </div>
      <div className="bg-card rounded-2xl px-3 py-3.5 shadow-card flex flex-col items-start">
        <div className="w-8 h-8 rounded-xl bg-success-light flex items-center justify-center mb-2.5">
          <MessageCircle className="w-4 h-4 text-success" />
        </div>
        <p className="text-2xl font-bold text-foreground leading-none">{completed}<span className="text-sm font-medium text-muted-foreground">/{total}</span></p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Activities</p>
      </div>
      <div className="bg-card rounded-2xl px-3 py-3.5 shadow-card flex flex-col items-start">
        <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center mb-2.5">
          <Heart className="w-4 h-4 text-secondary-foreground" />
        </div>
        <p className="text-2xl font-bold text-foreground leading-none">78%</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Compatibility</p>
      </div>
    </div>);

};

export default ProgressCards;