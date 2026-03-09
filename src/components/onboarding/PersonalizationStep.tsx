import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { OnboardingData } from "@/pages/Onboarding";

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
  "Understanding how we each think about money",
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
        <div className="space-y-6 animate-fade-in" key="q1">
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl font-bold text-foreground">How long have you been together?</h2>
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
          <Button onClick={() => setSubStep(1)} className="w-full rounded-full" size="lg" disabled={!data.relationshipDuration}>
            Next
          </Button>
        </div>
      );
    }

    if (subStep === 1) {
      return (
        <div className="space-y-6 animate-fade-in" key="q2">
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl font-bold text-foreground">Have you talked about money before?</h2>
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
          <Button onClick={() => setSubStep(2)} className="w-full rounded-full" size="lg" disabled={!data.moneyTalkFrequency}>
            Next
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in" key="q3">
        <div className="text-center space-y-2">
          <h2 className="font-display text-2xl font-bold text-foreground">What would you like help with most?</h2>
          <p className="text-muted-foreground text-sm">Choose as many as you like</p>
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
        <Button onClick={onNext} className="w-full rounded-full" size="lg">
          Continue
        </Button>
      </div>
    );
  };

  return <div className="w-full max-w-sm">{renderQuestion()}</div>;
};

export default PersonalizationStep;
