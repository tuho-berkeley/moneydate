import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const WelcomeStep = ({ onNext }: { onNext: () => void }) => (
  <div className="w-full max-w-sm text-center space-y-8 animate-fade-in">
    <div className="space-y-4">
      <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto">
        <Heart className="w-10 h-10 text-primary fill-primary" />
      </div>
      <h1 className="font-display text-3xl font-bold text-foreground leading-tight text-pretty">
        Before forever,<br />talk about money.
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        Money conversations don't have to feel awkward. Start exploring your shared values and plan the future together.
      </p>
    </div>
    <Button onClick={onNext} className="w-full rounded-full" size="lg">
      Get Started
    </Button>
  </div>
);

export default WelcomeStep;
