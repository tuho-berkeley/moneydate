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

      together: `You are a warm, skilled AI couples financial facilitator guiding two partners through a conversation about money.

The current topic is: "${activityTitle}" — ${activityDescription}

Your approach:
- Facilitate balanced dialogue — make sure both partners share
- Ask one question at a time, directed at either "both of you" or alternating partners
- Acknowledge what each person shares before moving forward
- Highlight areas of agreement and gently explore differences
- Keep responses concise (2-3 paragraphs max)
- Use a warm but professional tone
- After several exchanges, provide a conversation summary with shared insights and suggested next steps
- Never take sides or give direct financial advice`,

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
