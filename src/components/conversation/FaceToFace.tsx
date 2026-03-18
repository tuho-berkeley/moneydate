import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mic, Square, ChevronLeft, ChevronRight, Loader2, Sparkles, RotateCcw, Lightbulb, Plus, Trash2 } from "lucide-react";
import { AIMessageLabel } from "@/components/conversation/AIMessageLabel";
import AIThinkingBubble from "@/components/conversation/AIThinkingBubble";
import TypewriterText from "@/components/conversation/TypewriterText";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { streamChat } from "@/lib/streamChat";
import { isQualityAnswer, passesPreFilter } from "@/lib/isQualityAnswer";
import ReactMarkdown from "react-markdown";
import { useConversationCompletion } from "@/hooks/useConversationCompletion";

interface FaceToFaceProps {
  activityId: string;
  activityTitle: string;
  activityDescription: string;
  activityOutcome?: string;
}

interface Prompt {
  question: string;
  guidance: string;
}

/** Convert inline bullet chars (•, ‣, ⁃) into markdown list items with line breaks */
const normalizeBullets = (text: string): string =>
  text.replace(/(?:^|\s)[•‣⁃]\s*/gm, '\n- ');

const defaultPrompts: Prompt[] = [
  {
    question: "How did your family usually talk about money when you were growing up?",
    guidance: "Think about everyday moments at home. Was money openly discussed, or rarely mentioned? Did your family treat money as something stressful, practical, or normal? What tone do you remember around money conversations? Take about 1–2 minutes each to share.",
  },
  {
    question: "What is one memory about money from your childhood that stands out?",
    guidance: "It could be something your parents said about money, a time when money caused stress or celebration, or a lesson you remember hearing often. Try to describe what happened and how it made you feel.",
  },
  {
    question: "What money lesson did you learn from your family?",
    guidance: "Examples might include: \"Always save for a rainy day,\" \"Money should be enjoyed,\" or \"Debt should be avoided.\" Think about whether this lesson still influences how you make decisions today.",
  },
  {
    question: "Do you think your childhood experiences shaped how you think about money now?",
    guidance: "You might reflect on: Do you feel cautious with money? Do you value financial security more than freedom? Are there habits you notice repeating from your family? Share anything that feels meaningful to you.",
  },
  {
    question: "What would you like your future relationship with money to look like together?",
    guidance: "Instead of focusing on numbers, think about feelings and values. For example: feeling financially secure, enjoying experiences together, supporting each other's goals, or building a stable future. Describe the kind of financial life you hope to create as a couple.",
  },
];

type RecordingState = "idle" | "recording" | "transcribing";
type Partner = "partner_a" | "partner_b";

interface PromptResponse {
  promptIndex: number;
  partner: Partner;
  transcript: string;
  quality: boolean;
  messageId?: string;
}

