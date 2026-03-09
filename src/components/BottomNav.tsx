import { Home, BarChart3, Target, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const tabs = [
  { path: "/", label: "Home", icon: Home },
  { path: "/insights", label: "Insights", icon: BarChart3 },
  { path: "/plan", label: "Plan", icon: Target },
  { path: "/profile", label: "Profile", icon: User },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();

  if (!session) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <nav className="flex items-center gap-1 bg-card/90 backdrop-blur-xl rounded-full px-2 py-1.5 shadow-soft border border-border/50">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-0 px-4 py-1.5 rounded-full transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
