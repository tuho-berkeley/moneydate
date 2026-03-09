import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, Copy, ArrowRight } from "lucide-react";

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

const PartnerConnectionStep = ({ onNext, onSkip }: Props) => {
  const [mode, setMode] = useState<"choose" | "invite" | "join">("choose");
  const [inviteCode, setInviteCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    // Fetch user's couple invite code
    const fetchCode = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("couple_id")
        .eq("id", user.id)
        .single();
      if (data?.couple_id) {
        const { data: couple } = await supabase
          .from("couples")
          .select("invite_code")
          .eq("id", data.couple_id)
          .single();
        if (couple?.invite_code) setInviteCode(couple.invite_code);
      }
    };
    fetchCode();
  }, [user]);

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success("Code copied!");
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !user) return;
    // Find couple by invite code
    const { data: couple, error } = await supabase
      .from("couples")
      .select("id")
      .eq("invite_code", joinCode.trim().toUpperCase())
      .single();

    if (error || !couple) {
      toast.error("Invalid code. Please check and try again.");
      return;
    }

    // Update user's profile to join that couple
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ couple_id: couple.id } as any)
      .eq("id", user.id);

    if (updateError) {
      toast.error("Could not join. Please try again.");
      return;
    }

    toast.success("Connected with your partner!");
    onNext();
  };

  if (mode === "invite") {
    return (
      <div className="w-full max-w-sm space-y-6 animate-fade-in">
        <div className="text-center space-y-3">
          <h2 className="font-display text-2xl font-bold text-foreground text-pretty">Invite your partner</h2>
          <p className="text-muted-foreground text-sm text-pretty">
            Share this code with your partner to connect your accounts.
          </p>
        </div>
        <div className="flex items-center gap-3 p-4 bg-card rounded-2xl border border-border">
          <span className="flex-1 text-center text-2xl font-mono font-bold tracking-widest text-foreground">
            {inviteCode || "..."}
          </span>
          <button onClick={copyCode} className="p-2 rounded-xl bg-muted hover:bg-accent transition-colors">
            <Copy className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-3">
          <Button onClick={onNext} className="w-full rounded-full" size="lg">Continue</Button>
          <Button onClick={() => setMode("choose")} variant="ghost" className="w-full rounded-full">Back</Button>
        </div>
      </div>
    );
  }

  if (mode === "join") {
    return (
      <div className="w-full max-w-sm space-y-6 animate-fade-in">
        <div className="text-center space-y-3">
          <h2 className="font-display text-2xl font-bold text-foreground">Join your partner</h2>
          <p className="text-muted-foreground text-sm">
            Enter the code your partner shared with you.
          </p>
        </div>
        <Input
          placeholder="Enter invite code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          className="text-center text-lg font-mono tracking-widest"
          maxLength={8}
        />
        <div className="space-y-3">
          <Button onClick={handleJoin} className="w-full rounded-full" size="lg" disabled={!joinCode.trim()}>
            Connect
          </Button>
          <Button onClick={() => setMode("choose")} variant="ghost" className="w-full rounded-full">Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-8 animate-fade-in">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold text-foreground">Connect with your partner</h2>
        <p className="text-muted-foreground text-sm">
          MoneyDate works best together, but you can explore solo first.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => setMode("invite")}
          className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border bg-card hover:border-primary/30 transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <Copy className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium text-foreground">Invite Partner</span>
            <p className="text-xs text-muted-foreground">Share a code with your partner</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </button>

        <button
          onClick={() => setMode("join")}
          className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border bg-card hover:border-primary/30 transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Users className="w-5 h-5 text-accent-foreground" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium text-foreground">Join with Code</span>
            <p className="text-xs text-muted-foreground">Enter your partner's invite code</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <button onClick={onSkip} className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
        Skip for now
      </button>
    </div>
  );
};

export default PartnerConnectionStep;
