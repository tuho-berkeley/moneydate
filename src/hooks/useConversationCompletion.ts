import { useRef, useCallback } from "react";
import { useCompleteActivity, useActivities } from "@/hooks/useActivities";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Hook to auto-mark an activity as completed when conversation criteria are met.
 * Ensures completion is only triggered once per session and skips if already completed.
 * Provides a reset function to allow re-completion after chat restart.
 */
export function useConversationCompletion(activityId: string) {
  const { user } = useAuth();
  const completeActivity = useCompleteActivity();
  const { data: activitiesData } = useActivities();
  const queryClient = useQueryClient();
  const completedRef = useRef(false);

  const markCompleted = useCallback(() => {
    if (completedRef.current || completeActivity.isPending) return;

    const alreadyCompleted = activitiesData?.some(
      (a) => a.id === activityId && (a.userStatus === "completed" || a.userStatus === "insights_generated")
    );
    if (alreadyCompleted) {
      completedRef.current = true;
      return;
    }

    completedRef.current = true;

    completeActivity.mutate(activityId, {
      onSuccess: () => {
        toast.success("Activity completed! 🎉");
      },
      onError: () => {
        completedRef.current = false;
      },
    });
  }, [activityId, completeActivity, activitiesData]);

  const markInsightsGeneratedMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("user_activities")
        .update({ status: "insights_generated" as any })
        .eq("activity_id", activityId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages-with-activities"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });

  const markInsightsGenerated = useCallback(() => {
    markInsightsGeneratedMutation.mutate();
  }, [markInsightsGeneratedMutation]);

  const resetCompletion = useCallback(async () => {
    completedRef.current = false;

    if (!user) return;

    await supabase
      .from("user_activities")
      .delete()
      .eq("activity_id", activityId)
      .eq("user_id", user.id);

    queryClient.invalidateQueries({ queryKey: ["stages-with-activities"] });
    queryClient.invalidateQueries({ queryKey: ["activities"] });
    queryClient.invalidateQueries({ queryKey: ["activity-status"] });
    queryClient.invalidateQueries({ queryKey: ["completed-conversation-types"] });
  }, [activityId, user, queryClient]);

  return { markCompleted, markInsightsGenerated, resetCompletion };
}