const FaceToFace = ({ activityId, activityTitle, activityDescription, activityOutcome }: FaceToFaceProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get user profile for couple_id
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Get partner profile
  const { data: partnerProfile } = useQuery({
    queryKey: ["partner-profile", profile?.couple_id],
    queryFn: async () => {
      if (!profile?.couple_id || !user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("couple_id", profile.couple_id)
        .neq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.couple_id && !!user,
  });

  // Get or create conversation linked to couple
  const { data: conversation } = useQuery({
    queryKey: ["conversation", activityId, "face_to_face", profile?.couple_id],
    queryFn: async () => {
      if (!user || !profile?.couple_id) throw new Error("Missing data");

      const { data: existing } = await supabase
        .from("conversations")
        .select("*")
        .eq("activity_id", activityId)
        .eq("couple_id", profile.couple_id)
        .eq("type", "face_to_face")
        .maybeSingle();

      if (existing) return existing;

      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({
          activity_id: activityId,
          user_id: user.id,
          couple_id: profile.couple_id,
          type: "face_to_face",
        })
        .select()
        .single();

      if (error) throw error;
      return newConv;
    },
    enabled: !!user && !!profile?.couple_id,
  });

  // Load all saved messages on mount
  const { data: savedMessages = [], isSuccess: messagesLoaded } = useQuery({
    queryKey: ["messages", conversation?.id],
    queryFn: async () => {
      if (!conversation) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!conversation,
  });

  // Realtime subscription for messages (partner sync)
  useEffect(() => {
    if (!conversation) return;
    const channel = supabase
      .channel(`f2f-messages-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation?.id, queryClient]);

  // ─── 1) PROMPT PERSISTENCE: DB-first, race-safe ───────────────────────

  // Find the canonical (oldest) saved prompts message from DB
  const savedPromptsMessage = useMemo(() => {
    const promptMsgs = savedMessages.filter(m => {
      if (m.role !== "ai") return false;
      try {
        const parsed = JSON.parse(m.content);
        return parsed.type === "prompts" && Array.isArray(parsed.data);
      } catch { return false; }
    });
    // Return oldest (first by created_at since messages are ordered asc)
    return promptMsgs.length > 0 ? promptMsgs[0] : null;
  }, [savedMessages]);

  const savedPrompts: Prompt[] | null = useMemo(() => {
    if (!savedPromptsMessage) return null;
    try { return JSON.parse(savedPromptsMessage.content).data; } catch { return null; }
  }, [savedPromptsMessage]);

  // Gate prompt generation behind messagesLoaded (not just conversation existing)
  const { data: prompts = defaultPrompts, isLoading: isLoadingPrompts } = useQuery({
    queryKey: ["face-to-face-prompts", activityId, conversation?.id],
    queryFn: async () => {
      // Use saved prompts from DB if they exist
      if (savedPrompts) return savedPrompts;

      const resp = await supabase.functions.invoke("chat", {
        body: {
          messages: [],
          activityTitle,
          activityDescription,
          activityOutcome,
          conversationType: "generate_prompts",
        },
      });
      if (resp.error) throw resp.error;
      const data = resp.data as Prompt[];
      if (Array.isArray(data) && data.length === 5 && data[0]?.question && data[0]?.guidance) {
        // Race-condition check: re-query DB for existing prompts before inserting
        if (conversation) {
          const { data: existingMsgs } = await supabase
            .from("messages")
            .select("content")
            .eq("conversation_id", conversation.id)
            .eq("role", "ai")
            .order("created_at", { ascending: true });

          const alreadySaved = existingMsgs?.some(m => {
            try {
              const p = JSON.parse(m.content);
              return p.type === "prompts" && Array.isArray(p.data);
            } catch { return false; }
          });

          if (!alreadySaved) {
            await supabase.from("messages").insert({
              conversation_id: conversation.id,
              sender_id: null,
              role: "ai",
              content: JSON.stringify({ type: "prompts", data }),
            });
            queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
          } else {
            // Another device already saved prompts — use those instead
            const canonical = existingMsgs?.find(m => {
              try {
                const p = JSON.parse(m.content);
                return p.type === "prompts" && Array.isArray(p.data);
              } catch { return false; }
            });
            if (canonical) {
              try { return JSON.parse(canonical.content).data; } catch { /* fall through */ }
            }
          }
        }
        return data;
      }
      return defaultPrompts;
    },
    staleTime: Infinity,
    retry: 1,
    // KEY FIX: Only run when messages have loaded so we can check for saved prompts first
    enabled: !!conversation && messagesLoaded,
  });

  const [extraPrompts, setExtraPrompts] = useState<Prompt[]>([]);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);

  // Load extra prompts from saved messages (always sync to pick up partner-generated prompts)
  useEffect(() => {
    if (savedMessages.length === 0) return;
    const extras: Prompt[] = [];
    for (const msg of savedMessages) {
      if (msg.role !== "ai") continue;
      try {
        const parsed = JSON.parse(msg.content);
        if (parsed.type === "extra_prompt" && parsed.data?.question) {
          extras.push(parsed.data);
        }
      } catch { /* skip */ }
    }
    // Always update to stay in sync with DB (handles partner adding new prompts)
    setExtraPrompts(extras);
  }, [savedMessages]);

  const allPrompts = [...prompts, ...extraPrompts];

  const generateOneMore = useCallback(async () => {
    setIsGeneratingMore(true);
    try {
      const currentAll = [...prompts, ...extraPrompts];
      const resp = await supabase.functions.invoke("chat", {
        body: {
          messages: [],
          activityTitle,
          activityDescription,
          conversationType: "generate_one_prompt",
          existingQuestions: currentAll.map(p => p.question),
        },
      });
      if (resp.error) throw resp.error;
      const data = resp.data as Prompt;
      if (data?.question && data?.guidance) {
        if (conversation) {
          await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_id: null,
            role: "ai",
            content: JSON.stringify({ type: "extra_prompt", data }),
          });
        }
        setExtraPrompts(prev => [...prev, data]);
        setCurrentPrompt(currentAll.length);
        setIsFlipped(false);
      } else {
        toast.error("Couldn't generate a new question. Try again.");
      }
    } catch {
      toast.error("Failed to generate question. Please try again.");
    } finally {
      setIsGeneratingMore(false);
    }
  }, [prompts, extraPrompts, activityTitle, activityDescription, conversation]);

  const [isFlipped, setIsFlipped] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [activePartner, setActivePartner] = useState<Partner>("partner_a");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [responses, setResponses] = useState<PromptResponse[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const { markCompleted, markInsightsGenerated, resetCompletion } = useConversationCompletion(activityId);
  const completionTriggeredRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");

  // ─── 2) RESTORE RESPONSES WITH QUALITY FIELD ──────────────────────────

  const hadMessagesRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    // Track whether we ever had messages
    if (savedMessages.length > 0) {
      hadMessagesRef.current = true;
    }

    // Detect partner-side restart: messages went from non-empty to empty
    if (savedMessages.length === 0 && hadMessagesRef.current && messagesLoaded) {
      hadMessagesRef.current = false;
      setResponses([]);
      setCurrentPrompt(0);
      setIsFlipped(false);
      setShowSummary(false);
      setSummaryText(null);
      setRevealedSegments(new Set());
      setFreshSegments(new Set());
      setExtraPrompts([]);
      completionTriggeredRef.current = false;
      queryClient.removeQueries({ queryKey: ["face-to-face-prompts", activityId, conversation?.id] });
      return;
    }

    if (savedMessages.length === 0) return;

    const restored: PromptResponse[] = [];
    for (const msg of savedMessages) {
      if (msg.role === "user" || msg.role === "partner") {
        try {
          const parsed = JSON.parse(msg.content);
          if (typeof parsed.promptIndex === "number" && parsed.transcript) {
            // Determine perspective: "self" means the recorder's own answer,
            // "partner" means recorded on behalf of the other person.
            // If sender is me + for=self → You tab (partner_a)
            // If sender is me + for=partner → Your Partner tab (partner_b)
            // If sender is not me + for=self → Your Partner tab (partner_b)
            // If sender is not me + for=partner → You tab (partner_a)
            // Backward compat: old messages without "for" field use role-based logic
            const senderIsMe = msg.sender_id === user?.id;
            const recordedFor = parsed.for as string | undefined;
            let partner: Partner;
            if (recordedFor) {
              const isForMe = (senderIsMe && recordedFor === "self") || (!senderIsMe && recordedFor === "partner");
              partner = isForMe ? "partner_a" : "partner_b";
            } else {
              // Legacy: fall back to role-based assignment
              partner = msg.role === "partner" ? "partner_b" : (senderIsMe ? "partner_a" : "partner_b");
            }
            const quality = typeof parsed.quality === "boolean"
              ? parsed.quality
              : passesPreFilter(parsed.transcript);
            restored.push({
              promptIndex: parsed.promptIndex,
              partner,
              transcript: parsed.transcript,
              quality,
              messageId: msg.id,
            });
          }
        } catch { /* skip */ }
      }
    }
    setResponses(restored);
  }, [savedMessages, user?.id, messagesLoaded]);

  // ─── 3) DETERMINISTIC COMPLETION LOGIC ────────────────────────────────

  // Derive completion state from responses
  const isCompleted = useMemo(() => {
    const partnerAQuestions = new Set(responses.filter(r => r.partner === "partner_a").map(r => r.promptIndex));
    const partnerBQuestions = new Set(responses.filter(r => r.partner === "partner_b").map(r => r.promptIndex));
    return partnerAQuestions.size >= 2 && partnerBQuestions.size >= 2;
  }, [responses]);

  // Trigger markCompleted when threshold reached, revert when it drops below
  useEffect(() => {
    if (isCompleted && !completionTriggeredRef.current) {
      completionTriggeredRef.current = true;
      markCompleted();
      if (conversation) {
        (async () => {
          await supabase.from("conversations").update({ completed: true } as any).eq("id", conversation.id);
          queryClient.invalidateQueries({ queryKey: ["completed-conversation-types"] });
        })();
      }
    } else if (!isCompleted && completionTriggeredRef.current) {
      // User deleted a quality answer — revert status back to in_progress
      completionTriggeredRef.current = false;
      (async () => {
        if (conversation) {
          await supabase.from("conversations").update({ completed: false } as any).eq("id", conversation.id);
        }
        if (user) {
          await supabase
            .from("user_activities")
            .upsert(
              {
                user_id: user.id,
                activity_id: activityId,
                status: "in_progress" as any,
              },
              { onConflict: "user_id,activity_id" }
            );
          queryClient.invalidateQueries({ queryKey: ["stages-with-activities"] });
          queryClient.invalidateQueries({ queryKey: ["activities"] });
          queryClient.invalidateQueries({ queryKey: ["completed-conversation-types"] });
          queryClient.invalidateQueries({ queryKey: ["activity-status"] });
        }
      })();
    }
  }, [isCompleted, markCompleted, user, activityId, queryClient, conversation]);

  // Gate insights button: both partners must have at least one response
  const canGenerateInsights = isCompleted;

  // If returning to a completed conversation, show the saved summary
  useEffect(() => {
    const aiMessages = savedMessages.filter(m => {
      if (m.role !== "ai") return false;
      try {
        const parsed = JSON.parse(m.content);
        return parsed.type !== "prompts" && parsed.type !== "extra_prompt";
      } catch {
        return true;
      }
    });
    if (aiMessages.length > 0 && !showSummary && !isGeneratingSummary && !summaryText) {
      const combined = aiMessages.map(m => m.content).join("\n---\n");
      setSummaryText(combined);
      setShowSummary(true);
      const segments = combined.split(/\n---\n/).map(s => s.trim()).filter(Boolean);
      setRevealedSegments(new Set(segments.map((_, i) => i)));
    }
  }, [savedMessages]);

  const handleRestart = useCallback(async () => {
    if (!conversation) return;
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversation.id);
    if (error) {
      toast.error("Failed to restart chat");
      return;
    }
    setResponses([]);
    setCurrentPrompt(0);
    setIsFlipped(false);
    setShowSummary(false);
    setSummaryText(null);
    setRevealedSegments(new Set());
    setFreshSegments(new Set());
    setExtraPrompts([]);
    completionTriggeredRef.current = false;
    await resetCompletion();
    if (conversation) {
      await supabase.from("conversations").update({ completed: false } as any).eq("id", conversation.id);
    }
    queryClient.removeQueries({ queryKey: ["face-to-face-prompts", activityId, conversation.id] });
    queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
    queryClient.invalidateQueries({ queryKey: ["completed-conversation-types"] });
    toast.success("Chat restarted");
  }, [conversation, queryClient, resetCompletion, activityId]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        transcriptRef.current = "";
        recognition.onresult = (event: any) => {
          let finalTranscript = "";
          for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + " ";
            }
          }
          if (finalTranscript) {
            transcriptRef.current = finalTranscript.trim();
          }
        };
        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
        };
        recognitionRef.current = recognition;
        recognition.start();
      }
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setRecordingState("recording");
    } catch (err) {
      toast.error("Could not access microphone. Please check permissions.");
    }
  }, []);

  // ─── 2) STOP RECORDING: ALWAYS SAVE, TAG QUALITY ─────────────────────

  const stopRecording = useCallback(async () => {
    setRecordingState("transcribing");
    if (recognitionRef.current) recognitionRef.current.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    await new Promise((r) => setTimeout(r, 500));
    const transcript = transcriptRef.current;
    if (!transcript) {
      toast.error("No speech detected. Please try again and speak clearly.");
      setRecordingState("idle");
      return;
    }

    const currentQuestion = allPrompts[currentPrompt].question;
    const quality = await isQualityAnswer(currentQuestion, transcript);

    // Always save to DB regardless of quality
    let messageId: string | undefined;
    if (conversation) {
      const recordedFor = activePartner === "partner_a" ? "self" : "partner";
      const { data: inserted } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: user?.id || null,
        role: "user" as any,
        content: JSON.stringify({ promptIndex: currentPrompt, transcript, quality, for: recordedFor }),
      }).select("id").single();
      messageId = inserted?.id;
    }

    const newResponse: PromptResponse = {
      promptIndex: currentPrompt,
      partner: activePartner,
      transcript,
      quality,
      messageId,
    };

    setResponses((prev) => [...prev, newResponse]);
    setRecordingState("idle");

    if (quality) {
      toast.success(`${activePartner === "partner_a" ? "Your" : "Your Partner's"} response recorded!`);
    } else {
      toast.info("Response saved. Try adding more detail for better insights.");
    }
  }, [currentPrompt, activePartner, conversation, user, allPrompts, partnerProfile]);

  // Get all responses for a (promptIdx, partner)
  const getResponses = (promptIdx: number, partner: Partner) => {
    return responses.filter((r) => r.promptIndex === promptIdx && r.partner === partner);
  };

  const hasResponse = (promptIdx: number, partner: Partner) => {
    return getResponses(promptIdx, partner).length > 0;
  };

  // Combined text for a (promptIdx, partner) — quality only for insights
  const getCombinedQualityResponse = (promptIdx: number, partner: Partner) => {
    return getResponses(promptIdx, partner)
      .filter(r => r.quality)
      .map(r => r.transcript)
      .join(" ");
  };

  const deleteResponse = useCallback(async (response: PromptResponse) => {
    if (response.messageId) {
      await supabase.from("messages").delete().eq("id", response.messageId);
    }
    setResponses(prev => prev.filter(r => r !== response));
  }, []);

  // ─── 4) INSIGHTS: QUALITY-ONLY INPUT ──────────────────────────────────

  const generateSummary = useCallback(async () => {
    if (!conversation || !user) return;
    setIsGeneratingSummary(true);
    setShowSummary(true);
    setSummaryText(null);

    // Build formatted responses using only quality transcripts
    const formattedResponses = allPrompts.map((prompt, i) => {
      const myName = profile?.display_name || "Partner A";
      const theirName = partnerProfile?.display_name || "Partner B";
      const a = getCombinedQualityResponse(i, "partner_a");
      const b = getCombinedQualityResponse(i, "partner_b");
      return `Question: ${prompt.question}\n${myName}: ${a || "(no quality response)"}\n${theirName}: ${b || "(no quality response)"}`;

    }).join("\n\n");

    let fullResponse = "";
    await streamChat({
      messages: [
        {
          role: "user",
          content: `Here are our face-to-face conversation responses:\n\n${formattedResponses}\n\nPlease provide a conversation summary with shared insights and suggested next steps.`,
        },
      ],
      activityTitle,
      activityDescription: activityDescription || "",
      conversationType: "face_to_face",
      userName: profile?.display_name,
      partnerName: partnerProfile?.display_name,
      onDelta: (chunk) => {
        fullResponse += chunk;
      },
      onDone: async () => {
        if (fullResponse && conversation) {
          const segments = fullResponse.split(/\n---\n/).map(s => s.trim()).filter(Boolean);
          for (const segment of segments) {
            await supabase.from("messages").insert({
              conversation_id: conversation.id,
              sender_id: null,
              role: "ai",
              content: segment,
            });
          }
        }
        setSummaryText(fullResponse);
        setIsGeneratingSummary(false);
        // Mark insights generated for activity progress
        markInsightsGenerated();
      },
      onError: (error) => {
        toast.error(error);
        setIsGeneratingSummary(false);
      },
    });
  }, [conversation, user, responses, activityTitle, activityDescription, allPrompts, markInsightsGenerated]);

  // Split summary into segments for staggered display
  const summarySegments = summaryText
    ? summaryText.split(/\n---\n/).map(s => s.trim()).filter(Boolean)
    : [];

  const [revealedSegments, setRevealedSegments] = useState<Set<number>>(new Set());
  const [freshSegments, setFreshSegments] = useState<Set<number>>(new Set());

  const revealQueueRef = useRef<number[]>([]);

  useEffect(() => {
    if (isGeneratingSummary || summarySegments.length === 0) return;
    const unrevealed = summarySegments
      .map((_, idx) => idx)
      .filter(idx => !revealedSegments.has(idx));
    if (unrevealed.length === 0) return;

    revealQueueRef.current = unrevealed;
    const firstIdx = revealQueueRef.current[0];
    setRevealedSegments(prev => new Set([...prev, firstIdx]));
    setFreshSegments(prev => new Set([...prev, firstIdx]));
  }, [isGeneratingSummary, summarySegments.length]);

  const handleSegmentTypewriterComplete = useCallback((idx: number) => {
    setFreshSegments(prev => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });

    const queue = revealQueueRef.current;
    const pos = queue.indexOf(idx);
    if (pos >= 0) {
      revealQueueRef.current = queue.slice(pos + 1);
      if (revealQueueRef.current.length > 0) {
        const nextIdx = revealQueueRef.current[0];
        setTimeout(() => {
          setRevealedSegments(prev => new Set([...prev, nextIdx]));
          setFreshSegments(prev => new Set([...prev, nextIdx]));
        }, 300);
      }
    }
  }, []);

  if (showSummary) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col">
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")} className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground text-sm">Conversation Summary</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{activityTitle}</p>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                Completed
              </span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isGeneratingSummary ? (
            <div>
              <AIMessageLabel type="insight" />
              <AIThinkingBubble />
            </div>
          ) : summarySegments.length > 0 ? (
            summarySegments.filter((_, idx) => revealedSegments.has(idx)).map((segment, idx) => {
              const isFresh = freshSegments.has(idx);
              return (
                <div
                  key={idx}
                  className={isFresh ? "animate-message-appear" : ""}
                  style={isFresh ? { opacity: 0 } : undefined}
                >
                  {idx === 0 && <AIMessageLabel type="insight" />}
                  <div className="bg-secondary/50 rounded-2xl p-4">
                    {isFresh ? (
                      <TypewriterText
                        content={normalizeBullets(segment)}
                        onComplete={() => handleSegmentTypewriterComplete(idx)}
                      />
                    ) : (
                      <div className="text-sm prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-2 prose-ul:pl-4 prose-li:my-1 prose-li:leading-relaxed prose-strong:font-semibold prose-strong:text-foreground text-foreground">
                        <ReactMarkdown>{normalizeBullets(segment)}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : null}
          {!isGeneratingSummary && summarySegments.length > 0 && revealedSegments.size >= summarySegments.length && !freshSegments.size && (
            <div className="space-y-3 mt-4">
              <Button onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")} className="w-full rounded-xl">
                Complete
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full rounded-xl gap-2">
                    <RotateCcw className="w-4 h-4" /> Start Over
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Start over?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear the summary and all recorded responses. You'll start fresh with the first question.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRestart}>Start Over</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>
    );
  }

  const loadingPrompts = isLoadingPrompts;
  const currentResponses = getResponses(currentPrompt, activePartner);
  const bothResponded = hasResponse(currentPrompt, "partner_a") && hasResponse(currentPrompt, "partner_b");

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-foreground text-sm text-pretty">{activityTitle}</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Face-to-Face</p>
            {isCompleted && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                Completed
              </span>
            )}
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <RotateCcw className="w-4 h-4" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restart conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear all responses and start fresh. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRestart}>Restart</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {!loadingPrompts && (
          <span className="text-xs text-muted-foreground font-medium">
            {currentPrompt + 1}/{allPrompts.length}
          </span>
        )}
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4 flex flex-col items-center">
        {loadingPrompts ? (
          <div className="w-full max-w-sm flex flex-col items-center justify-center flex-1 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Preparing questions...</p>
          </div>
        ) : (
          <>
            {/* Previous / Next navigation */}
            <div className="flex items-center justify-between w-full max-w-sm mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCurrentPrompt((p) => Math.max(0, p - 1)); setIsFlipped(false); }}
                disabled={currentPrompt === 0}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>

              <div className="flex items-center gap-1">
                {currentPrompt < allPrompts.length - 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setCurrentPrompt((p) => p + 1); setIsFlipped(false); }}
                    className="gap-1"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
                {currentPrompt === allPrompts.length - 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateOneMore}
                    disabled={isGeneratingMore}
                    className="gap-1"
                  >
                    {isGeneratingMore ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</>
                    ) : (
                      <><Plus className="w-3.5 h-3.5" /> More</>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Flippable Flash Card */}
            <div
              className="w-full max-w-sm cursor-pointer [perspective:1000px]"
              onClick={() => setIsFlipped((f) => !f)}
            >
              <div className="relative w-full grid">
                <div className="invisible p-8 space-y-4 [grid-area:1/1]">
                  <p className="text-xs">&nbsp;</p>
                  <h2 className="font-display text-xl font-semibold leading-snug text-pretty">
                    {allPrompts[currentPrompt].question}
                  </h2>
                  <p className="text-xs">&nbsp;</p>
                </div>
                <div className="invisible p-8 space-y-4 [grid-area:1/1]">
                  <p className="text-xs">&nbsp;</p>
                  <p className="text-sm leading-relaxed text-pretty">
                    {allPrompts[currentPrompt].guidance}
                  </p>
                  <p className="text-xs">&nbsp;</p>
                </div>
              </div>

              <div
                className="absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d]"
                style={{ transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                <div className="absolute inset-0 bg-card rounded-3xl border border-border shadow-soft p-8 w-full text-center flex flex-col items-center justify-center space-y-4 [backface-visibility:hidden]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Discuss Together
                  </p>
                  <h2 className="font-display text-xl font-semibold text-foreground leading-snug text-pretty">
                    {allPrompts[currentPrompt].question}
                  </h2>
                  <button
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-medium mt-2"
                    onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    Tap for hint
                  </button>
                </div>

                <div className="absolute inset-0 bg-accent/40 rounded-3xl border border-accent shadow-soft p-8 w-full text-center flex flex-col items-center justify-center space-y-4 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Hint
                  </div>
                  <p className="text-sm text-foreground leading-relaxed text-left text-pretty">
                    {allPrompts[currentPrompt].guidance}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Tap to flip back</p>
                </div>
              </div>
            </div>

            {/* ─── 2) RESPONSES LIST WITH QUALITY BADGES ─────────────── */}
            {currentResponses.length > 0 && (
              <div className="w-full max-w-sm mt-4 space-y-2 min-h-0 flex-1 flex flex-col">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {activePartner === "partner_a" ? "Your" : `${partnerProfile?.display_name || "Your Partner"}'s`} responses ({currentResponses.length})
                </p>
                <div className="space-y-2 overflow-y-auto min-h-0 flex-1">
                  {currentResponses.map((response, idx) => (
                    <div
                      key={response.messageId || idx}
                      className="bg-secondary/50 rounded-xl p-3 flex items-start gap-2 animate-fade-in"
                    >
                      <div className="flex-1 space-y-1">
                        <p className="text-sm text-foreground">{response.transcript}</p>
                        {!response.quality && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Lightbulb className="w-3 h-3" />
                            Say a bit more...
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteResponse(response)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </>
        )}
      </div>

      {/* Get Insights — above the recording area */}
      {canGenerateInsights && (
        <div className="shrink-0 px-6 pt-3 pb-3">
          <div className="w-full max-w-sm mx-auto">
            <Button
              onClick={generateSummary}
              disabled={isGeneratingSummary}
              variant="secondary"
              className="w-full gap-2 rounded-xl"
            >
              <Sparkles className="w-4 h-4" /> Get Insights
            </Button>
          </div>
        </div>
      )}

      {/* Fixed bottom controls */}
      <div className="shrink-0 px-6 pb-6 pt-3 bg-background border-t border-border">
        <div className="w-full max-w-sm mx-auto space-y-3">
          {/* Recording controls */}
          {recordingState === "idle" && (
            <Button
              onClick={startRecording}
              size="lg"
              className="w-full rounded-xl gap-2"
            >
              <Mic className="w-5 h-5" />
              {currentResponses.length > 0 ? "Continue Recording" : "Record"}
            </Button>
          )}
          {recordingState === "recording" && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                <span className="text-sm text-destructive font-medium">Recording...</span>
              </div>
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="lg"
                className="w-full rounded-xl gap-2"
              >
                <Square className="w-4 h-4" />
                Stop Recording
              </Button>
            </div>
          )}
          {recordingState === "transcribing" && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Transcribing...</span>
            </div>
          )}

          {/* Partner Toggle */}
          <div className="relative bg-muted rounded-xl p-1 flex">
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-card rounded-lg shadow-sm border border-border transition-transform duration-300 ease-out"
              style={{ transform: activePartner === "partner_b" ? "translateX(calc(100% + 8px))" : "translateX(0)" }}
            />
            <button
              onClick={() => setActivePartner("partner_a")}
              className={`relative z-10 flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                activePartner === "partner_a" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              You {hasResponse(currentPrompt, "partner_a") && "✓"}
            </button>
            <button
              onClick={() => setActivePartner("partner_b")}
              className={`relative z-10 flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                activePartner === "partner_b" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Your Partner {hasResponse(currentPrompt, "partner_b") && "✓"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceToFace;
