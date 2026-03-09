import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type Activity = Database["public"]["Tables"]["activities"]["Row"];
type UserActivity = Database["public"]["Tables"]["user_activities"]["Row"];
type ActivityStatus = Database["public"]["Enums"]["activity_status"];

export interface ActivityWithProgress extends Activity {
  userStatus: ActivityStatus;
  startedAt: string | null;
  completedAt: string | null;
}

export function useActivities() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["activities", user?.id],
    queryFn: async (): Promise<ActivityWithProgress[]> => {
      if (!user) return [];

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

      // Merge activities with user progress
      return (activities || []).map((activity, index) => {
        const userActivity = progressMap.get(activity.id);
        
        // Determine status: first activity is available by default, others follow progression
        let userStatus: ActivityStatus = "locked";
        
        if (userActivity) {
          userStatus = userActivity.status;
        } else if (index === 0) {
          // First activity is always available
          userStatus = "available";
        } else {
          // Check if previous activity is completed
          const prevActivity = activities[index - 1];
          const prevUserActivity = progressMap.get(prevActivity.id);
          if (prevUserActivity?.status === "completed") {
            userStatus = "available";
          }
        }

        return {
          ...activity,
          userStatus,
          startedAt: userActivity?.started_at || null,
          completedAt: userActivity?.completed_at || null,
        };
      });
    },
    enabled: !!user,
  });
}

export function useStartActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activityId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_activities")
        .upsert({
          user_id: user.id,
          activity_id: activityId,
          status: "in_progress" as ActivityStatus,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
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
        .upsert({
          user_id: user.id,
          activity_id: activityId,
          status: "completed" as ActivityStatus,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useActivityStats() {
  const { data: activities } = useActivities();

  const totalActivities = activities?.length || 0;
  const completedActivities = activities?.filter((a) => a.userStatus === "completed").length || 0;
  const currentActivity = activities?.find((a) => a.userStatus === "in_progress" || a.userStatus === "available");

  return {
    total: totalActivities,
    completed: completedActivities,
    current: currentActivity,
    progressPercent: totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0,
  };
}
