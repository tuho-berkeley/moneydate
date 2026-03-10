import { useEffect, useRef, useLayoutEffect } from "react";
import ReactMarkdown from "react-markdown";

interface TypewriterTextProps {
  content: string;
  speed?: number; // ms per character-batch tick
  onComplete?: () => void;
}

/**
 * Typewriter that renders full markdown once (preserving bold/italic/etc),
 * then progressively reveals characters by manipulating text nodes directly.
 * No re-parsing of markdown on each tick → no blinking.
 */
const TypewriterText = ({ content, speed = 18, onComplete }: TypewriterTextProps) => {
  const hiddenRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useLayoutEffect(() => {
    const hidden = hiddenRef.current;
    const visible = visibleRef.current;
    if (!hidden || !visible) return;

    // Copy the fully-rendered markdown HTML into the visible container
    visible.innerHTML = hidden.innerHTML;

    // Collect all text nodes in document order
    const walker = document.createTreeWalker(visible, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    const originals = textNodes.map((n) => n.textContent || "");
    const totalChars = originals.reduce((sum, t) => sum + t.length, 0);

    if (totalChars === 0) {
      onCompleteRef.current?.();
      return;
    }

    // Clear all text nodes
    textNodes.forEach((n) => (n.textContent = ""));

    let revealed = 0;
    const charsPerTick = 2;

    const timer = setInterval(() => {
      revealed = Math.min(revealed + charsPerTick, totalChars);

      let remaining = revealed;
      for (let i = 0; i < textNodes.length; i++) {
        const orig = originals[i];
        if (remaining >= orig.length) {
          textNodes[i].textContent = orig;
          remaining -= orig.length;
        } else {
          textNodes[i].textContent = orig.substring(0, remaining);
          remaining = 0;
          // Don't break — clear the rest
        }
        if (remaining <= 0 && i < textNodes.length - 1) {
          // Clear remaining text nodes that haven't been revealed yet
          for (let j = i + 1; j < textNodes.length; j++) {
            if (textNodes[j].textContent !== "") {
              textNodes[j].textContent = "";
            }
          }
          break;
        }
      }

      if (revealed >= totalChars) {
        clearInterval(timer);
        onCompleteRef.current?.();
      }
    }, speed);

    return () => clearInterval(timer);
  }, [content, speed]);

  return (
    <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:font-semibold">
      {/* Hidden: ReactMarkdown renders full content to get proper HTML */}
      <div
        ref={hiddenRef}
        style={{ position: "absolute", visibility: "hidden", height: 0, overflow: "hidden", pointerEvents: "none" }}
        aria-hidden="true"
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      {/* Visible: characters revealed progressively */}
      <div ref={visibleRef} />
    </div>
  );
};

export default TypewriterText;
