import { Heart, Bell, FileText, Eye, Link2, ChevronRight, LogOut } from "lucide-react";

const settings = [
  { icon: Bell, label: "Notifications", toggle: true, active: true },
  { icon: Heart, label: "Weekly Money Date Reminders", toggle: true, active: true },
  { icon: FileText, label: "AI Conversation Summaries", toggle: true, active: false },
  { icon: Eye, label: "Shared Vault Access", toggle: true, active: true },
];

const goals = [
  { icon: "🛡️", title: "Emergency Fund", progress: 42 },
  { icon: "💍", title: "Wedding Fund", progress: 34 },
  { icon: "✈️", title: "Honeymoon Trip", progress: 20 },
];

const Profile = () => {
  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Couple Hero */}
      <div className="px-6 pt-14 pb-6">
        <div className="bg-card rounded-3xl p-6 shadow-soft text-center animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-lg font-bold text-primary">
              S
            </div>
            <div className="flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary fill-primary" />
            </div>
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-secondary-foreground">
              J
            </div>
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">Sarah & James</h2>
          <p className="text-sm text-muted-foreground mt-1">Together since March 2024</p>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <Link2 className="w-3.5 h-3.5 text-success" />
            <span className="text-xs font-medium text-success">Connected</span>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-5">
        {/* Shared Goals */}
        <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
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

        {/* Preferences */}
        <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <h3 className="font-display text-lg font-semibold text-foreground mb-3 px-1">Preferences</h3>
          <div className="bg-card rounded-2xl shadow-card divide-y divide-border overflow-hidden">
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

        {/* Disconnect */}
        <div className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <button className="w-full flex items-center justify-center gap-2 text-destructive text-sm font-medium py-3 rounded-2xl border border-destructive/20 hover:bg-destructive/5 transition-colors">
            <LogOut className="w-4 h-4" />
            Disconnect Partner
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
