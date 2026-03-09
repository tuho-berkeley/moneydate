import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Target, Shield } from "lucide-react";

const slides = [
  {
    icon: MessageCircle,
    title: "Talk about money without awkwardness",
    description: "AI helps guide meaningful financial conversations between partners.",
    color: "bg-secondary",
    iconColor: "text-primary",
  },
  {
    icon: Target,
    title: "Turn conversations into real plans",
    description: "Build budgets, savings goals, and financial plans as a couple.",
    color: "bg-accent",
    iconColor: "text-accent-foreground",
  },
  {
    icon: Shield,
    title: "Understand each other's money habits early",
    description: "Discover financial expectations before marriage.",
    color: "bg-muted",
    iconColor: "text-foreground",
  },
];

const ValueSlides = ({ onNext }: { onNext: () => void }) => {
  const [current, setCurrent] = useState(0);
  const isLast = current === slides.length - 1;
  const slide = slides[current];
  const Icon = slide.icon;

  return (
    <div className="w-full max-w-sm text-center space-y-8">
      <div
        key={current}
        className="space-y-6 animate-fade-in"
      >
        <div className={`w-24 h-24 rounded-2xl ${slide.color} flex items-center justify-center mx-auto`}>
          <Icon className={`w-12 h-12 ${slide.iconColor}`} />
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-2xl font-bold text-foreground leading-tight">
            {slide.title}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {slide.description}
          </p>
        </div>
      </div>

      {/* Slide indicators */}
      <div className="flex items-center justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? "w-6 bg-primary" : "w-2 bg-border"
            }`}
          />
        ))}
      </div>

      <Button
        onClick={isLast ? onNext : () => setCurrent(current + 1)}
        className="w-full rounded-full"
        size="lg"
      >
        {isLast ? "Continue" : "Next"}
      </Button>
    </div>
  );
};

export default ValueSlides;
