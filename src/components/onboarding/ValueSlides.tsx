import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Target, Shield } from "lucide-react";

const slides = [
  {
    icon: MessageCircle,
    title: "Talk about money without awkwardness",
    description: "Thoughtful questions to guide honest, meaningful conversations together.",
    color: "bg-secondary",
  },
  {
    icon: Target,
    title: "Turn conversations into real plans",
    description: "Build shared goals, budgets, and financial plans for your future.",
    color: "bg-secondary",
  },
  {
    icon: Shield,
    title: "No more financial surprises",
    description: "Understand each other's habits and expectations early.",
    color: "bg-secondary",
  },
];

const AUTO_SCROLL_INTERVAL = 3500;

interface Props {
  onGoogleAuth: () => void;
  authLoading?: boolean;
}

const ValueSlides = ({ onGoogleAuth, authLoading }: Props) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, AUTO_SCROLL_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  const slide = slides[current];
  const Icon = slide.icon;

  return (
    <div className="w-full max-w-sm text-center space-y-8">
      <div key={current} className="space-y-6 animate-fade-in">
        <div className={`w-24 h-24 rounded-2xl ${slide.color} flex items-center justify-center mx-auto`}>
          <Icon className={`w-12 h-12 ${slide.iconColor}`} />
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-2xl font-bold text-foreground leading-tight text-pretty">{slide.title}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">{slide.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? "w-6 bg-primary" : "w-2 bg-border"
            }`}
          />
        ))}
      </div>

      <Button variant="outline" className="w-full rounded-full" size="lg" disabled={authLoading} onClick={onGoogleAuth}>
        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {authLoading ? "Please wait..." : "Continue with Google"}
      </Button>
    </div>
  );
};

export default ValueSlides;
