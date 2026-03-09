import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type ConversationType = Database["public"]["Enums"]["conversation_type"];

const Conversation = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get("mode") || "solo") as ConversationType;
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch or create conversation
  const { data: conversation, isLoading: loadingConversation } = useQuery({
    queryKey: ["conversation", activityId, mode, user?.id],
    queryFn: async () => {
      if (!user || !activityId) throw new Error("Missing data");

      // Try to find existing conversation
      const { data: existing, error: findError } = await supabase
        .from("conversations")
        .select("*")
        .eq("activity_id", activityId)
        .eq("user_id", user.id)
        .eq("type", mode)
        .maybeSingle();

      if (findError) throw findError;
      if (existing) return existing;

      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from("conversations")
        .insert({
          activity_id: activityId,
          user_id: user.id,
          type: mode,
        })
        .select()
        .single();

      if (createError) throw createError;
      return newConv;
    },
    enabled: !!user && !!activityId,
  });

  // Fetch messages
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
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

  // Fetch activity details
  const { data: activity } = useQuery({
    queryKey: ["activity", activityId],
    queryFn: async () => {
      if (!activityId) throw new Error("No activity ID");
      
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("id", activityId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!activityId,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!conversation || !user) throw new Error("Missing data");

      // Insert user message
      const { error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          role: "user",
          content,
        });

      if (msgError) throw msgError;

      // TODO: Call AI edge function for response
      // For now, simulate AI response
      setIsTyping(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const { error: aiError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: null,
          role: "ai",
          content: "Thank you for sharing. This is a placeholder AI response. Once you connect your OpenAI API key and create the chat edge function, I'll be able to have meaningful conversations with you about money topics.",
        });

      if (aiError) throw aiError;
      setIsTyping(false);
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["messages", conversation?.id] });
    },
    onError: (error) => {
      toast.error("Failed to send message");
      console.error(error);
      setIsTyping(false);
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const modeLabels: Record<ConversationType, string> = {
    solo: "Solo Chat",
    together: "Together Chat",
    face_to_face: "Face-to-Face",
  };

  if (loadingConversation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
          <h1 className="font-semibold text-foreground text-sm">{activity?.title || "Conversation"}</h1>
          <p className="text-xs text-muted-foreground">{modeLabels[mode]}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loadingMessages ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-secondary/50 rounded-2xl p-4 max-w-[85%]">
            <p className="text-sm text-foreground">
              Hi! I'm here to guide you through this conversation about{" "}
              <strong>{activity?.title?.toLowerCase() || "money"}</strong>. 
              Feel free to share your thoughts, and I'll help facilitate a meaningful discussion.
            </p>
            <p className="text-sm text-foreground mt-2">
              What's on your mind?
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-foreground"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
        
        {isTyping && (
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
            placeholder="Type a message..."
            className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-border"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            size="icon"
            className="h-11 w-11 rounded-xl flex-shrink-0"
          >
            {sendMessage.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Conversation;
