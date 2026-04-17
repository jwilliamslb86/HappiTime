import { useCallback, useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useCurrentUser } from "./useCurrentUser";
import type { HappyHourWindow } from "./useHappyHours";

export type HistoryEntry = {
  id: string;
  event_type: string;
  venue_id: string | null;
  created_at: string;
  venue: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
};

type State = {
  entries: HistoryEntry[];
  loading: boolean;
  error: string | null;
};

export function useUserHistory() {
  const { user } = useCurrentUser();
  const [state, setState] = useState<State>({
    entries: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!user?.id) {
      setState({ entries: [], loading: false, error: null });
      return;
    }

    const { data, error } = await supabase
      .from("user_events")
      .select("id, event_type, venue_id, created_at, venue:venues(id, name, address, city, state)")
      .eq("user_id", user.id)
      .in("event_type", ["venue_view", "venue_save", "venue_checkin"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setState({ entries: [], loading: false, error: error.message });
      return;
    }

    setState({
      entries: (data ?? []) as HistoryEntry[],
      loading: false,
      error: null,
    });
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Record that the user viewed or saved a venue. Call this when navigating
   * to HappyHourDetailScreen or when the user taps the follow/save button.
   */
  const recordEvent = useCallback(
    async (eventType: "venue_view" | "venue_save" | "venue_checkin", venueId: string) => {
      if (!user?.id) return;
      await supabase.from("user_events").insert({
        user_id: user.id,
        event_type: eventType,
        venue_id: venueId,
      });
    },
    [user?.id]
  );

  return { entries: state.entries, loading: state.loading, error: state.error, recordEvent };
}
