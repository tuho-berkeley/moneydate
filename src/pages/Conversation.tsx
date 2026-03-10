import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import SoloChat from "@/components/conversation/SoloChat";
import TogetherChat from "@/components/conversation/TogetherChat";
import FaceToFace from "@/components/conversation/FaceToFace";
import type { Database } from "@/integrations/supabase/types";

type ConversationType = Database["public"]["Enums"]["conversation_type"];

const Conversation = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get("mode") || "solo") as ConversationType;

  const { data: activity, isLoading } = useQuery({
    queryKey: ["activity", slug],
    queryFn: async () => {
      if (!slug) throw new Error("No activity slug");
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("slug", slug as any)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading || !activity) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const props = {
    activityId: activity.id,
    activityTitle: activity.title,
    activityDescription: activity.description || "",
  };

  const content = (() => {
    switch (mode) {
      case "together":
        return <TogetherChat {...props} />;
      case "face_to_face":
        return <FaceToFace {...props} />;
      default:
        return <SoloChat {...props} />;
    }
  })();

  return <div className="max-w-lg mx-auto">{content}</div>;
};

export default Conversation;
