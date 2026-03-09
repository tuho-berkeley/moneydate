import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mic, Square, ChevronLeft, ChevronRight, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { streamChat } from "@/lib/streamChat";
import ReactMarkdown from "react-markdown";

interface FaceToFaceProps {
  activityId: string;
  activityTitle: string;
  activityDescription: string;
}

// Prompt questions based on activity context
const defaultPrompts = [
  "How does this topic make you feel?",
  "What's your earliest memory related to this?",
  "What do you wish your partner understood about your perspective?",
  "What's one thing you'd like to agree on together?",
  "Is there anything you've been wanting to say about this?",
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

  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [activePartner, setActivePartner] = useState<Partner>("partner_a");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [responses, setResponses] = useState<PromptResponse[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");

  // Get or create conversation
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

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use Web Speech API for on-device transcription
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

      // Also record audio as backup
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

    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }

    // Short delay for final transcript
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

    setResponses((prev) => [...prev, newResponse]);
    setRecordingState("idle");

    toast.success(`${activePartner === "partner_a" ? "Partner A" : "Partner B"}'s response recorded!`);
  }, [currentPrompt, activePartner]);

  const hasResponse = (promptIdx: number, partner: Partner) => {
    return responses.some((r) => r.promptIndex === promptIdx && r.partner === partner);
  };

  const getResponse = (promptIdx: number, partner: Partner) => {
    return responses.find((r) => r.promptIndex === promptIdx && r.partner === partner);
  };

  const bothResponded = hasResponse(currentPrompt, "partner_a") && hasResponse(currentPrompt, "partner_b");
  const allPromptsComplete = defaultPrompts.every(
    (_, i) => hasResponse(i, "partner_a") && hasResponse(i, "partner_b")
  );

  const generateSummary = useCallback(async () => {
    if (!conversation || !user) return;
    setIsGeneratingSummary(true);
    setShowSummary(true);

    // Format all responses for AI
    const formattedResponses = defaultPrompts.map((prompt, i) => {
      const a = getResponse(i, "partner_a");
      const b = getResponse(i, "partner_b");
      return `Question: ${prompt}\nPartner A: ${a?.transcript || "(no response)"}\nPartner B: ${b?.transcript || "(no response)"}`;
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
        // Save the summary as an AI message
        if (fullResponse && conversation) {
          await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_id: null,
            role: "ai",
            content: fullResponse,
          });
        }
        setIsGeneratingSummary(false);
      },
      onError: (error) => {
        toast.error(error);
        setIsGeneratingSummary(false);
      },
    });
  }, [conversation, user, responses, activityTitle, activityDescription]);

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

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-accent/30 border border-accent rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
                AI Insights
              </span>
            </div>
            {summaryText ? (
              <div className="text-sm prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 text-foreground">
                <ReactMarkdown>{summaryText}</ReactMarkdown>
                {isGeneratingSummary && (
                  <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating insights...</span>
              </div>
            )}
          </div>

          <Button onClick={() => navigate(-1)} className="w-full rounded-xl mt-4">
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-foreground text-sm">{activityTitle}</h1>
          <p className="text-xs text-muted-foreground">Face-to-Face</p>
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {currentPrompt + 1}/{defaultPrompts.length}
        </span>
      </div>

      {/* Flash Card Prompt */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="bg-card rounded-3xl border border-border shadow-soft p-8 w-full max-w-sm text-center space-y-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Discuss Together
          </p>
          <h2 className="font-display text-xl font-semibold text-foreground leading-snug">
            {defaultPrompts[currentPrompt]}
          </h2>

          {/* Partner tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActivePartner("partner_a")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                activePartner === "partner_a"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              Partner A {hasResponse(currentPrompt, "partner_a") && "✓"}
            </button>
            <button
              onClick={() => setActivePartner("partner_b")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                activePartner === "partner_b"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              Partner B {hasResponse(currentPrompt, "partner_b") && "✓"}
            </button>
          </div>

          {/* Recording controls */}
          {hasResponse(currentPrompt, activePartner) ? (
            <div className="bg-secondary/50 rounded-xl p-3 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {activePartner === "partner_a" ? "Partner A" : "Partner B"}'s response
              </p>
              <p className="text-sm text-foreground">
                {getResponse(currentPrompt, activePartner)?.transcript}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recordingState === "idle" && (
                <Button
                  onClick={startRecording}
                  size="lg"
                  className="w-full rounded-xl gap-2"
                >
                  <Mic className="w-5 h-5" />
                  Start Recording
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
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between w-full max-w-sm mt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPrompt((p) => Math.max(0, p - 1))}
            disabled={currentPrompt === 0}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>

          {currentPrompt < defaultPrompts.length - 1 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPrompt((p) => p + 1)}
              disabled={!bothResponded}
              className="gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={generateSummary}
              disabled={!allPromptsComplete || isGeneratingSummary}
              className="gap-1 rounded-xl"
            >
              <Sparkles className="w-4 h-4" /> Get Insights
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceToFace;
