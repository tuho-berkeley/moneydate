import { useState } from "react";
import { Users, Copy, ArrowRight, Share2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  inviteCode: string;
  onShare: () => void;
}

const ProfilePartnerSection = ({ inviteCode, onShare }: Props) => {
  const [showJoin, setShowJoin] = useState(false);
  const [showInviteOptions, setShowInviteOptions] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const { user } = useAuth();

  const handleJoin = async () => {
    if (!joinCode.trim() || !user) return;
    setJoining(true);

    const { data: couple, error } = await supabase.
    from("couples").
    select("id").
    eq("invite_code", joinCode.trim().toLowerCase()).
    single();

    if (error || !couple) {
      toast.error("Invalid code. Please check and try again.");
      setJoining(false);
      return;
    }

    const { error: updateError } = await supabase.
    from("profiles").
    update({ couple_id: couple.id } as any).
    eq("id", user.id);

    if (updateError) {
      toast.error("Could not join. Please try again.");
      setJoining(false);
      return;
    }

    toast.success("Connected with your partner! Refreshing...");
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success("Invite code copied!");
    setShowInviteOptions(false);
  };

  const handleShareMessage = () => {
    onShare();
    setShowInviteOptions(false);
  };

  return (
    <div>
      <h3 className="font-display text-lg font-semibold text-foreground mb-3 px-1">Your Partner</h3>
      <div className="bg-card rounded-xl shadow-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">No partner connected</p>
            <p className="text-xs text-muted-foreground">Invite or join with a code</p>
          </div>
        </div>

        {showInviteOptions ? (
          <div className="space-y-2">
            <button
              onClick={handleCopyCode}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                <Copy className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Copy Code</p>
                <p className="text-xs text-muted-foreground font-mono tracking-widest uppercase">{inviteCode}</p>
              </div>
            </button>
            <button
              onClick={handleShareMessage}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                <Share2 className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Send Message</p>
                <p className="text-xs text-muted-foreground">Share invite link via message</p>
              </div>
            </button>
            <Button onClick={() => setShowInviteOptions(false)} variant="ghost" size="sm" className="w-full rounded-full">
              Cancel
            </Button>
          </div>
        ) : showJoin ? (
          <div className="space-y-2">
            <Input
              placeholder="ENTER INVITE CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="text-center text-base font-mono tracking-widest uppercase"
              maxLength={8}
            />
            <div className="flex gap-2">
              <Button onClick={handleJoin} size="sm" className="flex-1 rounded-full" disabled={!joinCode.trim() || joining}>
                {joining ? "Connecting..." : "Connect"}
              </Button>
              <Button onClick={() => setShowJoin(false)} variant="ghost" size="sm" className="rounded-full">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => setShowInviteOptions(true)} variant="default" size="sm" className="flex-1 rounded-full gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Invite Partner
            </Button>
            <Button onClick={() => setShowJoin(true)} variant="outline" size="sm" className="flex-1 rounded-full gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" />
              Join with Code
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePartnerSection;