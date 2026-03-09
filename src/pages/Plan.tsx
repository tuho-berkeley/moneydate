import { PiggyBank, Shield, Plane, CreditCard, Plus } from "lucide-react";

const plans = [
{
  icon: Shield,
  title: "Emergency Fund",
  target: "$10,000",
  current: 4200,
  total: 10000,
  color: "bg-success-light text-success"
},
{
  icon: PiggyBank,
  title: "Wedding Fund",
  target: "$25,000",
  current: 8500,
  total: 25000,
  color: "bg-accent text-primary"
},
{
  icon: Plane,
  title: "Honeymoon Trip",
  target: "$6,000",
  current: 1200,
  total: 6000,
  color: "bg-secondary text-secondary-foreground"
},
{
  icon: CreditCard,
  title: "Debt Payoff",
  target: "$3,200",
  current: 2100,
  total: 3200,
  color: "bg-success-light text-success"
}];


const Plan = () => {
  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="max-w-lg mx-auto">
        <div className="px-6 pt-8 pb-6">
          <p className="text-sm text-muted-foreground font-medium">Your finances</p>
          <h1 className="font-display text-2xl font-bold text-foreground mt-1">Plans</h1>
        </div>

        <div className="px-6 space-y-3">
          {/* Total Progress */}
          <div className="bg-card p-6 shadow-soft rounded-xl">
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">Total Saved</h3>
            <p className="text-3xl font-bold text-primary">$16,000</p>
            <p className="text-xs text-muted-foreground mt-1">across all goals</p>
          </div>

          {/* Plan Cards */}
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const pct = Math.round(plan.current / plan.total * 100);
            return (
              <div
                key={i}
                className="bg-card p-4 shadow-card rounded-xl">
                
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${plan.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-foreground">{plan.title}</h4>
                      <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-muted-foreground">${plan.current.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">{plan.target}</span>
                    </div>
                  </div>
                </div>
              </div>);

          })}

          {/* Add Plan Button */}
          <button className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl py-4 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
            <Plus className="w-5 h-5" />
            <span className="text-sm font-medium">Create New Plan</span>
          </button>
        </div>
      </div>
    </div>);

};

export default Plan;