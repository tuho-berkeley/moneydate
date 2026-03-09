import UpNextCard from "@/components/UpNextCard";
import ProgressCards from "@/components/ProgressCards";
import ActivityPath from "@/components/ActivityPath";

const Index = () => {
  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="px-6 pt-14 pb-6">
        <p className="text-sm text-muted-foreground font-medium">Good evening ✨</p>
        <h1 className="font-display text-2xl font-bold text-foreground mt-1">
          Sarah & James
        </h1>
      </div>

      {/* Content */}
      <div className="px-6 space-y-5">
        <UpNextCard />
        <ProgressCards />
        <ActivityPath />
      </div>
    </div>
  );
};

export default Index;
