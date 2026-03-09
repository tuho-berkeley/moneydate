import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

const TrustStep = ({ onFinish }: { onFinish: () => void }) => (
  <div className="w-full max-w-sm text-center space-y-8 animate-fade-in">
    <div className="space-y-4">
      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto">
        <ShieldCheck className="w-8 h-8 text-primary" />
      </div>
      <h2 className="font-display text-2xl font-bold text-foreground text-pretty">Your trust matters</h2>
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        MoneyDate helps guide conversations and financial planning.
        It does not provide investment, tax, or legal advice.
        When needed, we'll suggest speaking with a professional.
      </p>
    </div>
    <Button onClick={onFinish} className="w-full rounded-full" size="lg">
      Got it
    </Button>
  </div>
);

export default TrustStep;
