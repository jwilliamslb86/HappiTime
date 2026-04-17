// src/hooks/useHappyHourPlaces.ts
import { fetchHappyHourPlaces } from "@happitime/shared-api";
import type { HappyHourPlace } from "@happitime/shared-types";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";

export type HappyHourPlaceWithDistance = HappyHourPlace & {
  distance?: number | null;
};

type State = {
  data: HappyHourPlaceWithDistance[];
  loading: boolean;
  error: Error | null;
  refreshing: boolean;
};

type FetchOptions = Parameters<typeof fetchHappyHourPlaces>[0];

export function useHappyHourPlaces(options?: FetchOptions) {
  const [state, setState] = useState<State>({
    data: [],
    loading: true,
    error: null,
    refreshing: false
  });

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        setState((prev) => ({
          ...prev,
          loading: !isRefresh,
          refreshing: isRefresh,
          error: null
        }));

        const requestOptions = {
          ...(options ?? {}),
          supabase
        };
        const places = await fetchHappyHourPlaces(requestOptions);
        const withDistance = (places ?? []).map((place) => ({
          ...place,
          distance:
            typeof place.distance_miles === "number" ? place.distance_miles : null
        }));

        setState({
          data: withDistance,
          loading: false,
          error: null,
          refreshing: false
        });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          refreshing: false,
          error: err as Error
        }));
      }
    },
    [options]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refreshing: state.refreshing,
    refresh
  };
}
