import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, Users, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { streamChat } from "@/lib/streamChat";
import ReactMarkdown from "react-markdown";
import type { Database } from "@/integrations/supabase/types";

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
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRequestingAI, setIsRequestingAI] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  const { data: dbMessages = [] } = useQuery({
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

  // Build display messages
  const displayMessages = [
    ...dbMessages.map((m: DBMessage) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      isMe: m.sender_id === user?.id,
    })),
    ...(streamingMessage !== null
      ? [{ id: "streaming", role: "ai" as const, content: streamingMessage, isMe: false }]
      : []),
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending || !conversation || !user) return;

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
  }, [input, isSending, conversation, user]);

  const handleRequestAI = useCallback(async () => {
    if (isRequestingAI || !conversation || !user) return;
    setIsRequestingAI(true);

    const historyForAI = dbMessages.map((m: DBMessage) => ({
      role: (m.role === "ai" ? "assistant" : m.sender_id === user.id ? "user" : "partner") as
        | "user"
        | "assistant"
        | "partner",
      content: m.content,
    }));

    let fullResponse = "";
    setStreamingMessage("");

    await streamChat({
      messages: historyForAI,
      activityTitle,
      activityDescription: activityDescription || "",
      conversationType: "together",
      onDelta: (chunk) => {
        fullResponse += chunk;
        setStreamingMessage(fullResponse);
      },
      onDone: async () => {
        setStreamingMessage(null);
        if (fullResponse) {
          await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_id: null,
            role: "ai",
            content: fullResponse,
          });
        }
        setIsRequestingAI(false);
      },
      onError: (error) => {
        toast.error(error);
        setStreamingMessage(null);
        setIsRequestingAI(false);
      },
    });
  }, [isRequestingAI, conversation, user, dbMessages, activityTitle, activityDescription]);

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
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            Together Chat
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {displayMessages.length === 0 && (
          <div className="bg-secondary/50 rounded-2xl p-4 max-w-[85%]">
            <p className="text-sm text-foreground">
              Welcome to your couple conversation about <strong>{activityTitle.toLowerCase()}</strong>!
            </p>
            <p className="text-sm text-foreground mt-2">
              Both of you can share your thoughts here. Tap the ✨ button anytime to ask the AI facilitator to guide the conversation.
            </p>
          </div>
        )}

        {displayMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === "ai" ? "justify-start" : msg.isMe ? "justify-end" : "justify-start"
            }`}
          >
            <div>
              {msg.role !== "ai" && (
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 px-1 ${
                  msg.isMe ? "text-right text-primary/60" : "text-muted-foreground"
                }`}>
                  {msg.isMe ? "You" : "Partner"}
                </p>
              )}
              {msg.role === "ai" && (
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 px-1 text-secondary-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI Facilitator
                </p>
              )}
              <div
                className={`max-w-[85%] rounded-2xl p-4 ${
                  msg.role === "ai"
                    ? "bg-accent/50 text-foreground border border-accent"
                    : msg.isMe
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-foreground"
                }`}
              >
                {msg.role === "ai" ? (
                  <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-card border-t border-border p-4 sticky bottom-0">
        <div className="flex items-end gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-xl flex-shrink-0 border-accent"
            onClick={handleRequestAI}
            disabled={isRequestingAI}
            title="Ask AI to facilitate"
          >
            {isRequestingAI ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <Sparkles className="w-5 h-5 text-primary" />
            )}
          </Button>
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

export default TogetherChat;
