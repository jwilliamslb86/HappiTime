import { useCallback, useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useCurrentUser } from "./useCurrentUser";

type State = {
  venueIds: string[];
  loading: boolean;
  savingVenueId: string | null;
  error: Error | null;
};

export function useUserFollowedVenues() {
  const { user } = useCurrentUser();
  const [state, setState] = useState<State>({
    venueIds: [],
    loading: true,
    savingVenueId: null,
    error: null,
  });

  const load = useCallback(async () => {
    if (!user?.id) {
      setState({
        venueIds: [],
        loading: false,
        savingVenueId: null,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    const { data, error } = await (supabase as any)
      .from("user_followed_venues")
      .select("venue_id")
      .eq("user_id", user.id);

    if (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error,
      }));
      return;
    }

    const venueIds = (data ?? [])
      .map((row: { venue_id?: string | null }) => row.venue_id)
      .filter((venueId: string | null | undefined): venueId is string =>
        typeof venueId === "string"
      );

    setState((prev) => ({
      ...prev,
      venueIds,
      loading: false,
      error: null,
    }));
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = useCallback(
    async (venueId: string) => {
      if (!user?.id) {
        const error = new Error("Not signed in.");
        setState((prev) => ({ ...prev, error }));
        return { error };
      }

      const isFollowing = state.venueIds.includes(venueId);
      setState((prev) => ({ ...prev, savingVenueId: venueId, error: null }));

      const { error } = isFollowing
        ? await (supabase as any)
            .from("user_followed_venues")
            .delete()
            .eq("user_id", user.id)
            .eq("venue_id", venueId)
        : await (supabase as any)
            .from("user_followed_venues")
            .insert({ user_id: user.id, venue_id: venueId });

      if (error) {
        setState((prev) => ({
          ...prev,
          savingVenueId: null,
          error,
        }));
        return { error };
      }

      setState((prev) => ({
        ...prev,
        savingVenueId: null,
      }));
      await load();
      return { error: null };
    },
    [load, state.venueIds, user?.id]
  );

  const isFollowing = useCallback(
    (venueId: string | null | undefined) =>
      !!venueId && state.venueIds.includes(venueId),
    [state.venueIds]
  );

  return {
    venueIds: state.venueIds,
    loading: state.loading,
    savingVenueId: state.savingVenueId,
    error: state.error,
    refresh: load,
    isFollowing,
    toggleFollow,
  };
}
