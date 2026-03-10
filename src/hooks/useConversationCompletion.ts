import { useRef, useCallback } from "react";
import { useCompleteActivity, useActivities } from "@/hooks/useActivities";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
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

    // Check if already completed in database — skip toast if so
    const alreadyCompleted = activitiesData?.some(
      (a) => a.id === activityId && a.userStatus === "completed"
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

  /**
   * Reset completion state and delete the user_activities entry.
   * Call this when restarting a conversation.
   */
  const resetCompletion = useCallback(async () => {
    completedRef.current = false;

    if (!user) return;

    // Delete the user_activities entry so homepage reflects reset status
    await supabase
      .from("user_activities")
      .delete()
      .eq("activity_id", activityId)
      .eq("user_id", user.id);

    // Invalidate queries so homepage updates
    queryClient.invalidateQueries({ queryKey: ["stages-with-activities"] });
    queryClient.invalidateQueries({ queryKey: ["activities"] });
  }, [activityId, user, queryClient]);

  return { markCompleted, resetCompletion };
}
