import {
  fetchPublishedHappyHourWindows,
  type HappyHourWindowWithVenueAndOffers
} from "@happitime/shared-api";
import { supabase } from "./supabaseClient";

export type HappyHourWindow = HappyHourWindowWithVenueAndOffers;

export async function fetchPublishedHappyHours(): Promise<HappyHourWindow[]> {
  try {
    const windows = await fetchPublishedHappyHourWindows({ supabase });

    return windows.map((window) => ({
      ...window,
      offers: (window.offers ?? []).filter(
        (offer) => offer.status === "published"
      )
    }));
  } catch (error) {
    console.error("[fetchPublishedHappyHours] error", error);
    throw error;
  }
}
