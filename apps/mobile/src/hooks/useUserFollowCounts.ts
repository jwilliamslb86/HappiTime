import { useCallback, useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useCurrentUser } from "./useCurrentUser";

type FollowCounts = {
  followerCount: number;
  followingCount: number;
  loading: boolean;
  error: Error | null;
};

export function useUserFollowCounts() {
  const { user } = useCurrentUser();
  const [state, setState] = useState<FollowCounts>({
    followerCount: 0,
    followingCount: 0,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!user?.id) {
      setState({
        followerCount: 0,
        followingCount: 0,
        loading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const [followers, following] = await Promise.all([
      (supabase as any)
        .from("user_follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_user_id", user.id),
      (supabase as any)
        .from("user_follows")
        .select("following_user_id", { count: "exact", head: true })
        .eq("follower_id", user.id),
    ]);

    if (followers.error || following.error) {
      setState({
        followerCount: 0,
        followingCount: 0,
        loading: false,
        error:
          followers.error ??
          following.error ??
          new Error("Failed to load follow counts."),
      });
      return;
    }

    setState({
      followerCount: followers.count ?? 0,
      followingCount: following.count ?? 0,
      loading: false,
      error: null,
    });
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
