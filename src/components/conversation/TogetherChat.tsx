import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, Users, RotateCcw, Clock } from "lucide-react";
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
import ReactMarkdown from "react-markdown";
import type { Database } from "@/integrations/supabase/types";
import { useConversationCompletion } from "@/hooks/useConversationCompletion";

type DBMessage = Database["public"]["Tables"]["messages"]["Row"];

interface TogetherChatProps {
  activityId: string;
  activityTitle: string;
  activityDescription: string;
}

const TogetherChat = ({ activityId, activityTitle, activityDescription }: TogetherChatProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const seedingRef = useRef(false);
  const aiTriggerRef = useRef(false);
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  const revealQueueRef = useRef<string[]>([]);
  const { markCompleted } = useConversationCompletion(activityId);

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

  // Get or create conversation (linked to couple)
  const { data: conversation } = useQuery({
    queryKey: ["conversation", activityId, "together", profile?.couple_id],
    queryFn: async () => {
      if (!user || !profile?.couple_id) throw new Error("Missing data");

      const { data: existing } = await supabase
        .from("conversations")
        .select("*")
        .eq("activity_id", activityId)
        .eq("couple_id", profile.couple_id)
        .eq("type", "together")
        .maybeSingle();

      if (existing) return existing;

      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({
          activity_id: activityId,
          user_id: user.id,
          couple_id: profile.couple_id,
          type: "together",
        })
        .select()
        .single();

      if (error) throw error;
      return newConv;
    },
    enabled: !!user && !!profile?.couple_id,
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

  // Realtime subscription for messages
  useEffect(() => {
    if (!conversation) return;

    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id, queryClient]);

  // Determine turn state
  const partnerId = partnerProfile?.id;
  const partnerName = partnerProfile?.display_name || "Partner";
  const myName = profile?.display_name || "You";

  // Parse [ASKING:name] tag from last AI message
  const askingTagRegex = /\[ASKING:([^\]]+)\]\s*$/;

  const parseAsking = (content: string): string | null => {
    const match = content.match(askingTagRegex);
    return match ? match[1].trim() : null;
  };

  const stripAskingTag = (content: string): string => {
    return content.replace(askingTagRegex, "").trimEnd();
  };

  // Find the last AI message and who it's asking
  const lastAIMessage = (() => {
    for (let i = dbMessages.length - 1; i >= 0; i--) {
      if (dbMessages[i].role === "ai") return dbMessages[i];
    }
    return null;
  })();

  const lastAIIndex = lastAIMessage
    ? dbMessages.findIndex((m) => m.id === lastAIMessage.id)
    : -1;

  const askedPartnerName = lastAIMessage ? parseAsking(lastAIMessage.content) : null;
  const isMyTurn = askedPartnerName === myName;
  const isPartnerTurn = askedPartnerName === partnerName;

  // Check if the asked partner has responded since the last AI message
  const messagesSinceLastAI = lastAIIndex >= 0
    ? dbMessages.slice(lastAIIndex + 1)
    : [];

  const askedPartnerResponded = (() => {
    if (isMyTurn) return messagesSinceLastAI.some((m) => m.sender_id === user?.id);
    if (isPartnerTurn) return partnerId ? messagesSinceLastAI.some((m) => m.sender_id === partnerId) : false;
    return false;
  })();

  // Current user already answered this turn
  const myResponseSent = isMyTurn && messagesSinceLastAI.some((m) => m.sender_id === user?.id);
  const waitingForPartner = isPartnerTurn && !askedPartnerResponded;

  // AI should respond after the asked partner answers
  const lastMessage = dbMessages[dbMessages.length - 1];
  const aiShouldRespond = dbMessages.length > 0 && lastMessage?.role !== "ai" && askedPartnerResponded;

  // Auto-seed AI starter message
  useEffect(() => {
    if (!conversation || !messagesLoaded || seedingRef.current || dbMessages.length > 0) return;
    seedingRef.current = true;
    triggerAI([]);
  }, [conversation, messagesLoaded, dbMessages.length]);

  // Auto-trigger AI after the asked partner responds
  useEffect(() => {
    if (!aiShouldRespond || isAIResponding || aiTriggerRef.current) return;
    aiTriggerRef.current = true;

    const historyForAI = dbMessages.map((m: DBMessage) => ({
      role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
      content: m.role === "ai"
        ? m.content
        : `[${m.sender_id === user?.id ? myName : partnerName}]: ${m.content}`,
    }));

    triggerAI(historyForAI);
  }, [aiShouldRespond, isAIResponding]);

  const triggerAI = useCallback(async (historyForAI: { role: "user" | "assistant"; content: string }[]) => {
    if (!conversation || isAIResponding) return;
    setIsAIResponding(true);
    aiTriggerRef.current = true;

    let fullResponse = "";

    await streamChat({
      messages: historyForAI,
      activityTitle,
      activityDescription: activityDescription || "",
      conversationType: "together",
      userName: myName,
      partnerName,
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
        setIsAIResponding(false);
        setTimeout(() => { aiTriggerRef.current = false; }, 500);
      },
      onError: (error) => {
        toast.error(error);
        setIsAIResponding(false);
        aiTriggerRef.current = false;
      },
    });
  }, [conversation, activityTitle, activityDescription, myName, partnerName]);

  // Sequential reveal of new AI messages (one at a time, after typewriter completes)
  useEffect(() => {
    const currentIds = new Set(dbMessages.map(m => m.id));

    // On first load (returning to existing conversation), reveal all immediately (no animation)
    // Skip if seeding — those should go through the sequential queue
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

      // If nothing is currently being typewritten, reveal the first one
      if (revealQueueRef.current.length === newIds.length) {
        const firstId = revealQueueRef.current[0];
        setRevealedIds(prev => new Set([...prev, firstId]));
        setFreshIds(prev => new Set([...prev, firstId]));
      }
    }

    // Mark user/partner messages as fresh if new
    const newNonAiMsgs = dbMessages.filter(
      m => m.role !== "ai" && !prevMessageIdsRef.current.has(m.id)
    );
    if (newNonAiMsgs.length > 0) {
      setFreshIds(prev => {
        const next = new Set(prev);
        newNonAiMsgs.forEach(m => next.add(m.id));
        return next;
      });
    }

    prevMessageIdsRef.current = currentIds;
  }, [dbMessages]);

  // Build display messages — strip [ASKING:...] tag from AI messages
  const displayMessages = dbMessages
    .filter(m => m.role !== "ai" || revealedIds.has(m.id))
    .map((m: DBMessage) => ({
      id: m.id,
      role: m.role,
      content: m.role === "ai" ? stripAskingTag(m.content) : m.content,
      isMe: m.sender_id === user?.id,
      senderName: m.role === "ai" ? "Guide" : m.sender_id === user?.id ? myName : partnerName,
      askedName: m.role === "ai" ? parseAsking(m.content) : null,
    }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

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
      }
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleRestart = useCallback(async () => {
    if (!conversation || isSending) return;
    setIsSending(false);
    setIsAIResponding(false);
    seedingRef.current = false;
    aiTriggerRef.current = false;
    setRevealedIds(new Set());
    setFreshIds(new Set());
    prevMessageIdsRef.current = new Set();

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversation.id);

    if (error) {
      toast.error("Failed to restart chat");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
    toast.success("Chat restarted");
  }, [conversation, isSending, queryClient]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending || !conversation || !user || myResponseSent) return;

    const text = input.trim();
    setInput("");
    setIsSending(true);

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      role: "user",
      content: text,
    });

    if (error) {
      toast.error("Failed to send message");
    } else {
      // Together completion: each partner answered at least 1 question
      // User just sent a message, so check if partner already has one
      const partnerHasMessages = partnerId ? dbMessages.some(m => m.sender_id === partnerId) : false;
      const userHadMessages = dbMessages.some(m => m.sender_id === user.id);
      // Both have now sent at least 1 if partner had messages, OR if user already had messages and this could be partner's turn
      if (partnerHasMessages && (userHadMessages || true)) {
        markCompleted();
      }
    }
    setIsSending(false);
  }, [input, isSending, conversation, user, myResponseSent, dbMessages, partnerId, markCompleted]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Determine if input should be disabled
  const inputDisabled = isAIResponding || myResponseSent || isPartnerTurn || dbMessages.length === 0;
  

  return (
    <div className="h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-foreground text-sm">{activityTitle}</h1>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            Together Chat
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors" disabled={isSending || displayMessages.length === 0}>
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
        {/* Show thinking bubble during initial load/seeding */}
        {dbMessages.length === 0 && isAIResponding && (
          <AIThinkingBubble />
        )}

        {displayMessages.map((msg, idx) => {
          const isFirstAI = msg.role === "ai" && idx === 0;
          const labelType = msg.role === "ai" ? getAILabelType(msg.content, isFirstAI) : null;
          const displayContent = labelType === "question" ? highlightQuestions(msg.content) : msg.content;
          const isFresh = freshIds.has(msg.id);

          return (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "ai" ? "justify-start" : msg.isMe ? "justify-end" : "justify-start"
              } ${isFresh && msg.role === "ai" ? "animate-message-appear" : ""}`}
              style={isFresh && msg.role === "ai" ? { opacity: 0 } : undefined}
            >
              <div className={msg.role === "ai" ? "max-w-[90%]" : "max-w-[85%]"}>
                {msg.role === "ai" ? (
                  labelType && <AIMessageLabel type={labelType} askedName={labelType === "question" ? msg.askedName ?? undefined : undefined} />
                ) : (
                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 px-1 ${
                    msg.isMe ? "text-right text-primary/60" : "text-muted-foreground"
                  }`}>
                    {msg.senderName}
                  </p>
                )}
                <div
                  className={`rounded-2xl p-4 ${
                    msg.role === "ai"
                      ? "bg-secondary/50 text-foreground"
                      : msg.isMe
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
                      <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:font-semibold">
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

        {/* Waiting indicator */}
        {waitingForPartner && !isAIResponding && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-4 py-2">
              <Clock className="w-3.5 h-3.5" />
              Waiting for {partnerName} to respond…
            </div>
          </div>
        )}

        {/* AI is thinking — show when responding or when unrevealed messages are pending */}
        {isAIResponding && dbMessages.length > 0 && (
          <AIThinkingBubble />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-card border-t border-border p-4 sticky bottom-0">
        {myResponseSent || waitingForPartner ? (
          <div className="text-center text-sm text-muted-foreground py-2">
            {myResponseSent
              ? `Your response has been sent. Waiting for the guide…`
              : `Waiting for ${partnerName} to respond…`}
          </div>
        ) : isPartnerTurn && !askedPartnerResponded ? (
          <div className="text-center text-sm text-muted-foreground py-2">
            Waiting for {partnerName} to respond…
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isAIResponding
                  ? "Hold on a moment…"
                  : isMyTurn
                    ? `${myName}, it's your turn to share!`
                    : "Share your thoughts…"
              }
              className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-border"
              rows={1}
              disabled={inputDisabled}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isSending || inputDisabled}
              size="icon"
              className="h-11 w-11 rounded-xl flex-shrink-0"
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TogetherChat;
