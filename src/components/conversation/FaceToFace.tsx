import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mic, Square, ChevronLeft, ChevronRight, Loader2, Sparkles, RotateCcw, Lightbulb } from "lucide-react";
import { AIMessageLabel } from "@/components/conversation/AIMessageLabel";
import AIThinkingBubble from "@/components/conversation/AIThinkingBubble";
import { Button } from "@/components/ui/button";
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
import ReactMarkdown from "react-markdown";
import { useConversationCompletion } from "@/hooks/useConversationCompletion";

interface FaceToFaceProps {
  activityId: string;
  activityTitle: string;
  activityDescription: string;
}

interface Prompt {
  question: string;
  guidance: string;
}

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
}

const FaceToFace = ({ activityId, activityTitle, activityDescription }: FaceToFaceProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isFlipped, setIsFlipped] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [activePartner, setActivePartner] = useState<Partner>("partner_a");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [responses, setResponses] = useState<PromptResponse[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const { markCompleted } = useConversationCompletion(activityId);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");

  const { data: conversation } = useQuery({
    queryKey: ["conversation", activityId, "face_to_face", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data: existing } = await supabase
        .from("conversations")
        .select("*")
        .eq("activity_id", activityId)
        .eq("user_id", user.id)
        .eq("type", "face_to_face")
        .maybeSingle();
      if (existing) return existing;
      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({ activity_id: activityId, user_id: user.id, type: "face_to_face" })
        .select()
        .single();
      if (error) throw error;
      return newConv;
    },
    enabled: !!user,
  });

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
    setSummaryText("");
    queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
    toast.success("Chat restarted");
  }, [conversation, queryClient]);

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
    const newResponse: PromptResponse = {
      promptIndex: currentPrompt,
      partner: activePartner,
      transcript,
    };
    setResponses((prev) => {
      const updated = [...prev, newResponse];
      // Face-to-face completion: each partner recorded at least 1 response
      const hasPartnerA = updated.some(r => r.partner === "partner_a");
      const hasPartnerB = updated.some(r => r.partner === "partner_b");
      if (hasPartnerA && hasPartnerB) {
        markCompleted();
      }
      return updated;
    });
    setRecordingState("idle");
    toast.success(`${activePartner === "partner_a" ? "Partner A" : "Partner B"}'s response recorded!`);
  }, [currentPrompt, activePartner, markCompleted]);

  const hasResponse = (promptIdx: number, partner: Partner) => {
    return responses.some((r) => r.promptIndex === promptIdx && r.partner === partner);
  };

  const getResponse = (promptIdx: number, partner: Partner) => {
    return responses.find((r) => r.promptIndex === promptIdx && r.partner === partner);
  };

  const bothResponded = hasResponse(currentPrompt, "partner_a") && hasResponse(currentPrompt, "partner_b");
  const canGenerateInsights =
    responses.some((r) => r.partner === "partner_a") &&
    responses.some((r) => r.partner === "partner_b");

  const generateSummary = useCallback(async () => {
    if (!conversation || !user) return;
    setIsGeneratingSummary(true);
    setShowSummary(true);
    const formattedResponses = defaultPrompts.map((prompt, i) => {
      const a = getResponse(i, "partner_a");
      const b = getResponse(i, "partner_b");
      return `Question: ${prompt.question}\nPartner A: ${a?.transcript || "(no response)"}\nPartner B: ${b?.transcript || "(no response)"}`;
    }).join("\n\n");
    let fullResponse = "";
    setSummaryText("");
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
      onDelta: (chunk) => {
        fullResponse += chunk;
        setSummaryText(fullResponse);
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
        setIsGeneratingSummary(false);
      },
      onError: (error) => {
        toast.error(error);
        setIsGeneratingSummary(false);
      },
    });
  }, [conversation, user, responses, activityTitle, activityDescription]);
  const handleRecordAgain = useCallback(() => {
    setResponses((prev) => prev.filter((r) => !(r.promptIndex === currentPrompt && r.partner === activePartner)));
  }, [currentPrompt, activePartner]);

  // Split summary into segments for staggered display
  const summarySegments = summaryText
    ? summaryText.split(/\n---\n/).map(s => s.trim()).filter(Boolean)
    : [];
  const prevSegmentCountRef = useRef(0);
  useEffect(() => {
    // Update after render so current render knows which segments are "new"
    prevSegmentCountRef.current = summarySegments.length;
  });

  if (showSummary) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setShowSummary(false)} className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground text-sm">Conversation Summary</h1>
            <p className="text-xs text-muted-foreground">{activityTitle}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {summarySegments.length > 0 ? (
            summarySegments.map((segment, idx) => (
              <div
                key={idx}
                className={idx >= prevSegmentCountRef.current ? "animate-fade-in-message" : ""}
              >
                {idx === 0 && <AIMessageLabel type="insight" />}
                <div className="bg-secondary/50 rounded-2xl p-4">
                <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 text-foreground">
                  <ReactMarkdown>{segment}</ReactMarkdown>
                  {isGeneratingSummary && idx === summarySegments.length - 1 && (
                    <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                  )}
                </div>
                </div>
              </div>
            ))
          ) : (
            <div>
              <AIMessageLabel type="insight" />
              <AIThinkingBubble />
            </div>
          )}
          {!isGeneratingSummary && summarySegments.length > 0 && (
            <Button onClick={() => navigate(-1)} className="w-full rounded-xl mt-4 animate-fade-in-message">
              Done
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(-1)} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-foreground text-sm">{activityTitle}</h1>
          <p className="text-xs text-muted-foreground">Face-to-Face</p>
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
        <span className="text-xs text-muted-foreground font-medium">
          {currentPrompt + 1}/{defaultPrompts.length}
        </span>
      </div>

      {/* Scrollable content area: navigation + flashcard + transcript */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4 flex flex-col items-center">
        {/* Previous / Next navigation — above flashcard */}
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

          {currentPrompt < defaultPrompts.length - 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCurrentPrompt((p) => p + 1); setIsFlipped(false); }}
              className="gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Flippable Flash Card — top aligned */}
        <div
          className="w-full max-w-sm cursor-pointer [perspective:1000px]"
          onClick={() => setIsFlipped((f) => !f)}
        >
          <div className="relative w-full grid">
            <div className="invisible p-8 space-y-4 [grid-area:1/1]">
              <p className="text-xs">&nbsp;</p>
              <h2 className="font-display text-xl font-semibold leading-snug">
                {defaultPrompts[currentPrompt].question}
              </h2>
              <p className="text-xs">&nbsp;</p>
            </div>
            <div className="invisible p-8 space-y-4 [grid-area:1/1]">
              <p className="text-xs">&nbsp;</p>
              <p className="text-sm leading-relaxed">
                {defaultPrompts[currentPrompt].guidance}
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
              <h2 className="font-display text-xl font-semibold text-foreground leading-snug">
                {defaultPrompts[currentPrompt].question}
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
              <p className="text-sm text-foreground leading-relaxed text-left">
                {defaultPrompts[currentPrompt].guidance}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Tap to flip back</p>
            </div>
          </div>
        </div>

        {/* Transcript area */}
        {hasResponse(currentPrompt, activePartner) && (
          <div className="w-full max-w-sm mt-4 bg-secondary/50 rounded-xl p-3 text-left animate-fade-in overflow-y-auto max-h-40">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {activePartner === "partner_a" ? "Partner A" : "Partner B"}'s response
            </p>
            <p className="text-sm text-foreground">
              {getResponse(currentPrompt, activePartner)?.transcript}
            </p>
          </div>
        )}
      </div>

      {/* Fixed bottom controls */}
      <div className="shrink-0 px-6 pb-6 pt-3 space-y-3 bg-background border-t border-border">
        {/* Recording controls */}
        <div className="w-full max-w-sm mx-auto">
          {recordingState === "idle" && (
            <Button
              onClick={hasResponse(currentPrompt, activePartner) ? handleRecordAgain : startRecording}
              size="lg"
              variant={hasResponse(currentPrompt, activePartner) ? "outline" : "default"}
              className="w-full rounded-xl gap-2"
            >
              <Mic className="w-5 h-5" />
              {hasResponse(currentPrompt, activePartner) ? "Record Again" : "Start Recording"}
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
        </div>

        {/* Partner Toggle */}
        <div className="w-full max-w-sm mx-auto relative bg-muted rounded-xl p-1 flex">
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
            Partner A {hasResponse(currentPrompt, "partner_a") && "✓"}
          </button>
          <button
            onClick={() => setActivePartner("partner_b")}
            className={`relative z-10 flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors duration-200 ${
              activePartner === "partner_b" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Partner B {hasResponse(currentPrompt, "partner_b") && "✓"}
          </button>
        </div>

        {/* Get Insights */}
        {canGenerateInsights && (
          <Button
            onClick={generateSummary}
            disabled={isGeneratingSummary}
            className="w-full max-w-sm mx-auto gap-2 rounded-xl"
          >
            <Sparkles className="w-4 h-4" /> Get Insights
          </Button>
        )}
      </div>
    </div>
  );
};

export default FaceToFace;
