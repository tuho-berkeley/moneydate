import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActivities } from "@/hooks/useActivities";
import { ArrowLeft, Send, Loader2, RotateCcw, Sparkles, MessageCircle } from "lucide-react";
import AIThinkingBubble from "@/components/conversation/AIThinkingBubble";
import { AIMessageLabel, getAILabelType, highlightQuestions } from "@/components/conversation/AIMessageLabel";
import TypewriterText from "@/components/conversation/TypewriterText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { passesPreFilter } from "@/lib/isQualityAnswer";
import ReactMarkdown from "react-markdown";
import type { Database } from "@/integrations/supabase/types";
import { useConversationCompletion } from "@/hooks/useConversationCompletion";

type DBMessage = Database["public"]["Tables"]["messages"]["Row"];

interface SoloChatProps {
  activityId: string;
  activityTitle: string;
  activityDescription: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
}

const SoloChat = ({ activityId, activityTitle, activityDescription }: SoloChatProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  const revealQueueRef = useRef<string[]>([]);
  const { markCompleted, markInsightsGenerated, resetCompletion } = useConversationCompletion(activityId);

  // Quality answer tracking
  const qualityCountRef = useRef(0);
  const [completionReached, setCompletionReached] = useState(false);
  const [showClosureButtons, setShowClosureButtons] = useState(false);
  const [continueAnyway, setContinueAnyway] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const closureMessageIdRef = useRef<string | null>(null); // kept for restart cleanup
  const pendingClosureRef = useRef(false);

  // Get or create conversation
  const { data: conversation } = useQuery({
    queryKey: ["conversation", activityId, "solo", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("conversations")
        .select("*")
        .eq("activity_id", activityId)
        .eq("user_id", user.id)
        .eq("type", "solo")
        .maybeSingle();

      if (existing) return existing;

      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({ activity_id: activityId, user_id: user.id, type: "solo" })
        .select()
        .single();

      if (error) throw error;
      return newConv;
    },
    enabled: !!user,
  });

  // Fetch messages
  const { data: dbMessages = [], isSuccess: messagesLoaded } = useQuery({
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

  // Check current activity status
  const { data: activitiesData } = useActivities();
  const currentActivityStatus = activitiesData?.find(a => a.id === activityId)?.userStatus;

  // Seed quality count from existing messages on load
  const qualitySeededRef = useRef(false);
  useEffect(() => {
    if (qualitySeededRef.current || !messagesLoaded || dbMessages.length === 0) return;
    qualitySeededRef.current = true;
    const userMsgs = dbMessages.filter(m => m.role === "user");
    const count = userMsgs.filter(m => passesPreFilter(m.content)).length;
    qualityCountRef.current = count;
    console.log(`[SoloChat] Seeded quality count: ${count} from ${userMsgs.length} user messages`);
    if (count >= 3) {
      setCompletionReached(true);
      markCompleted();
      if (conversation) {
        supabase.from("conversations").update({ completed: true } as any).eq("id", conversation.id);
        queryClient.invalidateQueries({ queryKey: ["completed-conversation-types"] });
      }
      // If insights already generated, show post-insights state
      if (currentActivityStatus === "insights_generated") {
        setShowInsights(true);
      } else {
        setShowClosureButtons(true);
      }
    }
  }, [messagesLoaded, dbMessages, markCompleted, currentActivityStatus]);


  const seedingRef = useRef(false);
  useEffect(() => {
    if (!conversation || !messagesLoaded || seedingRef.current || dbMessages.length > 0) return;
    seedingRef.current = true;

    let fullResponse = "";
    setIsWaitingForAI(true);

    streamChat({
      messages: [],
      activityTitle,
      activityDescription: activityDescription || "",
      conversationType: "solo",
      onDelta: (chunk) => {
        fullResponse += chunk;
      },
      onDone: async () => {
        if (fullResponse) {
          const segments = fullResponse.split(/\n---\n/).map(s => s.trim()).filter(Boolean);
          for (const segment of segments) {
            await supabase.from("messages").insert({
              conversation_id: conversation.id,
              sender_id: null,
              role: "ai",
              content: segment,
            });
          }
          await queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
        }
        setIsWaitingForAI(false);
      },
      onError: (error) => {
        toast.error(error);
        setIsWaitingForAI(false);
        seedingRef.current = false;
      },
    });
  }, [conversation, dbMessages.length, messagesLoaded, activityTitle, activityDescription, queryClient]);

  // Sequential reveal of new AI messages (one at a time, after typewriter completes)
  useEffect(() => {
    const currentIds = new Set(dbMessages.map(m => m.id));

    if (prevMessageIdsRef.current.size === 0 && dbMessages.length > 0 && !seedingRef.current) {
      setRevealedIds(new Set(dbMessages.map(m => m.id)));
      prevMessageIdsRef.current = currentIds;
      return;
    }

    const newAiMsgs = dbMessages.filter(
      m => m.role === "ai" && !prevMessageIdsRef.current.has(m.id) && !revealedIds.has(m.id)
    );

    if (newAiMsgs.length > 0) {
      const newIds = newAiMsgs.map(m => m.id);
      revealQueueRef.current = [...revealQueueRef.current, ...newIds];

      if (revealQueueRef.current.length === newIds.length) {
        const firstId = revealQueueRef.current[0];
        setRevealedIds(prev => new Set([...prev, firstId]));
        setFreshIds(prev => new Set([...prev, firstId]));
      }
    }

    const newUserMsgs = dbMessages.filter(
      m => m.role === "user" && !prevMessageIdsRef.current.has(m.id)
    );
    if (newUserMsgs.length > 0) {
      setFreshIds(prev => {
        const next = new Set(prev);
        newUserMsgs.forEach(m => next.add(m.id));
        return next;
      });
    }

    prevMessageIdsRef.current = currentIds;
  }, [dbMessages]);

  const messages: ChatMessage[] = dbMessages
    .filter(m => m.role !== "ai" || revealedIds.has(m.id))
    .map((m: DBMessage) => ({
      id: m.id,
      role: m.role as "user" | "ai",
      content: m.content,
    }));

  const showThinking = isWaitingForAI;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showThinking, showClosureButtons]);

  useEffect(() => {
    if (textareaRef.current) {
      const el = textareaRef.current;
      // Temporarily set to auto so scrollHeight reflects true content height
      // without collapsing to 0 (which causes scroll jitter)
      el.style.height = "auto";
      const newHeight = Math.min(el.scrollHeight, 120);
      el.style.height = `${newHeight}px`;
      el.style.overflow = newHeight >= 120 ? "auto" : "hidden";
    }
  }, [input]);

  const handleTypewriterComplete = useCallback((msgId: string) => {
    setFreshIds(prev => {
      const next = new Set(prev);
      next.delete(msgId);
      return next;
    });

    // Reveal next segment in queue
    const queue = revealQueueRef.current;
    const idx = queue.indexOf(msgId);
    if (idx >= 0) {
      revealQueueRef.current = queue.slice(idx + 1);
      if (revealQueueRef.current.length > 0) {
        const nextId = revealQueueRef.current[0];
        setTimeout(() => {
          setRevealedIds(prev => new Set([...prev, nextId]));
          setFreshIds(prev => new Set([...prev, nextId]));
        }, 300);
      } else if (pendingClosureRef.current) {
        // Queue empty and closure pending — show buttons after last typewriter finishes
        pendingClosureRef.current = false;
        setTimeout(() => setShowClosureButtons(true), 300);
      }
    } else if (pendingClosureRef.current && revealQueueRef.current.length === 0) {
      pendingClosureRef.current = false;
      setTimeout(() => setShowClosureButtons(true), 300);
    }
  }, []);

  const handleRestart = useCallback(async () => {
    if (!conversation || isSending) return;
    abortRef.current?.abort();
    setIsSending(false);
    setIsWaitingForAI(false);

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversation.id);

    if (error) {
      toast.error("Failed to restart chat");
      return;
    }

    // Clear cache immediately BEFORE resetting refs to prevent re-seeding from stale data
    queryClient.setQueryData(["messages", conversation.id], []);

    seedingRef.current = false;
    qualitySeededRef.current = false;
    qualityCountRef.current = 0;
    setCompletionReached(false);
    setShowClosureButtons(false);
    setContinueAnyway(false);
    setShowInsights(false);
    setIsGeneratingInsights(false);
    closureMessageIdRef.current = null;
    pendingClosureRef.current = false;
    setRevealedIds(new Set());
    setFreshIds(new Set());
    prevMessageIdsRef.current = new Set();
    await resetCompletion();
    queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
    toast.success("Chat restarted");
  }, [conversation, isSending, queryClient, resetCompletion]);


  // Trigger pre-closure AI message
  const triggerPreClosure = useCallback(async (latestUserText?: string) => {
    if (!conversation) return;
    setIsWaitingForAI(true);

    const historyForAI = dbMessages.map((m: DBMessage) => ({
      role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));

    // Include latest user message if not yet in dbMessages
    if (latestUserText) {
      historyForAI.push({ role: "user", content: latestUserText });
    }

    let fullResponse = "";
    await streamChat({
      messages: historyForAI,
      activityTitle,
      activityDescription: activityDescription || "",
      conversationType: "pre_closure",
      onDelta: (chunk) => { fullResponse += chunk; },
      onDone: async () => {
        if (fullResponse && conversation) {
          // Strip any sentences ending with "?" as a safety net
          fullResponse = fullResponse.replace(/[^.!?\n]*\?/g, "").trim();
          if (!fullResponse) fullResponse = "Thank you for sharing so openly. 💛";

          const segments = fullResponse.split(/\n---\n/).map(s => s.trim()).filter(Boolean);
          for (const segment of segments) {
            await supabase.from("messages").insert({
              conversation_id: conversation.id,
              sender_id: null,
              role: "ai",
              content: segment,
            });
          }
          await queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
        }
        setIsWaitingForAI(false);
        // Defer closure buttons until typewriter animation finishes
        pendingClosureRef.current = true;
      },
      onError: (error) => {
        toast.error(error);
        setIsWaitingForAI(false);
        setShowClosureButtons(true);
      },
    });
  }, [conversation, dbMessages, activityTitle, activityDescription, queryClient]);

  // Generate insights
  const handleGenerateInsights = useCallback(async () => {
    if (!conversation) return;
    setShowClosureButtons(false);
    setShowInsights(true);
    setIsGeneratingInsights(true);
    setIsWaitingForAI(true);

    // Filter out pre-closure/insight messages — only include the actual conversation
    const lastUserMsgIdx = dbMessages.reduce((acc, m, i) => (m.role === "user" ? i : acc), -1);
    const conversationMessages = dbMessages.filter((m, i) => {
      if (m.role !== "ai") return true;
      return i <= lastUserMsgIdx;
    });

    const historyForAI = conversationMessages.map((m: DBMessage) => ({
      role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));

    let fullResponse = "";
    await streamChat({
      messages: historyForAI,
      activityTitle,
      activityDescription: activityDescription || "",
      conversationType: "solo_insights",
      onDelta: (chunk) => { fullResponse += chunk; },
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
          await queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
        }
        markInsightsGenerated();
        setIsWaitingForAI(false);
        setIsGeneratingInsights(false);
      },
      onError: (error) => {
        toast.error(error);
        setIsWaitingForAI(false);
        setIsGeneratingInsights(false);
      },
    });
  }, [conversation, dbMessages, activityTitle, activityDescription, queryClient]);

  // Continue conversation
  const handleContinueConversation = useCallback(() => {
    setShowClosureButtons(false);
    setCompletionReached(false);
    setContinueAnyway(true);
    setShowInsights(false);
    setIsGeneratingInsights(false);
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending || !conversation || !user) return;

    const userText = input.trim();
    setInput("");
    setIsSending(true);

    // Save user message
    const { error: insertErr } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      role: "user",
      content: userText,
    });

    if (insertErr) {
      toast.error("Failed to send message");
      setIsSending(false);
      return;
    }

    // Refetch to show user message immediately
    await queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });

    // Use passesPreFilter for immediate quality counting (same as seed logic)
    // This ensures consistency between live and reload counts
    if (passesPreFilter(userText)) {
      qualityCountRef.current += 1;
    }

    const qualityThresholdMet = qualityCountRef.current >= 3 && !continueAnyway;

    if (qualityThresholdMet && !completionReached) {
      // Mark completed and trigger pre-closure
      setCompletionReached(true);
      markCompleted();
      if (conversation) {
        supabase.from("conversations").update({ completed: true } as any).eq("id", conversation.id);
        queryClient.invalidateQueries({ queryKey: ["completed-conversation-types"] });
      }
      setIsSending(false);

      // Trigger pre-closure AI message (no question, just reflection)
      await triggerPreClosure(userText);
      return;
    }

    // Normal AI response
    setIsWaitingForAI(true);

    let fullResponse = "";
    const abort = new AbortController();
    abortRef.current = abort;

    const historyForAI = [
      ...dbMessages.map((m: DBMessage) => ({
        role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userText },
    ];

    try {
      await streamChat({
        messages: historyForAI,
        activityTitle,
        activityDescription: activityDescription || "",
        conversationType: "solo",
        onDelta: (chunk) => {
          fullResponse += chunk;
        },
        onDone: async () => {
          if (fullResponse) {
            const segments = fullResponse.split(/\n---\n/).map(s => s.trim()).filter(Boolean);
            for (const segment of segments) {
              await supabase.from("messages").insert({
                conversation_id: conversation.id,
                sender_id: null,
                role: "ai",
                content: segment,
              });
            }
            await queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
          }
          setIsSending(false);
          setIsWaitingForAI(false);
        },
        onError: (error) => {
          toast.error(error);
          setIsSending(false);
          setIsWaitingForAI(false);
        },
        signal: abort.signal,
      });
    } catch (err) {
      console.error("streamChat error:", err);
      toast.error("Something went wrong. Please try again.");
      setIsSending(false);
      setIsWaitingForAI(false);
    }
  }, [input, isSending, conversation, user, dbMessages, activityTitle, activityDescription, queryClient, markCompleted, completionReached, continueAnyway, triggerPreClosure]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const inputDisabled = (completionReached && !continueAnyway) || showInsights;

  return (
    <div className="h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-foreground text-sm text-pretty">{activityTitle}</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Solo Chat</p>
            {completionReached && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                Completed
              </span>
            )}
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors" disabled={isSending || messages.length === 0}>
              <RotateCcw className="w-4 h-4" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restart conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear all messages and start fresh. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRestart}>Restart</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && showThinking && (
          <AIThinkingBubble />
        )}

        {messages.map((msg, idx) => {
          const isFirstAI = msg.role === "ai" && idx === 0;
          const labelType = msg.role === "ai" ? getAILabelType(msg.content, isFirstAI) : null;
          const displayContent = labelType === "question" ? highlightQuestions(msg.content) : msg.content;
          const isFresh = freshIds.has(msg.id);

          return (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} ${
                isFresh && msg.role === "ai" ? "animate-message-appear" : ""
              }`}
              style={isFresh && msg.role === "ai" ? { opacity: 0 } : undefined}
            >
              <div className={msg.role === "ai" ? "max-w-[90%]" : "max-w-[85%]"}>
                {msg.role === "ai" && labelType && <AIMessageLabel type={labelType} />}
                <div
                  className={`rounded-2xl p-4 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-foreground"
                  }`}
                >
                  {msg.role === "ai" ? (
                    isFresh ? (
                      <TypewriterText
                        content={displayContent}
                        onComplete={() => handleTypewriterComplete(msg.id)}
                      />
                    ) : (
                      <div className="text-sm prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-2 prose-ul:pl-4 prose-li:my-1 prose-li:leading-relaxed prose-strong:font-semibold">
                        <ReactMarkdown>{displayContent}</ReactMarkdown>
                      </div>
                    )
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {showThinking && messages.length > 0 && <AIThinkingBubble />}

        {/* Closure buttons — shown after pre-closure message typewriter completes */}
        {showClosureButtons && !showInsights && (
          <div className="flex flex-col gap-2 max-w-[85%] mx-auto animate-fade-in">
            <Button
              onClick={handleGenerateInsights}
              className="w-full rounded-xl gap-2"
              disabled={isGeneratingInsights}
            >
              <Sparkles className="w-4 h-4" />
              Get Insights
            </Button>
            <Button
              onClick={handleContinueConversation}
              variant="outline"
              className="w-full rounded-xl gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Continue Conversation
            </Button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input — with floating Generate Insights button when continuing after completion */}
      {!inputDisabled && (
        <div className="bg-card border-t border-border sticky bottom-0">
          {continueAnyway && !showInsights && (
            <div className="px-4 pt-3">
              <Button
                onClick={handleGenerateInsights}
                variant="secondary"
                className="w-full rounded-xl gap-2"
                disabled={isGeneratingInsights || isSending}
              >
                <Sparkles className="w-4 h-4" />
                Get Insights
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2 p-4 pt-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share your thoughts..."
              className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-border py-[0.625rem]"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              size="icon"
              className="h-11 w-11 rounded-xl flex-shrink-0"
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      )}

      {/* Show "done" footer when insights are shown and all messages revealed */}
      {showInsights && !isGeneratingInsights && !isWaitingForAI && (
        <div className="bg-card border-t border-border p-4 sticky bottom-0 flex gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="flex-1 rounded-xl gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start over?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear all messages and start fresh. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRestart}>Start Over</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            onClick={handleContinueConversation}
            className="flex-1 rounded-xl gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Continue Conversation
          </Button>
        </div>
      )}
    </div>
  );
};

export default SoloChat;
