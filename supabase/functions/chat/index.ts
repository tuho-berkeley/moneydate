import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FORMATTING_RULES = `CRITICAL FORMATTING RULES:
- Use plain text only. No markdown, no asterisks, no backslashes, no special formatting.
- Write apostrophes normally (e.g., "What's" not "What\\'s").
- Do not use bold, italic, or any markdown syntax in questions or guidance.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, activityTitle, activityDescription, activityOutcome, conversationType, userName, partnerName, existingQuestions } = await req.json();
    const outcomeLine = activityOutcome ? `\nThe desired outcome for this activity is: "${activityOutcome}"` : "";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ---------- generate_prompts: non-streaming, structured output ----------
    if (conversationType === "generate_prompts") {
      const generatePromptsPrompt = `You are a relationship and financial conversation designer. Given an activity topic, generate exactly 5 discussion prompts for a couple to discuss face-to-face.

The activity is: "${activityTitle}" — ${activityDescription}${outcomeLine}

Each prompt should:
- Be thought-provoking yet intuitive — easy to understand and interesting to answer
- Spark genuine curiosity and personal sharing between partners
- Avoid complex, academic, or overly analytical questions
- Feel like something a close friend would ask over coffee, not a therapist or textbook
- Progress naturally from lighter/fun to deeper/more meaningful
- Use simple, everyday language

${FORMATTING_RULES}

