import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type Activity = Database["public"]["Tables"]["activities"]["Row"];
type UserActivity = Database["public"]["Tables"]["user_activities"]["Row"];
type ActivityStatus = Database["public"]["Enums"]["activity_status"];

export interface Stage {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  order_index: number;
  icon: string;
}

export interface ActivityWithProgress extends Activity {
  userStatus: ActivityStatus;
  startedAt: string | null;
  completedAt: string | null;
  stage_id: string | null;
}

export interface StageWithActivities extends Stage {
  activities: ActivityWithProgress[];
  completedCount: number;
  totalCount: number;
  isUnlocked: boolean;
}

export function useStagesWithActivities() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["stages-with-activities", user?.id],
    queryFn: async (): Promise<StageWithActivities[]> => {
      if (!user) return [];

      // Fetch all stages
      const { data: stages, error: stagesError } = await supabase
        .from("stages")
        .select("*")
        .order("order_index", { ascending: true });

      if (stagesError) throw stagesError;

      // Fetch all activities
      const { data: activities, error: activitiesError } = await supabase
        .from("activities")
        .select("*")
        .order("order_index", { ascending: true });

      if (activitiesError) throw activitiesError;

      // Fetch user's activity progress
      const { data: userActivities, error: userActivitiesError } = await supabase
        .from("user_activities")
        .select("*")
        .eq("user_id", user.id);

      if (userActivitiesError) throw userActivitiesError;

      // Create a map of user activity status
      const progressMap = new Map<string, UserActivity>();
      userActivities?.forEach((ua) => progressMap.set(ua.activity_id, ua));

      // Group activities by stage and compute progress
      const stagesWithActivities: StageWithActivities[] = (stages || []).map((stage, stageIndex) => {
        const stageActivities = (activities || []).filter((a) => a.stage_id === stage.id);
        
        // Temporary: Stages 1-3 unlocked, Stages 4-5 locked
        const isUnlocked = stage.order_index <= 2;

        // Map activities with their user status
        const activitiesWithProgress: ActivityWithProgress[] = stageActivities.map((activity, activityIndex) => {
          const userActivity = progressMap.get(activity.id);
          
          let userStatus: ActivityStatus = "locked";
          
          if (!isUnlocked) {
            userStatus = "locked";
          } else if (userActivity) {
            userStatus = userActivity.status;
          } else {
            // All activities within an unlocked stage are available
            userStatus = "available";
          }

          return {
            ...activity,
            userStatus,
            startedAt: userActivity?.started_at || null,
            completedAt: userActivity?.completed_at || null,
          };
        });

        const completedCount = activitiesWithProgress.filter((a) => a.userStatus === "completed").length;

        return {
          ...stage,
          activities: activitiesWithProgress,
          completedCount,
          totalCount: stageActivities.length,
          isUnlocked,
        };
      });

      return stagesWithActivities;
    },
    enabled: !!user,
  });
}

// Keep legacy hook for backward compatibility
export function useActivities() {
  const { data: stages, isLoading, error } = useStagesWithActivities();
  
  // Flatten all activities from stages
  const activities = stages?.flatMap((stage) => stage.activities) || [];
  
  return { data: activities, isLoading, error };
}

export function useStartActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activityId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_activities")
        .upsert(
          {
            user_id: user.id,
            activity_id: activityId,
            status: "in_progress" as ActivityStatus,
            started_at: new Date().toISOString(),
          },
          { onConflict: "user_id,activity_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages-with-activities"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useCompleteActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activityId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_activities")
        .upsert(
          {
            user_id: user.id,
            activity_id: activityId,
            status: "completed" as ActivityStatus,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,activity_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages-with-activities"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useActivityStats() {
  const { data: stages } = useStagesWithActivities();

  const totalActivities = stages?.reduce((sum, s) => sum + s.totalCount, 0) || 0;
  const completedActivities = stages?.reduce((sum, s) => sum + s.completedCount, 0) || 0;
  
  // Find current activity (first available or in_progress)
  let currentActivity: ActivityWithProgress | undefined;
  for (const stage of stages || []) {
    const activity = stage.activities.find(
      (a) => a.userStatus === "in_progress" || a.userStatus === "available"
    );
    if (activity) {
      currentActivity = activity;
      break;
    }
  }

  return {
    total: totalActivities,
    completed: completedActivities,
    current: currentActivity,
    progressPercent: totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0,
  };
}
