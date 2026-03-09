import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

interface TypewriterTextProps {
  content: string;
  speed?: number; // ms per word
  onComplete?: () => void;
}

/**
 * Close any unclosed markdown formatting tokens so partial text renders correctly.
 * Handles **, *, ~~, and ` markers.
 */
function closeMarkdown(text: string): string {
  let result = text;

  // Count occurrences of ** (bold) — must check before single *
  const boldCount = (result.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) result += "**";

  // Count single * not part of ** (italic)
  const allStars = (result.match(/\*/g) || []).length;
  const singleStars = allStars - boldCount * 2;
  // After closing bold above, recount
  const recountBold = (result.match(/\*\*/g) || []).length;
  const recountAll = (result.match(/\*/g) || []).length;
  const recountSingle = recountAll - recountBold * 2;
  if (recountSingle % 2 !== 0) result += "*";

  // Strikethrough ~~
  const tildeCount = (result.match(/~~/g) || []).length;
  if (tildeCount % 2 !== 0) result += "~~";

  // Inline code `
  const backtickCount = (result.match(/`/g) || []).length;
  if (backtickCount % 2 !== 0) result += "`";

  return result;
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

  const visibleText = closeMarkdown(words.slice(0, visibleCount).join(""));

  return (
    <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
      <ReactMarkdown>{visibleText}</ReactMarkdown>
    </div>
  );
};

export default TypewriterText;
