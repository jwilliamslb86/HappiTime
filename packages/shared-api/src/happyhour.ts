// packages/shared-api/src/happyhour.ts

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Organization,
  Venue,
  HappyHourWindow,
  HappyHourOffer
} from "@happitime/shared-types";
import { createSupabaseClient } from "./client.js";

export type HappyHourWindowWithVenueAndOffers = HappyHourWindow & {
  venue: Venue | null;
  offers: HappyHourOffer[];
};

export type VenueWithOrganization = Venue & {
  org?: Organization | null;
};

type FetchVenueWithWindowsOptions = {
  supabase?: SupabaseClient<Database>;
  orgId?: string;
  includeOrganization?: boolean;
  status?: string;
};

/**
 * Fetch published happy hour windows with venue + offer details.
 */
export async function fetchPublishedHappyHourWindows(opts?: {
  limit?: number;
  supabase?: SupabaseClient<Database>;
}): Promise<HappyHourWindowWithVenueAndOffers[]> {
  const supabase = opts?.supabase ?? createSupabaseClient();

  let query = supabase
    .from("happy_hour_windows")
    .select("*, venue:venues (*, org:organizations (id, name)), offers:happy_hour_offers (*)")
    .eq("status", "published")
    .order("start_time", { ascending: true });

  if (opts?.limit) {
    query = query.limit(opts.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchPublishedHappyHourWindows error:", error);
    throw error;
  }

  return (data ?? []) as HappyHourWindowWithVenueAndOffers[];
}

/**
 * Fetch a venue and its published windows from normalized tables.
 */
export async function fetchVenueWithWindows(
  venueId: string,
  opts?: FetchVenueWithWindowsOptions & { throwOnError?: true }
): Promise<{
  venue: VenueWithOrganization;
  windows: HappyHourWindow[];
}>;
export async function fetchVenueWithWindows(
  venueId: string,
  opts: FetchVenueWithWindowsOptions & { throwOnError: false }
): Promise<{
  venue: VenueWithOrganization | null;
  windows: HappyHourWindow[];
  venueError: PostgrestError | null;
  windowsError: PostgrestError | null;
}>;
export async function fetchVenueWithWindows(
  venueId: string,
  opts?: FetchVenueWithWindowsOptions & { throwOnError?: boolean }
) {
  const supabase = opts?.supabase ?? createSupabaseClient();
  const includeOrganization = opts?.includeOrganization ?? false;
  const throwOnError = opts?.throwOnError ?? true;
  const windowStatus = opts?.status ?? "published";

  const venueSelect = includeOrganization
    ? "*, org:organizations ( id, name )"
    : "*";

  let venueQuery = supabase.from("venues").select(venueSelect).eq("id", venueId);

  if (opts?.orgId) {
    venueQuery = venueQuery.eq("org_id", opts.orgId);
  }

  const [{ data: venue, error: venueError }, { data: windows, error: windowsError }] =
    await Promise.all([
      venueQuery.single(),
      supabase
        .from("happy_hour_windows")
        .select("*")
        .eq("venue_id", venueId)
        .eq("status", windowStatus)
        .order("start_time", { ascending: true })
    ]);

  const typedVenue = (venue as VenueWithOrganization | null) ?? null;
  const typedWindows = (windows ?? []) as HappyHourWindow[];

  if (venueError) {
    console.error("fetchVenueWithWindows venue error:", venueError);
  }

  if (windowsError) {
    console.error("fetchVenueWithWindows windows error:", windowsError);
  }

  if (!throwOnError) {
    return {
      venue: typedVenue,
      windows: typedWindows,
      venueError,
      windowsError
    };
  }

  if (venueError) {
    throw venueError;
  }

  if (windowsError) {
    throw windowsError;
  }

  if (!typedVenue) {
    throw new Error(`Venue not found for id=${venueId}`);
  }

  return {
    venue: typedVenue,
    windows: typedWindows
  };
}

/**
 * Fetch published happy hour offers for a specific window.
 */
export async function fetchWindowOffers(
  windowId: string
): Promise<HappyHourOffer[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("happy_hour_offers")
    .select("*")
    .eq("window_id", windowId)
    .eq("status", "published")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchWindowOffers error:", error);
    throw error;
  }

  return data ?? [];
}
