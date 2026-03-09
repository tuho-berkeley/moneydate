import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, RotateCcw } from "lucide-react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const messages: ChatMessage[] = [
    ...dbMessages.map((m: DBMessage) => ({
      id: m.id,
      role: m.role as "user" | "ai",
      content: m.content,
    })),
    ...(streamingMessage !== null
      ? [{ id: "streaming", role: "ai" as const, content: streamingMessage, isStreaming: true }]
      : []),
  ];

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

    // Refetch to show user message immediately
    await queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });

    // Stream AI response
    let fullResponse = "";
    setStreamingMessage("");

    const abort = new AbortController();
    abortRef.current = abort;

    const historyForAI = [
      ...dbMessages.map((m: DBMessage) => ({
        role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userText },
    ];

    await streamChat({
      messages: historyForAI,
      activityTitle,
      activityDescription: activityDescription || "",
      conversationType: "solo",
      onDelta: (chunk) => {
        fullResponse += chunk;
        setStreamingMessage(fullResponse);
      },
      onDone: async () => {
        setStreamingMessage(null);
        // Save AI message
        if (fullResponse) {
          await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_id: null,
            role: "ai",
            content: fullResponse,
          });
          queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
        }
        setIsSending(false);
      },
      onError: (error) => {
        toast.error(error);
        setStreamingMessage(null);
        setIsSending(false);
      },
      signal: abort.signal,
    });
  }, [input, isSending, conversation, user, dbMessages, activityTitle, activityDescription, queryClient]);

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
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isSending && (
          <div className="bg-secondary/50 rounded-2xl p-4 max-w-[85%]">
            <p className="text-sm text-foreground">
              Hi! I'm here to guide you through a personal reflection about{" "}
              <strong>{activityTitle.toLowerCase()}</strong>.
            </p>
            <p className="text-sm text-foreground mt-2">
              Take your time — there are no right or wrong answers. What comes to mind first?
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl p-4 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-foreground"
              }`}
            >
              {msg.role === "ai" ? (
                <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                  )}
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isSending && streamingMessage === null && (
          <div className="flex justify-start">
            <div className="bg-secondary/50 rounded-2xl p-4">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

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
