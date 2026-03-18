import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, Users, RotateCcw, Clock, Share2, Sparkles, MessageCircle } from "lucide-react";
import { useActivities } from "@/hooks/useActivities";
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

interface TogetherChatProps {
  activityId: string;
  activityTitle: string;
  activityDescription: string;
  activityOutcome?: string;
}

const TogetherChat = ({ activityId, activityTitle, activityDescription, activityOutcome }: TogetherChatProps) => {
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
  const { markCompleted, markInsightsGenerated, resetCompletion } = useConversationCompletion(activityId);

  // Quality answer tracking per partner
  const myQualityCountRef = useRef(0);
  const partnerQualityCountRef = useRef(0);
  const [completionReached, setCompletionReached] = useState(false);
  const completionReachedRef = useRef(false);
  const [showClosureButtons, setShowClosureButtons] = useState(false);
  const [continueAnyway, setContinueAnyway] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const pendingClosureRef = useRef(false);
  const closureMessageIdRef = useRef<string | null>(null);

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id, queryClient]);

  // Check current activity status
  const { data: activitiesData } = useActivities();
  const currentActivityStatus = activitiesData?.find(a => a.id === activityId)?.userStatus;

  // Seed quality counts from existing messages on load
  const qualitySeededRef = useRef(false);
  useEffect(() => {
    if (qualitySeededRef.current || !messagesLoaded || dbMessages.length === 0 || !user) return;
    qualitySeededRef.current = true;
    const myMsgs = dbMessages.filter(m => m.role === "user" && m.sender_id === user.id);
    const partnerMsgs = dbMessages.filter(m => m.role === "partner" || (m.role === "user" && m.sender_id !== user.id));
    myQualityCountRef.current = myMsgs.filter(m => passesPreFilter(m.content)).length;
    partnerQualityCountRef.current = partnerMsgs.filter(m => passesPreFilter(m.content)).length;
    console.log(`[TogetherChat] Seeded quality: me=${myQualityCountRef.current}, partner=${partnerQualityCountRef.current}`);
    if (myQualityCountRef.current >= 3 && partnerQualityCountRef.current >= 3) {
      completionReachedRef.current = true;
      setCompletionReached(true);
      markCompleted();
      if (conversation) {
        supabase.from("conversations").update({ completed: true } as any).eq("id", conversation.id);
        queryClient.invalidateQueries({ queryKey: ["completed-conversation-types"] });
      }
      if (currentActivityStatus === "insights_generated") {
        setShowInsights(true);
      } else {
        setShowClosureButtons(true);
      }
    }
  }, [messagesLoaded, dbMessages, user, markCompleted, currentActivityStatus]);

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
    if (!aiShouldRespond || isAIResponding || aiTriggerRef.current || completionReached || completionReachedRef.current) return;
    aiTriggerRef.current = true;

    const historyForAI = dbMessages.map((m: DBMessage) => ({
      role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
      content: m.role === "ai"
        ? m.content
        : `[${m.sender_id === user?.id ? myName : partnerName}]: ${m.content}`,
    }));

    triggerAI(historyForAI);
  }, [aiShouldRespond, isAIResponding]);

  // Check quality for the latest non-AI message and handle completion
  const checkQualityAndCompletion = useCallback((senderId: string, messageContent: string) => {
    if (completionReached && !continueAnyway) return;

    // Use passesPreFilter for consistency with seed logic
    if (passesPreFilter(messageContent)) {
      if (senderId === user?.id) {
        myQualityCountRef.current += 1;
      } else {
        partnerQualityCountRef.current += 1;
      }
    }

    if (myQualityCountRef.current >= 3 && partnerQualityCountRef.current >= 3 && !continueAnyway) {
      completionReachedRef.current = true;
      setCompletionReached(true);
      markCompleted();
      if (conversation) {
        supabase.from("conversations").update({ completed: true } as any).eq("id", conversation.id);
        queryClient.invalidateQueries({ queryKey: ["completed-conversation-types"] });
      }
    }
  }, [user, completionReached, continueAnyway, markCompleted, conversation, queryClient]);

  const triggerAI = useCallback(async (historyForAI: { role: "user" | "assistant"; content: string }[]) => {
    if (!conversation || isAIResponding || completionReachedRef.current) return;
    setIsAIResponding(true);
    aiTriggerRef.current = true;

    let fullResponse = "";

    await streamChat({
      messages: historyForAI,
      activityTitle,
      activityDescription: activityDescription || "",
      activityOutcome,
      conversationType: "together",
      userName: myName,
      partnerName,
      onDelta: (chunk) => {
        fullResponse += chunk;
      },
      onDone: async () => {
        if (fullResponse) {
          const rawSegments = fullResponse.split(/\n---\n/).map(s => s.trim()).filter(Boolean);
          
          const askingMatch = fullResponse.match(/\[ASKING:[^\]]+\]\s*$/);
          const askingTag = askingMatch ? askingMatch[0] : "";
          
          const segments = rawSegments.filter(s => {
            const stripped = s.replace(/\[ASKING:[^\]]+\]\s*$/, "").trim();
            return stripped.length > 0;
          });
          
          for (let i = 0; i < segments.length; i++) {
            let content = segments[i];
            if (i === segments.length - 1 && askingTag && !content.includes("[ASKING:")) {
              content = content + "\n" + askingTag;
            }
            await supabase.from("messages").insert({
              conversation_id: conversation.id,
              sender_id: null,
              role: "ai",
              content,
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

  // Trigger pre-closure AI message
  const triggerPreClosure = useCallback(async () => {
    if (!conversation) return;
    setIsAIResponding(true);

    const historyForAI = dbMessages.map((m: DBMessage) => ({
      role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
      content: m.role === "ai"
        ? m.content
        : `[${m.sender_id === user?.id ? myName : partnerName}]: ${m.content}`,
    }));

    let fullResponse = "";
    await streamChat({
      messages: historyForAI,
      activityTitle,
      activityDescription: activityDescription || "",
      activityOutcome,
      userName: myName,
      partnerName,
      onDelta: (chunk) => { fullResponse += chunk; },
      onDone: async () => {
        if (fullResponse && conversation) {
          // Strip any sentences ending with "?" as a safety net
          fullResponse = fullResponse.replace(/[^.!?\n]*\?/g, "").trim();
          if (!fullResponse) fullResponse = "Thank you both for sharing so openly. 💛";

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
        // Defer closure buttons until typewriter animation finishes
        pendingClosureRef.current = true;
      },
      onError: (error) => {
        toast.error(error);
        setIsAIResponding(false);
        aiTriggerRef.current = false;
        setShowClosureButtons(true);
      },
    });
  }, [conversation, dbMessages, activityTitle, activityDescription, myName, partnerName, user, queryClient]);

  // Check completion synchronously during render (not in effect) so the ref
  // is set BEFORE the AI-trigger effect evaluates in the same render cycle.
  const lastCheckedLengthRef = useRef(0);
  if (dbMessages.length > lastCheckedLengthRef.current && user) {
    lastCheckedLengthRef.current = dbMessages.length;
    const lastMsg = dbMessages[dbMessages.length - 1];
    if ((lastMsg.role === "user" || lastMsg.role === "partner") && lastMsg.sender_id) {
      // Inline completion check — sets completionReachedRef synchronously
      if (!completionReachedRef.current && !continueAnyway) {
        if (passesPreFilter(lastMsg.content)) {
          if (lastMsg.sender_id === user.id) {
            myQualityCountRef.current += 1;
          } else {
            partnerQualityCountRef.current += 1;
          }
        }
        if (myQualityCountRef.current >= 3 && partnerQualityCountRef.current >= 3) {
          completionReachedRef.current = true;
          setCompletionReached(true);
          markCompleted();
          if (conversation) {
            supabase.from("conversations").update({ completed: true } as any).eq("id", conversation.id);
            queryClient.invalidateQueries({ queryKey: ["completed-conversation-types"] });
          }
        }
      }
    }
  }

  // When completion is reached, trigger pre-closure instead of normal AI
  const preClosureTriggeredRef = useRef(false);
  useEffect(() => {
    if (!completionReached || continueAnyway || showClosureButtons || showInsights) return;
    if (preClosureTriggeredRef.current) return;
    if (isAIResponding) return;
    preClosureTriggeredRef.current = true;
    aiTriggerRef.current = true;
    triggerPreClosure();
  }, [completionReached, continueAnyway, showClosureButtons, showInsights, isAIResponding]);

  // Sequential reveal of new AI messages
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

  // Build display messages
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
  }, [displayMessages, showClosureButtons]);

  const handleTypewriterComplete = useCallback((msgId: string) => {
    setFreshIds(prev => {
      const next = new Set(prev);
      next.delete(msgId);
      return next;
    });

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
        pendingClosureRef.current = false;
        setTimeout(() => setShowClosureButtons(true), 300);
      }
    } else if (pendingClosureRef.current && revealQueueRef.current.length === 0) {
      pendingClosureRef.current = false;
      setTimeout(() => setShowClosureButtons(true), 300);
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      const newHeight = Math.min(el.scrollHeight, 120);
      el.style.height = `${newHeight}px`;
      el.style.overflow = newHeight >= 120 ? "auto" : "hidden";
    }
  }, [input]);

  const handleRestart = useCallback(async () => {
    if (!conversation || isSending) return;
    setIsSending(false);
    setIsAIResponding(false);

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
    aiTriggerRef.current = false;
    myQualityCountRef.current = 0;
    partnerQualityCountRef.current = 0;
    completionReachedRef.current = false;
    lastCheckedLengthRef.current = 0;
    setCompletionReached(false);
    setShowClosureButtons(false);
    setContinueAnyway(false);
    setShowInsights(false);
    setIsGeneratingInsights(false);
    closureMessageIdRef.current = null;
    pendingClosureRef.current = false;
    preClosureTriggeredRef.current = false;
    setRevealedIds(new Set());
    setFreshIds(new Set());
    prevMessageIdsRef.current = new Set();
    await resetCompletion();
    if (conversation) {
      await supabase.from("conversations").update({ completed: false } as any).eq("id", conversation.id);
    }
    queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
    queryClient.invalidateQueries({ queryKey: ["completed-conversation-types"] });
    toast.success("Chat restarted");
  }, [conversation, isSending, queryClient, resetCompletion]);

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
    }
    setIsSending(false);
  }, [input, isSending, conversation, user, myResponseSent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Generate insights
  const handleGenerateInsights = useCallback(async () => {
    if (!conversation) return;
    setShowClosureButtons(false);
    setShowInsights(true);
    setIsGeneratingInsights(true);
    setIsAIResponding(true);

    // Filter out pre-closure/insight messages — only include the actual conversation
    // Pre-closure messages are AI messages that appear after the last user/partner message
    const lastUserMsgIdx = dbMessages.reduce((acc, m, i) => (m.role !== "ai" ? i : acc), -1);
    const conversationMessages = dbMessages.filter((m, i) => {
      // Keep all user/partner messages
      if (m.role !== "ai") return true;
      // Keep AI messages that come before or at the last user message (they're part of the conversation)
      return i <= lastUserMsgIdx;
    });

    const historyForAI = conversationMessages.map((m: DBMessage) => ({
      role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
      content: m.role === "ai"
        ? stripAskingTag(m.content)
        : `[${m.sender_id === user?.id ? myName : partnerName}]: ${m.content}`,
    }));

    let fullResponse = "";
    await streamChat({
      messages: historyForAI,
      activityTitle,
      activityDescription: activityDescription || "",
      activityOutcome,
      userName: myName,
      partnerName,
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
        setIsAIResponding(false);
        setIsGeneratingInsights(false);
        setTimeout(() => { aiTriggerRef.current = false; }, 500);
      },
      onError: (error) => {
        toast.error(error);
        setIsAIResponding(false);
        setIsGeneratingInsights(false);
      },
    });
  }, [conversation, dbMessages, activityTitle, activityDescription, myName, partnerName, user, queryClient]);

  // Continue conversation
  const handleContinueConversation = useCallback(() => {
    setShowClosureButtons(false);
    setCompletionReached(false);
    setContinueAnyway(true);
    setShowInsights(false);
    setIsGeneratingInsights(false);
    aiTriggerRef.current = false;
  }, []);

  // Determine if input should be disabled
  const inputDisabled = isAIResponding || myResponseSent || isPartnerTurn || dbMessages.length === 0 || (completionReached && !continueAnyway) || showInsights;

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
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              Together Chat
            </div>
            {completionReached && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                Completed
              </span>
            )}
          </div>
        </div>
        <button
          onClick={async () => {
            const shareUrl = `${window.location.origin}/conversation/${activityId}?mode=together`;
            const shareText = `Join me for "${activityTitle}" on MoneyDate! 💚\n${shareUrl}`;
            const copyFallback = () => {
              const ta = document.createElement("textarea");
              ta.value = shareText;
              ta.style.cssText = "position:fixed;opacity:0";
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
              toast.success("Link copied to clipboard!");
            };
            if (typeof navigator.share === "function") {
              try {
                await navigator.share({
                  title: activityTitle,
                  text: `Join me for "${activityTitle}" on MoneyDate! 💚`,
                  url: shareUrl,
                });
                return;
              } catch {
                // share cancelled or failed
              }
            }
            try {
              await navigator.clipboard.writeText(shareText);
              toast.success("Link copied to clipboard!");
            } catch {
              copyFallback();
            }
          }}
          className="flex items-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 transition-colors rounded-full px-3 py-1.5 text-xs font-medium"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
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
        {dbMessages.length === 0 && isAIResponding && (
          <AIThinkingBubble />
        )}

        {(() => {
          // Find last user/partner message index so typewriter only applies to AI messages after it
          const lastUserIdx = displayMessages.reduce((acc, m, i) => m.role !== "ai" ? i : acc, -1);

          return displayMessages.map((msg, idx) => {
          const isFirstAI = msg.role === "ai" && idx === 0;
          const labelType = msg.role === "ai" ? getAILabelType(msg.content, isFirstAI) : null;
          const displayContent = labelType === "question" ? highlightQuestions(msg.content) : msg.content;
          const isFresh = freshIds.has(msg.id) && idx > lastUserIdx;

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
                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 px-1 text-primary/60 ${
                    msg.isMe ? "text-right" : ""
                  }`}>
                    {msg.senderName}
                  </p>
                )}
                <div
                  className={`rounded-2xl p-4 ${
                    msg.role === "ai"
                      ? "bg-secondary/50 text-foreground"
                      : "bg-primary text-primary-foreground"
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
        });
        })()}

        {/* Waiting indicator */}
        {waitingForPartner && !isAIResponding && !completionReached && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-4 py-2">
              <Clock className="w-3.5 h-3.5" />
              Waiting for {partnerName} to respond…
            </div>
          </div>
        )}

        {/* AI is thinking */}
        {isAIResponding && dbMessages.length > 0 && (
          <AIThinkingBubble />
        )}

        {/* Closure buttons */}
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
      {!inputDisabled ? (
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
          {myResponseSent || waitingForPartner ? (
            <div className="text-center text-sm text-muted-foreground py-2 p-4">
              {myResponseSent
                ? `Your response has been sent. Waiting for the guide…`
                : `Waiting for ${partnerName} to respond…`}
            </div>
          ) : isPartnerTurn && !askedPartnerResponded ? (
            <div className="text-center text-sm text-muted-foreground py-2 p-4">
              Waiting for {partnerName} to respond…
            </div>
          ) : (
            <div className="flex items-end gap-2 p-4 pt-3">
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
      ) : null}

      {/* Show "done" footer when insights are shown */}
      {showInsights && !isGeneratingInsights && !isAIResponding && (
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

export default TogetherChat;
