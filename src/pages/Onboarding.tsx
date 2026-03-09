import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import WelcomeStep from "@/components/onboarding/WelcomeStep";
import ValueSlides from "@/components/onboarding/ValueSlides";
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
  const [authLoading, setAuthLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [data, setData] = useState<OnboardingData>({
    usageIntent: "",
    relationshipDuration: "",
    moneyTalkFrequency: "",
    helpTopics: [],
    partnerCode: "",
  });

  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!session?.user) {
      setCheckingProfile(false);
      setAuthLoading(false);
      return;
    }

    let active = true;

    const syncOnboardingState = async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", session.user.id)
        .single();

      if (!active) return;

      if (error) {
        toast.error("Could not load onboarding status. Please refresh.");
        setCheckingProfile(false);
        return;
      }

      if (profile?.onboarding_completed) {
        navigate("/", { replace: true });
        return;
      }

      setStep((currentStep) => (currentStep < 2 ? 2 : currentStep));
      setCheckingProfile(false);
      setAuthLoading(false);
    };

    syncOnboardingState();

    return () => {
      active = false;
    };
  }, [loading, navigate, session?.user?.id]);

  const next = () => setStep((s) => s + 1);

  const updateData = (partial: Partial<OnboardingData>) =>
    setData((d) => ({ ...d, ...partial }));

  const handleGoogleAuth = async () => {
    setAuthLoading(true);

    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/onboarding",
    });

    if (error) {
      toast.error(error.message);
      setAuthLoading(false);
    }
  };

  const finishOnboarding = async () => {
    if (!session?.user) return;
    const uid = session.user.id;

    try {
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

  const totalSteps = 5;

  const renderStep = () => {
    switch (step) {
      case 0:
        return <WelcomeStep onNext={next} />;
      case 1:
        return <ValueSlides onGoogleAuth={handleGoogleAuth} authLoading={authLoading} />;
      case 2:
        return (
          <PersonalizationStep
            data={data}
            onChange={updateData}
            onNext={next}
          />
        );
      case 3:
        return <PartnerConnectionStep onNext={next} onSkip={next} />;
      case 4:
        return <TrustStep onFinish={finishOnboarding} />;
      default:
        return null;
    }
  };

  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {step > 0 && step < totalSteps && (
        <div className="flex items-center justify-center gap-1.5 pt-8 pb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
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
