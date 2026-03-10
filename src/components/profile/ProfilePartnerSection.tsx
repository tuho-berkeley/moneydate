import { useState } from "react";
import { Users, Copy, ArrowRight, Share2 } from "lucide-react";
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
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const { user } = useAuth();

  const handleJoin = async () => {
    if (!joinCode.trim() || !user) return;
    setJoining(true);

    const { data: couple, error } = await supabase.
    from("couples").
    select("id").
    eq("invite_code", joinCode.trim().toUpperCase()).
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

  return (
    <div>
      <h3 className="font-display text-lg font-semibold text-foreground mb-3 px-1 uppercase">Your Partner</h3>
      <div className="bg-card rounded-xl shadow-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground uppercase">No partner connected</p>
            <p className="text-xs text-muted-foreground uppercase">Invite or join with a code</p>
          </div>
        </div>

        {!showJoin ?
        <div className="flex gap-2">
            <Button onClick={onShare} variant="default" size="sm" className="flex-1 rounded-full gap-1.5 uppercase">
              <Share2 className="w-3.5 h-3.5" />
              Share Invite
            </Button>
            <Button onClick={() => setShowJoin(true)} variant="outline" size="sm" className="flex-1 rounded-full gap-1.5 uppercase">
              <ArrowRight className="w-3.5 h-3.5" />
              Join with Code
            </Button>
          </div> :

        <div className="space-y-2">
            <Input
            placeholder="ENTER INVITE CODE"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="text-center text-sm font-mono tracking-widest"
            maxLength={8} />
          
            <div className="flex gap-2">
              <Button onClick={handleJoin} size="sm" className="flex-1 rounded-full uppercase" disabled={!joinCode.trim() || joining}>
                {joining ? "CONNECTING..." : "CONNECT"}
              </Button>
              <Button onClick={() => setShowJoin(false)} variant="ghost" size="sm" className="rounded-full uppercase">
                Cancel
              </Button>
            </div>
          </div>
        }
      </div>
    </div>);

};

export default ProfilePartnerSection;