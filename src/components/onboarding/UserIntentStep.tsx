import { Button } from "@/components/ui/button";
import { User, Heart, Gem } from "lucide-react";

const options = [
  { value: "exploring_alone", label: "Exploring on my own", icon: User },
  { value: "in_relationship", label: "In a relationship", icon: Heart },
  { value: "engaged", label: "Engaged or planning marriage", icon: Gem },
  { value: "newly_married", label: "Newly married", icon: Heart },
  { value: "married_long", label: "Married for a while", icon: Heart },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

const UserIntentStep = ({ value, onChange, onNext }: Props) => (
  <div className="w-full max-w-sm space-y-8 animate-fade-in">
    <div className="text-center space-y-3">
      <h2 className="font-display text-2xl font-bold text-foreground">
        How will you use MoneyDate?
      </h2>
      <p className="text-muted-foreground text-sm">This helps us personalize your experience</p>
    </div>

    <div className="space-y-3">
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
              selected
                ? "border-primary bg-secondary"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className={`text-sm font-medium ${selected ? "text-foreground" : "text-muted-foreground"}`}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>

    <Button onClick={onNext} className="w-full rounded-full" size="lg" disabled={!value}>
      Continue
    </Button>
  </div>
);

export default UserIntentStep;
