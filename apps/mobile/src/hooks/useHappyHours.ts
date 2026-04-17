// src/hooks/useHappyHours.ts
import { fetchPublishedHappyHourWindows } from "@happitime/shared-api";
import type {
  HappyHourOffer,
  HappyHourWindow as HappyHourWindowRow,
  Venue
} from "@happitime/shared-types";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";

export type HappyHourWindow = HappyHourWindowRow & {
  name?: string | null;
  venue: Venue | null;
  offers: HappyHourOffer[];
  organization_name?: string | null;
  venue_name?: string | null;
  // computed client-side
  distance?: number | null;
  orgVenueCount?: number | null;
  orgName?: string | null;
  org_id?: string | null;
};

type State = {
  data: HappyHourWindow[];
  loading: boolean;
  error: Error | null;
  refreshing: boolean;
};

const normalizeText = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const getOrgId = (window: HappyHourWindow) =>
  window.venue?.org_id ?? (typeof window.org_id === "string" ? window.org_id : null);

const getVenueId = (window: HappyHourWindow) =>
  window.venue?.id ?? window.venue_id ?? null;

export function useHappyHours() {
  const [state, setState] = useState<State>({
    data: [],
    loading: true,
    error: null,
    refreshing: false
  });

  const load = useCallback(async (isRefresh = false) => {
    try {
      setState((prev) => ({
        ...prev,
        loading: !isRefresh,
        refreshing: isRefresh,
        error: null
      }));

      const windows: HappyHourWindow[] = await fetchPublishedHappyHourWindows({
        supabase
      });

      const missingVenueIds = Array.from(
        new Set(
          windows
            .filter((window) => !window.venue && window.venue_id)
            .map((window) => window.venue_id)
        )
      );

      let venueById: Record<string, Venue> = {};

      if (missingVenueIds.length > 0) {
        const { data: venueData, error: venueError } = await supabase
          .from("venues")
          .select(
            `
            id,
            org_id,
            name,
            org_name,
            address,
            phone,
            website,
            neighborhood,
            city,
            state,
            zip,
            timezone,
            tags,
            price_tier,
            app_name_preference,
            status,
            created_at,
            updated_at,
            last_confirmed_at,
            lat,
            lng
          `
          )
          .in("id", missingVenueIds);

        if (venueError) {
          console.warn("[useHappyHours] venue lookup failed", venueError);
        } else {
          venueById = Object.fromEntries(
            ((venueData ?? []) as Venue[]).map((venue) => [venue.id, venue])
          );
        }
      }

      const windowsWithVenues = windows.map((window) => {
        if (window.venue || !window.venue_id) return window;
        const fallbackVenue = venueById[window.venue_id] ?? null;
        return fallbackVenue ? { ...window, venue: fallbackVenue } : window;
      });

      // Build org venue counts from the data we already have (no extra query needed)
      const orgVenueMap = new Map<string, Set<string>>();
      for (const window of windowsWithVenues) {
        const orgId = getOrgId(window);
        const venueId = getVenueId(window);
        if (!orgId || !venueId) continue;
        const venues = orgVenueMap.get(orgId) ?? new Set<string>();
        venues.add(venueId);
        orgVenueMap.set(orgId, venues);
      }
      const orgVenueCounts = new Map<string, number>();
      for (const [orgId, venues] of orgVenueMap.entries()) {
        orgVenueCounts.set(orgId, venues.size);
      }

      const windowsWithOrgMeta = windowsWithVenues.map((window) => {
        const orgId = getOrgId(window);
        const orgVenueCount = orgId ? orgVenueCounts.get(orgId) ?? null : null;
        // org name now comes from the nested join (venue.org.name) — no extra round-trip
        const orgNameFromJoin = (window.venue as any)?.org?.name ?? null;
        const orgNameFromVenue = normalizeText(window.venue?.org_name);
        const organizationName =
          normalizeText(window.organization_name) ??
          orgNameFromVenue ??
          normalizeText(orgNameFromJoin);
        const venueName =
          normalizeText(window.venue_name) ?? window.venue?.name ?? null;

        return {
          ...window,
          orgVenueCount,
          orgName: organizationName ?? null,
          organization_name: organizationName ?? null,
          venue_name: venueName ?? null
        };
      });

      setState({
        data: windowsWithOrgMeta,
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
  }, []);

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
