import { useCallback, useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useCurrentUser } from "./useCurrentUser";

export type Follower = {
  follower_id: string;
  created_at: string;
  profile: {
    handle: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type State = {
  followers: Follower[];
  loading: boolean;
  error: string | null;
};

export function useUserFollowers() {
  const { user } = useCurrentUser();
  const [state, setState] = useState<State>({
    followers: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!user?.id) {
      setState({ followers: [], loading: false, error: null });
      return;
    }

    const { data, error } = await supabase
      .from("user_follows")
      .select("follower_id, created_at, profile:user_profiles!user_follows_follower_id_profile_fkey(handle, display_name, avatar_url)")
      .eq("following_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setState({ followers: [], loading: false, error: error.message });
      return;
    }

    setState({
      followers: (data ?? []) as Follower[],
      loading: false,
      error: null,
    });
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = useCallback(
    async (targetUserId: string, currentlyFollowing: boolean) => {
      if (!user?.id) return;
      if (currentlyFollowing) {
        await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_user_id", targetUserId);
      } else {
        await supabase.from("user_follows").insert({
          follower_id: user.id,
          following_user_id: targetUserId,
        });
      }
    },
    [user?.id]
  );

  return { followers: state.followers, loading: state.loading, error: state.error, toggleFollow };
}
