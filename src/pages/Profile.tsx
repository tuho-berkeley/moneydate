import { useEffect, useState } from "react";
import { Heart, Bell, FileText, Eye, Link2, ChevronRight, LogOut, Trash2, Moon, Share2, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ProfilePartnerSection from "@/components/profile/ProfilePartnerSection";

const settings = [
  { icon: Bell, label: "Notifications", toggle: true, active: true },
  { icon: Heart, label: "Weekly Money Date Reminders", toggle: true, active: true },
  { icon: FileText, label: "AI Conversation Summaries", toggle: true, active: true },
  { icon: Eye, label: "Shared Vault Access", toggle: true, active: true },
];

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string; couple_id: string | null } | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [partner, setPartner] = useState<{ display_name: string } | null>(null);
  const [goals, setGoals] = useState<{ icon: string; title: string; progress: number }[]>([]);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleDarkMode = (checked: boolean) => {
    setIsDark(checked);
    document.documentElement.classList.toggle("dark", checked);
    localStorage.setItem("theme", checked ? "dark" : "light");
  };

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, couple_id")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        if (profileData.couple_id) {
          // Fetch invite code
          const { data: couple } = await supabase
            .from("couples")
            .select("invite_code")
            .eq("id", profileData.couple_id)
            .single();
          if (couple) setInviteCode(couple.invite_code);

          // Fetch partner profile
          const { data: partnerProfiles } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("couple_id", profileData.couple_id)
            .neq("id", user.id);
          if (partnerProfiles && partnerProfiles.length > 0) {
            setPartner(partnerProfiles[0]);
          }

          // Fetch financial plans
          const { data: plans } = await supabase
            .from("financial_plans")
            .select("*")
            .eq("couple_id", profileData.couple_id);
          if (plans) {
            setGoals(
              plans.map((p) => ({
                icon: p.icon,
                title: p.title,
                progress: p.target_amount > 0 ? Math.round(Number(p.current_amount) / Number(p.target_amount) * 100) : 0,
              }))
            );
          }
        }
      }
    };
    fetchData();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleDeleteAccount = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentSession?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error("Failed to delete account");
      await signOut();
      navigate("/onboarding");
    } catch {
      toast.error("Could not delete account. Please try again.");
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: "MoneyDate",
      text: `Join me on MoneyDate! Use my invite code: ${inviteCode}`,
      url: `https://moneydate.lovable.app/onboarding?code=${inviteCode}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        toast.success("Share link copied to clipboard!");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        toast.success("Share link copied to clipboard!");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="max-w-lg mx-auto">
        <div className="px-6 pt-8 pb-6">
          <div className="bg-card p-6 shadow-soft text-center rounded-xl">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-lg font-bold text-primary">
                {profile?.display_name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              {partner && (
                <>
                  <span className="text-muted-foreground text-lg">❤️</span>
                  <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-primary">
                    {partner.display_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                </>
              )}
            </div>
            <h2 className="font-display text-xl font-bold text-foreground">
              {profile?.display_name || "Your Profile"}
            </h2>
            {partner && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Connected with <span className="font-medium text-foreground">{partner.display_name}</span>
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
          </div>
        </div>

        <div className="px-6 space-y-5">
          {!partner && <ProfilePartnerSection inviteCode={inviteCode} onShare={handleShare} />}

          {goals.length > 0 && (
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-3 px-1">Shared Goals</h3>
              <div className="space-y-2">
                {goals.map((goal, i) => (
                  <div key={i} className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-3">
                    <span className="text-2xl">{goal.icon}</span>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-foreground">{goal.title}</h4>
                      <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${goal.progress}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{goal.progress}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-display text-lg font-semibold text-foreground mb-3 px-1">Preferences</h3>
            <div className="bg-card shadow-card divide-y divide-border overflow-hidden rounded-xl">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Moon className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium text-foreground">Dark Mode</span>
                <Switch checked={isDark} onCheckedChange={toggleDarkMode} />
              </div>
              {settings.map((setting, i) => {
                const Icon = setting.icon;
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium text-foreground">{setting.label}</span>
                    <div
                      className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
                        setting.active ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-card shadow-sm transition-transform ${
                          setting.active ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 pb-4">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-2xl border border-destructive/20 hover:bg-destructive/5 transition-colors text-primary"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>

            <div className="flex justify-center">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 transition-colors">
                    Delete account
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action is permanent and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
