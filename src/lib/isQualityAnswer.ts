import { supabase } from "@/integrations/supabase/client";

const FILLER_WORDS = new Set([
  "yes", "no", "ok", "okay", "sure", "maybe", "idk", "lol", "haha",
  "same", "true", "agree", "yeah", "nah", "nope", "fine", "cool",
  "nice", "hmm", "mhm", "yep", "yup", "dunno", "whatever", "thanks",
  "thank you", "right", "exactly", "totally", "absolutely", "definitely",
  "i guess", "i think so", "not really", "sort of", "kind of",
  "i don't know", "no idea",
]);

const EMOJI_ONLY = /^[\p{Emoji}\s]+$/u;

/**
 * Fast client-side pre-filter: immediately rejects obvious non-answers.
 * Exported so callers can seed quality counts from historical messages.
 */
export function passesPreFilter(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  if (EMOJI_ONLY.test(trimmed)) return false;

  const words = trimmed.split(/\s+/);
  if (words.length < 3) return false;

  const normalized = trimmed.toLowerCase().replace(/[.!?,;:'"]+/g, "").trim();
  if (FILLER_WORDS.has(normalized)) return false;

  return true;
}

/**
 * AI-powered quality answer validation. Calls the edge function
 * with a lightweight model to check if the answer meaningfully
 * engages with the question.
 *
 * Returns true if quality, false otherwise.
 */
export async function isQualityAnswer(
  lastQuestion: string,
  answer: string
): Promise<boolean> {
  if (!passesPreFilter(answer)) return false;

  try {
    const resp = await supabase.functions.invoke("chat", {
      body: {
        messages: [
          { role: "assistant", content: lastQuestion },
          { role: "user", content: answer },
        ],
        activityTitle: "",
        activityDescription: "",
        conversationType: "validate_answer",
      },
    });

    if (resp.error) {
      console.error("Quality validation error:", resp.error);
      // Fail open — count as quality if AI validation fails
      return true;
    }

    const text = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);
    return text.toLowerCase().includes("yes");
  } catch (err) {
    console.error("Quality validation error:", err);
    return true; // fail open
  }
}