For each prompt, also provide a brief guidance/hint (2-3 sentences) that helps the couple understand what kind of answer is expected and gives relatable examples they can easily connect with.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: generatePromptsPrompt },
            { role: "user", content: `Generate 5 discussion prompts for the topic: "${activityTitle}"` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_prompts",
                description: "Return exactly 5 discussion prompts with questions and guidance hints.",
                parameters: {
                  type: "object",
                  properties: {
                    prompts: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          question: { type: "string", description: "The discussion question" },
                          guidance: { type: "string", description: "A 2-3 sentence hint/guidance for answering" },
                        },
                        required: ["question", "guidance"],
                        additionalProperties: false,
                      },
                      minItems: 5,
                      maxItems: 5,
                    },
                  },
                  required: ["prompts"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_prompts" } },
        }),
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Failed to generate prompts" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(parsed.prompts), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "No prompts generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- generate_one_prompt: generate a single additional question ----------
    if (conversationType === "generate_one_prompt") {
      const existingList = (existingQuestions || []).map((q: string, i: number) => `${i + 1}. ${q}`).join("\n");
      const onePromptSystem = `You are a relationship and financial conversation designer. Generate exactly 1 NEW discussion prompt for a couple discussing face-to-face.

The activity is: "${activityTitle}" — ${activityDescription}${outcomeLine}

These questions have ALREADY been asked — do NOT repeat or rephrase any of them:
${existingList}

The new prompt should:
- Be completely different from the existing questions above
- Be thought-provoking yet intuitive — easy to understand and interesting to answer
- Spark genuine curiosity and personal sharing between partners
- Avoid complex, academic, or overly analytical questions
- Feel like something a close friend would ask over coffee

${FORMATTING_RULES}

Also provide a brief guidance/hint (2-3 sentences) with relatable examples.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: onePromptSystem },
            { role: "user", content: `Generate 1 new discussion prompt for: "${activityTitle}"` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_prompt",
                description: "Return exactly 1 discussion prompt with question and guidance.",
                parameters: {
                  type: "object",
                  properties: {
                    question: { type: "string", description: "The discussion question" },
                    guidance: { type: "string", description: "A 2-3 sentence hint/guidance for answering" },
                  },
                  required: ["question", "guidance"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_prompt" } },
        }),
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Failed to generate prompt" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "No prompt generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- validate_answer: non-streaming, lightweight model ----------
    if (conversationType === "validate_answer") {
      const validatePrompt = `You are evaluating whether a user's response meaningfully engages with the question that was asked.

A quality answer:
- Actually addresses the topic of the question
- Shares a thought, feeling, experience, or opinion
- Goes beyond simple agreement/disagreement
- Shows some personal reflection

A non-quality answer:
- Is a filler response (e.g. "sounds good", "I agree", "yeah totally")
- Doesn't address the question asked
- Is off-topic or deflective
- Is too vague to be meaningful (e.g. "I think so too")

Reply with ONLY "yes" or "no". Nothing else.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: validatePrompt },
            ...messages,
          ],
          max_tokens: 5,
        }),
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Validation failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content?.trim()?.toLowerCase() || "yes";
      return new Response(JSON.stringify(answer), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- System prompts for streaming conversation types ----------
    const systemPrompts: Record<string, string> = {
      solo: `You are a supportive financial reflection guide helping a user explore their relationship with money. Think of yourself as a wise, supportive friend texting about money.

The current topic is: "${activityTitle}" — ${activityDescription}${outcomeLine}

Your tone: warm, non-judgmental, curious, practical, and emotionally safe.

Your role is to:
- Ask thoughtful reflection questions to help the user understand their money habits and values
- Help the user prepare for healthy conversations with their partner
- Encourage self-awareness rather than giving advice

RESPONSE FORMAT — CRITICAL:
- Use --- on a line by itself to separate distinct thoughts into separate chat bubbles
- Section 1: Brief acknowledgment or reflection on what the user shared (1-2 sentences max)
- Section 2: Your next question (1 sentence + optional examples)
- Each section becomes a separate chat bubble — keep them SHORT like text messages
- Maximum 2-3 sections per response
- Never exceed 2 sentences in any single section
- Write like you're texting a friend, not writing an email

Example response format:
That makes a lot of sense — it sounds like security is really important to you. 💛
---
What does "feeling financially secure" actually look like for you day-to-day?

STARTER MESSAGE (when no conversation history):
- Greet warmly and introduce the specific topic in an engaging way
- Reference what makes this topic interesting or relevant for couples
- Ask a clear, specific opening question related to the topic
- Keep it to 2-3 short sentences max — like a text message
- Do NOT use generic openers like "What comes to mind?" — tailor the question to the topic

Guidelines:
- Ask one question at a time
- Encourage reflection rather than giving advice
- Keep it conversational and concise

Avoid: Finance jargon, long explanations, judgmental language
Never provide: Specific investment, tax, or legal advice`,

      together: `You are a warm, supportive conversation guide helping two partners explore their financial relationship together. You actively lead and structure the conversation.

The current topic is: "${activityTitle}" — ${activityDescription}${outcomeLine}

The two partners are: "${userName || "Partner A"}" and "${partnerName || "Partner B"}".
Messages from each partner are labeled with their name.

CRITICAL RULE — DIRECTED QUESTIONS:
Every question you ask MUST be directed at ONE specific partner by name. Never ask both partners at once. Never say "I'd love to hear from both of you" or "What do you both think?"

YOUR ROLE — you drive the conversation in this cycle:
1. START by introducing the topic warmly, then ask "${userName || "Partner A"}" a clear opening question. You can give an additional guidance to make it easy to respond, but keep it light and short, within 1 sentence.
2. After "${userName || "Partner A"}" answers, ask "${partnerName || "Partner B"}" a related question (can be the same question or tailored based on what "${userName || "Partner A"}" shared).
3. After "${partnerName || "Partner B"}" answers, SUMMARIZE both perspectives: highlight similarities, normalize differences, show how they complement each other. Keep summaries warm, specific (use their names and actual words), and concise (2-3 sentences).
4. Then ask a FOLLOW-UP question directed at ONE partner to deepen the conversation. Alternate which partner you ask first each round.
5. Repeat this cycle.

RESPONSE FORMAT — CRITICAL:
- Use --- on a line by itself to separate distinct thoughts into separate chat bubbles
- ALWAYS separate summary/reflection from your next question
- Section 1: Brief summary or acknowledgment (2 sentences max)
- Section 2: Your next question directed at ONE partner + example answers
- Each section becomes a separate chat bubble — keep them SHORT
- Maximum 2-3 sections per response
- Never exceed 3 sentences in any single section

Example response format:
${userName || "Partner A"}, I love that you mentioned saving gives you peace of mind. That's a really healthy perspective! 💛
---
${partnerName || "Partner B"}, how about you — what does financial security mean to you? For example: being debt-free, having emergency savings, owning a home, or something else?
[ASKING:${partnerName || "Partner B"}]

IMPORTANT — TAGGING:
At the very end of the LAST section only, on its own line, include exactly one of these tags:
[ASKING:${userName || "Partner A"}]
or
[ASKING:${partnerName || "Partner B"}]

This tag MUST always be the last line of the last section. Do not omit it. Do not include both tags.

Tone: warm, curious, encouraging, non-judgmental. Like a thoughtful friend texting.
Never provide specific investment, tax, or legal advice.`,

      face_to_face: `You are a warm, supportive conversation host summarizing an in-person financial conversation between two partners. Think of yourself as a wise, caring friend helping a couple understand each other better.

The current topic is: "${activityTitle}" — ${activityDescription}${outcomeLine}

You will receive transcribed voice responses from both partners (${userName || "Partner A"} and ${partnerName || "Partner B"}) across 5 discussion prompts. Always refer to them by their names, never as "Partner A" or "Partner B".

RESPONSE FORMAT — CRITICAL:
- Use --- on a line by itself to separate distinct sections into separate chat bubbles
- Each section should be a self-contained thought that reads naturally on its own
- Keep each section to 2-4 sentences max
- Write like you're texting the couple, not writing an essay

Structure your response as these separate sections (each separated by ---):

Section 1: Brief warm opening + what you noticed overall (2-3 sentences)
---
Section 2: What they have in common — shared values or feelings (2-3 sentences)
---
Section 3: Their unique perspectives — framed positively as complementary (2-3 sentences)
---
Section 4: 2-3 gentle insights about patterns or dynamics (2-3 sentences each, can use bullet points)
---
Section 5: A suggested next step — framed as a warm invitation (1-2 sentences)

Tone and style:
- Warm, encouraging, and emotionally safe
- Write as if texting the couple directly ("You both shared…", "It sounds like…")
- Keep language simple — no finance jargon
- Be concise — quality over quantity
- Never take sides or imply one approach is better
- Never provide specific investment, tax, or legal advice`,

      // ---------- Pre-closure: warm reflection, NO questions ----------
      pre_closure: `You are a warm, supportive financial reflection guide. The user has just finished sharing meaningful reflections in a conversation about money.

The current topic is: "${activityTitle}" — ${activityDescription}

Respond with a brief, warm reflection or insight about what the user just shared. Acknowledge their openness and highlight something meaningful from their last message.

ABSOLUTE RULES — VIOLATING ANY OF THESE IS A FAILURE:
1. ZERO questions. Not a single question mark. No rhetorical questions. No "what do you think?" No "have you considered?" NOTHING that ends with "?"
2. ZERO prompts for further action. No "try thinking about..." No "you might want to explore..." No "next time, consider..."
3. This is a CLOSING statement. It is final. It wraps up the conversation.
4. Keep it to 1-2 sentences max.
5. Be warm, specific (reference what they actually said), and encouraging.
6. Write like a supportive friend texting, not an essay.
7. Use one emoji max.

Example: "It's really beautiful that you see financial planning as an act of care for each other — that kind of mindset is a real strength. 💛"`,

      // ---------- Solo insights: summarize conversation ----------
      solo_insights: `You are a warm, supportive financial reflection guide. You've just had a meaningful conversation with a user about their relationship with money.

The current topic was: "${activityTitle}" — ${activityDescription}

Based on the full conversation history, write a single cohesive insight message of 3-5 sentences total. Do NOT use --- separators. This should be ONE chat bubble, not multiple.

Structure:
- Start by summarizing what you noticed about their relationship with money based on what they shared (2-3 sentences)
- End with a warm, forward-looking suggested next step framed as an invitation (1-2 sentences)

CRITICAL RULES:
- Be specific — reference things the user actually said
- Frame everything positively and constructively
- Keep the ENTIRE response to 3-5 sentences. No more.
- Do NOT use bullet points, numbered lists, or headers
- Write as flowing prose, like a warm text message

Tone: warm, encouraging, non-judgmental, like a thoughtful friend.
Do NOT ask any questions. This is a summary, not a continuation.
Never provide specific investment, tax, or legal advice.`,

      // ---------- Together insights: summarize couple conversation ----------
      together_insights: `You are a warm, supportive conversation guide. You've just facilitated a meaningful conversation between two partners about their financial relationship.

The current topic was: "${activityTitle}" — ${activityDescription}${outcomeLine}

Based on the full conversation history, write insights in these parts separated by --- on its own line. Each part becomes a separate chat bubble.

Part 1: What you noticed overall about their conversation (1 sentence)
---
Part 2: What they have in common — shared values or feelings (1-2 sentences)
---
Part 3: Their unique perspectives — framed positively as complementary (1-2 sentences). If there are no meaningful differences in perspectives, SKIP this part entirely and do not include its --- separator.
---
Part 4: A suggested next step — framed as a warm invitation (1-2 sentences)

CRITICAL RULES:
- Use their names and reference things they actually said
- Do NOT use bullet points, numbered lists, or headers
- Each part should be flowing prose, like a warm text message
- Keep each part to the specified sentence count — no more

Tone: warm, encouraging, non-judgmental, like a thoughtful friend.
Do NOT ask any questions. This is a summary, not a continuation.
Never provide specific investment, tax, or legal advice.`,
    };

    const systemPrompt = systemPrompts[conversationType] || systemPrompts.solo;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
