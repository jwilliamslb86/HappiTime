// packages/shared-types/src/index.ts

// Import the generated Supabase Database type
import type { Database as SupabaseDatabase } from "../../supabase/types/generated.js";

// Re-export the raw Database type
export type Database = SupabaseDatabase;

// Domain aliases for convenience
export type Venue = Database["public"]["Tables"]["venues"]["Row"];
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type HappyHourWindow = Database["public"]["Tables"]["happy_hour_windows"]["Row"];
export type HappyHourOffer = Database["public"]["Tables"]["happy_hour_offers"]["Row"];
export type Menu = Database["public"]["Tables"]["menus"]["Row"];
export type MenuSection = Database["public"]["Tables"]["menu_sections"]["Row"];
export type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];
export type VenueMedia = Database["public"]["Tables"]["venue_media"]["Row"];
export type OrgInvite = Database["public"]["Tables"]["org_invites"]["Row"];
export type OrgMember = Database["public"]["Tables"]["org_members"]["Row"];
export type VenueMember = Database["public"]["Tables"]["venue_members"]["Row"];
