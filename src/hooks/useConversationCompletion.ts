import { useRef, useCallback } from "react";
import { useCompleteActivity } from "@/hooks/useActivities";
import { toast } from "sonner";

/**
 * Hook to auto-mark an activity as completed when conversation criteria are met.
 * Ensures completion is only triggered once per session.
 */
export function useConversationCompletion(activityId: string) {
  const completeActivity = useCompleteActivity();
  const completedRef = useRef(false);

  const markCompleted = useCallback(() => {
    if (completedRef.current || completeActivity.isPending) return;
    completedRef.current = true;

    completeActivity.mutate(activityId, {
      onSuccess: () => {
        toast.success("Activity completed! 🎉");
      },
      onError: () => {
        completedRef.current = false;
      },
    });
  }, [activityId, completeActivity]);

  return { markCompleted };
}
