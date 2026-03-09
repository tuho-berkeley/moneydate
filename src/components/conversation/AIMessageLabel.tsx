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

export function AIMessageLabel({ type, askedName }: { type: AILabelType; askedName?: string }) {
  const config = labelConfig[type];
  const Icon = config.icon;
  const label = type === "question" && askedName
    ? `Question for ${askedName}`
    : config.text;
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 px-1 text-primary/70 flex items-center gap-1">
      <Icon className="w-3 h-3" /> {label}
    </p>
  );
}

/**
 * For question-type messages, wraps sentences ending with ? in <strong> tags.
 */
export function highlightQuestions(content: string): string {
  // Bold only the first sentence that ends with "?"
  const stripped = content.replace(/\*\*([^*]*\?)\*\*/g, '$1');
  let found = false;
  return stripped.replace(
    /([^.!?\n]*\?)/,
    (match) => {
      if (found) return match;
      found = true;
      const trimmed = match.trim();
      if (!trimmed) return match;
      const leading = match.match(/^(\s*)/)?.[1] || '';
      return `${leading}**${trimmed}**`;
    }
  );
}
