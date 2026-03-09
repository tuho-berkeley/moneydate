import { MessageCircle, ArrowRight } from "lucide-react";

const UpNextCard = () => {
  return (
    <div className="bg-card rounded-3xl p-6 shadow-soft">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary-foreground bg-secondary px-3 py-1 rounded-full">
          Up Next
        </span>
      </div>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">
            Money Values Talk
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Discover what money really means to each of you and explore your core financial values together.
          </p>
        </div>
      </div>
      <button className="mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]">
        Start Conversation
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default UpNextCard;
