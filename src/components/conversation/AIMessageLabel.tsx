import { MessageCircleQuestion, Lightbulb, Hand } from "lucide-react";

type AILabelType = "welcome" | "question" | "insight";

export function getAILabelType(content: string, isFirstAIMessage: boolean): AILabelType {
  if (isFirstAIMessage) return "welcome";
  if (content.trim().endsWith("?")) return "question";
  return "insight";
}

const labelConfig = {
  welcome: { icon: Hand, text: "Welcome" },
  question: { icon: MessageCircleQuestion, text: "Question" },
  insight: { icon: Lightbulb, text: "Insight" },
} as const;

export function AIMessageLabel({ type }: { type: AILabelType }) {
  const config = labelConfig[type];
  const Icon = config.icon;
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 px-1 text-primary/70 flex items-center gap-1">
      <Icon className="w-3 h-3" /> {config.text}
    </p>
  );
}

/**
 * For question-type messages, wraps sentences ending with ? in <strong> tags.
 */
export function highlightQuestions(content: string): string {
  // Split by sentences (keeping delimiters), bold any sentence ending with ?
  return content.replace(
    /([^.!?\n]*\?)/g,
    (match) => `**${match.trim()}**`
  );
}
