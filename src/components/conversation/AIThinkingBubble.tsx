import { useState, useEffect } from "react";

const labels = [
  "Thinking…",
  "Reflecting on that…",
  "Preparing a question…",
  "Considering your words…",
];

const AIThinkingBubble = () => {
  const [labelIndex, setLabelIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLabelIndex((i) => (i + 1) % labels.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-start">
      <div className="bg-secondary/50 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="thinking-dot" style={{ animationDelay: "0ms" }} />
            <span className="thinking-dot" style={{ animationDelay: "150ms" }} />
            <span className="thinking-dot" style={{ animationDelay: "300ms" }} />
          </div>
          <span
            key={labelIndex}
            className="text-xs text-muted-foreground animate-fade-in-message"
          >
            {labels[labelIndex]}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AIThinkingBubble;
