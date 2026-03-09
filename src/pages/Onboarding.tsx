import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import WelcomeStep from "@/components/onboarding/WelcomeStep";
import ValueSlides from "@/components/onboarding/ValueSlides";
import AuthStep from "@/components/onboarding/AuthStep";
import PartnerConnectionStep from "@/components/onboarding/PartnerConnectionStep";
import PersonalizationStep from "@/components/onboarding/PersonalizationStep";
import TrustStep from "@/components/onboarding/TrustStep";

export interface OnboardingData {
  usageIntent: string;
  relationshipDuration: string;
  moneyTalkFrequency: string;
  helpTopics: string[];
  partnerCode: string;
}

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    usageIntent: "",
    relationshipDuration: "",
    moneyTalkFrequency: "",
    helpTopics: [],
    partnerCode: "",
  });
  const navigate = useNavigate();
  const { session } = useAuth();

  const next = () => setStep((s) => s + 1);

  const updateData = (partial: Partial<OnboardingData>) =>
    setData((d) => ({ ...d, ...partial }));

  const finishOnboarding = async () => {
    if (!session?.user) return;
    const uid = session.user.id;

    try {
      // Save preferences
      const { error: prefError } = await supabase
        .from("user_preferences" as any)
        .upsert({
          user_id: uid,
          usage_intent: data.usageIntent,
          relationship_duration: data.relationshipDuration,
          money_talk_frequency: data.moneyTalkFrequency,
          help_topics: data.helpTopics,
        } as any);

      if (prefError) throw prefError;

      // Mark onboarding completed
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true } as any)
        .eq("id", uid);

      if (profileError) throw profileError;

      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error("Something went wrong. Please try again.");
      console.error(err);
    }
  };

  // Steps 0-2 are pre-auth, steps 3+ require auth
  // Step 3 is auth (signup/login) — if user is already authenticated, skip it
  const isAuthenticated = !!session;

  const renderStep = () => {
    switch (step) {
      case 0:
        return <WelcomeStep onNext={next} />;
      case 1:
        return <ValueSlides onNext={next} />;
      case 2:
        return (
          <PersonalizationStep
            data={data}
            onChange={updateData}
            onNext={next}
          />
        );
      case 3:
        if (isAuthenticated) {
          setStep(4);
          return null;
        }
        return <AuthStep onNext={() => setStep(4)} />;
      case 4:
        return <PartnerConnectionStep onNext={next} onSkip={next} />;
      case 5:
        return <TrustStep onFinish={finishOnboarding} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress dots */}
      {step > 0 && step < 6 && (
        <div className="flex items-center justify-center gap-1.5 pt-8 pb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {renderStep()}
      </div>
    </div>
  );
};

export default Onboarding;
