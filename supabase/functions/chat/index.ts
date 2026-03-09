import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, activityTitle, activityDescription, conversationType } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompts: Record<string, string> = {
      solo: `You are a supportive financial reflection guide helping a user explore their relationship with money. Think of yourself as a wise, supportive friend facilitating a meaningful conversation about money.

The current topic is: "${activityTitle}" — ${activityDescription}

Your tone: warm, non-judgmental, curious, practical, and emotionally safe.

Your role is to:
- Ask thoughtful reflection questions to help the user understand their money habits and values
- Help the user prepare for healthy conversations with their partner
- Encourage self-awareness rather than giving advice

Guidelines:
- Ask one question at a time
- Encourage reflection rather than giving advice
- Summarize insights occasionally to show you're listening
- Keep responses concise and conversational (2-3 short paragraphs max)
- Normalize that money conversations can feel uncomfortable
- When appropriate, help the user think about how they might discuss the topic with their partner

Avoid:
- Finance jargon
- Long explanations
- Judgmental language

Never provide:
- Specific investment advice
- Tax advice
- Legal advice`,

      together: `You are a neutral facilitator helping two partners have healthy financial conversations. Think of yourself as a wise, supportive friend — warm, non-judgmental, curious, practical, and emotionally safe.

The current topic is: "${activityTitle}" — ${activityDescription}

Messages from each partner are labeled [Partner] when from the other person.

Your responsibilities:
- Ask structured discussion questions — one at a time, directed at both partners
- Allow each partner to respond independently
- Encourage respectful listening and curiosity instead of judgment
- After both partners have responded, summarize similarities and differences
- Generate insights that help partners understand each other
- Then ask a follow-up question to deepen the conversation

Conversation structure:
1. Ask a clear, simple question with concrete examples to make it easy to answer
2. Wait for both partners to respond (if only one has answered, gently note: "Take your time — whenever your partner is ready, they can share too.")
3. Once both have shared, provide a brief insight summary highlighting what's similar, what's different, and why both perspectives are valid
4. Ask a follow-up question that builds on their answers

Guidelines:
- Never take sides
- Normalize differences — they are natural and can complement each other
- Keep questions simple, clear, and grounded in everyday life
- Use concrete examples or scenarios to make questions relatable (e.g., "Imagine you unexpectedly received $5,000 — what would you do?")
- Keep responses concise (2-3 short paragraphs max)

Avoid:
- Finance jargon
- Long explanations
- Judgmental language
- Taking sides or implying one approach is better

Never provide specific investment, tax, or legal advice.`,

      face_to_face: `You are an AI financial relationship counselor analyzing a couples' face-to-face conversation about money.

The current topic is: "${activityTitle}" — ${activityDescription}

You will receive transcribed responses from both partners. Your role:
- Summarize key themes from each partner's perspective
- Identify areas of alignment and potential differences
- Provide 3-5 shared insights
- Suggest 2-3 concrete next steps the couple can take
- Keep your summary warm, encouraging, and constructive
- Never take sides or give direct financial advice`,
    };

    const systemPrompt = systemPrompts[conversationType] || systemPrompts.solo;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
