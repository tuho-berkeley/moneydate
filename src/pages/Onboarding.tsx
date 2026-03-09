import { useState, useEffect, useRef } from "react";
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
  const [isNewUser, setIsNewUser] = useState(true);
  const [data, setData] = useState<OnboardingData>({
    usageIntent: "",
    relationshipDuration: "",
    moneyTalkFrequency: "",
    helpTopics: [],
    partnerCode: "",
  });
  const navigate = useNavigate();
  const { session } = useAuth();
  const wasAuthenticatedBeforeSlides = useRef(!!session);

  // When auth state changes on step 1 (ValueSlides), determine if new user and advance
  useEffect(() => {
    if (!session?.user || step !== 1) return;

    const checkAndAdvance = async () => {
      // If user was already authenticated before reaching slides, they're returning
      if (wasAuthenticatedBeforeSlides.current) {
        navigate("/", { replace: true });
        return;
      }

      // Check if onboarding was already completed (returning user signing in again)
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", session.user.id)
        .single();

      if (profile?.onboarding_completed) {
        // Returning user — go straight home
        navigate("/", { replace: true });
      } else {
        // New user — continue onboarding
        setIsNewUser(true);
        setStep(2);
      }
    };

    checkAndAdvance();
  }, [session, step, navigate]);

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
    // Auth state change will be handled by the useEffect above
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

  // Flow:
  // Step 0: Welcome
  // Step 1: Value Slides + Google Auth
  // Step 2: Personalization (new users only)
  // Step 3: Partner Connection (new users only)
  // Step 4: Trust & Safety (new users only)
  const totalSteps = 5;

  const renderStep = () => {
    switch (step) {
      case 0:
        return <WelcomeStep onNext={next} />;
      case 1:
        return (
          <ValueSlides
            onNext={next}
            onGoogleAuth={handleGoogleAuth}
            authLoading={authLoading}
          />
        );
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress dots */}
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
