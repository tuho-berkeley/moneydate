import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, RotateCcw } from "lucide-react";
import AIThinkingBubble from "@/components/conversation/AIThinkingBubble";
import { AIMessageLabel, getAILabelType, highlightQuestions } from "@/components/conversation/AIMessageLabel";
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
  isStreaming?: boolean;
}

const SoloChat = ({ activityId, activityTitle, activityDescription }: SoloChatProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  const { markCompleted } = useConversationCompletion(activityId);

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

  // Seed AI starter message via streaming when conversation has no messages yet
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
        setStreamingMessage(prev => (prev ?? "") + chunk);
      },
      onDone: async () => {
        if (fullResponse) {
          justStreamedRef.current = true;
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
        setStreamingMessage(null);
        setIsWaitingForAI(false);
      },
      onError: (error) => {
        toast.error(error);
        setStreamingMessage(null);
        setIsWaitingForAI(false);
        seedingRef.current = false;
      },
    });
  }, [conversation, dbMessages.length, messagesLoaded, activityTitle, activityDescription, queryClient]);

  // Stagger reveal of new AI messages
  const justStreamedRef = useRef(false);
  useEffect(() => {
    const currentIds = new Set(dbMessages.map(m => m.id));
    const newAiMsgs = dbMessages.filter(
      m => m.role === "ai" && !prevMessageIdsRef.current.has(m.id) && !revealedIds.has(m.id)
    );

    if (newAiMsgs.length > 0) {
      // If these came from streaming, reveal first immediately (it was already visible)
      const startIndex = justStreamedRef.current ? 1 : 0;
      if (justStreamedRef.current && newAiMsgs[0]) {
        setRevealedIds(prev => new Set([...prev, newAiMsgs[0].id]));
      }
      justStreamedRef.current = false;
      
      newAiMsgs.slice(startIndex).forEach((msg, i) => {
        setTimeout(() => {
          setRevealedIds(prev => new Set([...prev, msg.id]));
          setFreshIds(prev => new Set([...prev, msg.id]));
        }, (i + 1) * 700);
      });
    }

    // Also mark user messages as fresh if they're new
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

    // Mark first-streamed message as fresh too
    if (justStreamedRef.current && newAiMsgs[0]) {
      setFreshIds(prev => new Set([...prev, newAiMsgs[0].id]));
    }
    }

    if (prevMessageIdsRef.current.size === 0 && dbMessages.length > 0) {
      setRevealedIds(new Set(dbMessages.map(m => m.id)));
    }

    prevMessageIdsRef.current = currentIds;
  }, [dbMessages]);

  // Only show the first segment of streaming content (before ---) to avoid showing a giant mixed bubble
  const streamingDisplayContent = streamingMessage
    ? streamingMessage.split(/\n---\n/)[0].trim()
    : null;

  const messages: ChatMessage[] = [
    ...dbMessages
      .filter(m => m.role !== "ai" || revealedIds.has(m.id))
      .map((m: DBMessage) => ({
        id: m.id,
        role: m.role as "user" | "ai",
        content: m.content,
      })),
    ...(streamingDisplayContent
      ? [{ id: "streaming", role: "ai" as const, content: streamingDisplayContent, isStreaming: true }]
      : []),
  ];

  // Show thinking bubble: only when waiting for AI (after user msg is visible) OR while unrevealed AI messages exist
  const hasUnrevealedAI = dbMessages.some(m => m.role === "ai" && !revealedIds.has(m.id));
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const showThinking = (isWaitingForAI && !streamingMessage) || hasUnrevealedAI;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleRestart = useCallback(async () => {
    if (!conversation || isSending) return;
    abortRef.current?.abort();
    setStreamingMessage(null);
    setIsSending(false);

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversation.id);

    if (error) {
      toast.error("Failed to restart chat");
      return;
    }

    seedingRef.current = false;
    queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
    toast.success("Chat restarted");
  }, [conversation, isSending, queryClient]);

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

    // Refetch to show user message immediately, then show thinking
    await queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
    setIsWaitingForAI(true);

    // Stream AI response
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
          setStreamingMessage(prev => (prev ?? "") + chunk);
        },
        onDone: async () => {
          if (fullResponse) {
            justStreamedRef.current = true;
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
          setStreamingMessage(null);
          setIsSending(false);
          setIsWaitingForAI(false);

          // Solo completion: user answered at least 3 AI questions
          const userMessageCount = dbMessages.filter(m => m.role === "user").length + 1; // +1 for the just-sent message
          if (userMessageCount >= 3) {
            markCompleted();
          }
        },
        onError: (error) => {
          toast.error(error);
          setStreamingMessage(null);
          setIsSending(false);
          setIsWaitingForAI(false);
        },
        signal: abort.signal,
      });
    } catch (err) {
      console.error("streamChat error:", err);
      toast.error("Something went wrong. Please try again.");
      setStreamingMessage(null);
      setIsSending(false);
    }
  }, [input, isSending, conversation, user, dbMessages, activityTitle, activityDescription, queryClient, markCompleted]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-foreground text-sm">{activityTitle}</h1>
          <p className="text-xs text-muted-foreground">Solo Chat</p>
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
        {messages.length === 0 && !streamingMessage && (
          <AIThinkingBubble />
        )}

        {messages.map((msg, idx) => {
          const isLastAI = msg.role === "ai" && !msg.isStreaming &&
            (idx === messages.length - 1 || messages[idx + 1]?.role === "user") &&
            !(idx === messages.length - 1 && streamingMessage !== null);
          const isFirstAI = msg.role === "ai" && idx === 0;
          const labelType = msg.role === "ai" ? getAILabelType(msg.content, isFirstAI) : null;
          const displayContent = labelType === "question" ? highlightQuestions(msg.content) : msg.content;

          return (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}${freshIds.has(msg.id) || msg.id === "streaming" ? " animate-fade-in-message" : ""}`}
              onAnimationEnd={() => setFreshIds(prev => { const next = new Set(prev); next.delete(msg.id); return next; })}
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
                    <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                      <ReactMarkdown>{displayContent}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {showThinking && messages.length > 0 && <AIThinkingBubble />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-card border-t border-border p-4 sticky bottom-0">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share your thoughts..."
            className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-border"
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
    </div>
  );
};

export default SoloChat;
