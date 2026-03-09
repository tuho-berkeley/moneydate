import { useState } from "react";
import { Button } from "@/components/ui/button";
import { User, Heart, Gem } from "lucide-react";
import type { OnboardingData } from "@/pages/Onboarding";

const intentOptions = [
  { value: "exploring_alone", label: "Exploring on my own", icon: User },
  { value: "in_relationship", label: "In a relationship", icon: Heart },
  { value: "engaged", label: "Engaged or planning marriage", icon: Gem },
  { value: "newly_married", label: "Newly married", icon: Heart },
  { value: "married_long", label: "Married for a while", icon: Heart },
];

const durationOptions = [
  { value: "less_1", label: "Less than 1 year" },
  { value: "1_3", label: "1–3 years" },
  { value: "3_5", label: "3–5 years" },
  { value: "5_plus", label: "5+ years" },
];

const talkOptions = [
  { value: "not_really", label: "Not really" },
  { value: "a_little", label: "A little" },
  { value: "yes_often", label: "Yes, often" },
];

const helpOptions = [
  "Talking about money more comfortably",
  "Understanding each other's money mindset",
  "Aligning our financial goals",
  "Planning our life together",
  "Avoiding money conflicts later",
];

interface Props {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
}

const PersonalizationStep = ({ data, onChange, onNext }: Props) => {
  const [subStep, setSubStep] = useState(0);

  const renderQuestion = () => {
    if (subStep === 0) {
      return (
        <div className="space-y-6 animate-fade-in" key="q0">
          <div className="text-center space-y-3">
            <h2 className="font-display text-2xl font-bold text-foreground text-pretty">How will you use MoneyDate?</h2>
            <p className="text-muted-foreground text-sm text-pretty">This helps us personalize your experience</p>
          </div>
          <div className="space-y-3">
            {intentOptions.map((opt) => {
              const Icon = opt.icon;
              const selected = data.usageIntent === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onChange({ usageIntent: opt.value })}
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
                   <span className={`text-sm font-medium text-pretty ${selected ? "text-foreground" : "text-muted-foreground"}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
          <Button onClick={() => setSubStep(1)} className="w-full rounded-full" size="lg" disabled={!data.usageIntent}>
            Next
          </Button>
        </div>
      );
    }

    if (subStep === 1) {
      return (
        <div className="space-y-6 animate-fade-in" key="q1">
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl font-bold text-foreground text-pretty">How long have you been together?</h2>
          </div>
          <div className="space-y-3">
            {durationOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange({ relationshipDuration: opt.value })}
                className={`w-full p-4 rounded-2xl border-2 text-sm font-medium text-left transition-all duration-200 ${
                  data.relationshipDuration === opt.value
                    ? "border-primary bg-secondary text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setSubStep(0)} variant="secondary" className="rounded-full" size="lg">Back</Button>
            <Button onClick={() => setSubStep(2)} className="flex-1 rounded-full" size="lg" disabled={!data.relationshipDuration}>
              Next
            </Button>
          </div>
        </div>
      );
    }

    if (subStep === 2) {
      return (
        <div className="space-y-6 animate-fade-in" key="q2">
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl font-bold text-foreground text-pretty">Have you talked about money before?</h2>
          </div>
          <div className="space-y-3">
            {talkOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange({ moneyTalkFrequency: opt.value })}
                className={`w-full p-4 rounded-2xl border-2 text-sm font-medium text-left transition-all duration-200 ${
                  data.moneyTalkFrequency === opt.value
                    ? "border-primary bg-secondary text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setSubStep(1)} variant="secondary" className="rounded-full" size="lg">Back</Button>
            <Button onClick={() => setSubStep(3)} className="flex-1 rounded-full" size="lg" disabled={!data.moneyTalkFrequency}>
              Next
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in" key="q3">
        <div className="text-center space-y-2">
          <h2 className="font-display text-2xl font-bold text-foreground text-pretty">What would you like help with most?</h2>
          <p className="text-muted-foreground text-sm text-pretty">Choose as many as you like</p>
        </div>
        <div className="space-y-3">
          {helpOptions.map((opt) => {
            const selected = data.helpTopics.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange({
                    helpTopics: selected
                      ? data.helpTopics.filter((t) => t !== opt)
                      : [...data.helpTopics, opt],
                  });
                }}
                className={`w-full p-4 rounded-2xl border-2 text-sm font-medium text-left transition-all duration-200 ${
                  selected
                    ? "border-primary bg-secondary text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setSubStep(2)} variant="secondary" className="rounded-full" size="lg">Back</Button>
          <Button onClick={onNext} className="flex-1 rounded-full" size="lg">
            Continue
          </Button>
        </div>
      </div>
    );
  };

  const totalQuestions = 4;

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center justify-center gap-1.5 pb-6">
        {Array.from({ length: totalQuestions }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === subStep ? "w-6 bg-primary" : i < subStep ? "w-1.5 bg-primary/40" : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>
      {renderQuestion()}
    </div>
  );
};

export default PersonalizationStep;
