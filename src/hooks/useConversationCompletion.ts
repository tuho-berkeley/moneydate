import { useRef, useCallback } from "react";
import { useCompleteActivity, useActivities } from "@/hooks/useActivities";
import { toast } from "sonner";

/**
 * Hook to auto-mark an activity as completed when conversation criteria are met.
 * Ensures completion is only triggered once per session and skips if already completed.
 */
export function useConversationCompletion(activityId: string) {
  const completeActivity = useCompleteActivity();
  const { data: activitiesData } = useActivities();
  const completedRef = useRef(false);

  const markCompleted = useCallback(() => {
    if (completedRef.current || completeActivity.isPending) return;

    // Check if already completed in database — skip toast if so
    const alreadyCompleted = activitiesData?.some(
      (stage) => stage.activities.some(
        (a) => a.id === activityId && a.userStatus === "completed"
      )
    );
    if (existing) {
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

  return { markCompleted };
}
