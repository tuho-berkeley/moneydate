import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

interface TypewriterTextProps {
  content: string;
  speed?: number; // ms per word
  onComplete?: () => void;
}

const TypewriterText = ({ content, speed = 30, onComplete }: TypewriterTextProps) => {
  const words = content.split(/(\s+)/); // preserve whitespace
  const [visibleCount, setVisibleCount] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (visibleCount >= words.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return;
    }

    const timer = setTimeout(() => {
      setVisibleCount((c) => Math.min(c + 1, words.length));
    }, speed);

    return () => clearTimeout(timer);
  }, [visibleCount, words.length, speed, onComplete]);

  const visibleText = words.slice(0, visibleCount).join("");

  return (
    <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
      <ReactMarkdown>{visibleText}</ReactMarkdown>
    </div>
  );
};

export default TypewriterText;
