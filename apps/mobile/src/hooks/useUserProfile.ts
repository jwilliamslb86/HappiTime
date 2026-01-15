import { useCallback, useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useCurrentUser } from "./useCurrentUser";

type UserProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
};

const normalizeText = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeHandle = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

export function useUserProfile() {
  const { user } = useCurrentUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("user_profiles")
      .select("user_id, handle, display_name, avatar_url, bio, is_public")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setError(error);
      setProfile(null);
    } else {
      setError(null);
      setProfile(data ?? null);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = useCallback(
    async (updates: {
      display_name?: string | null;
      handle?: string | null;
      bio?: string | null;
      avatar_url?: string | null;
      is_public?: boolean;
    }) => {
      if (!user?.id) {
        return { data: null, error: new Error("Not signed in.") };
      }

      setSaving(true);
      const payload = {
        user_id: user.id,
        display_name: normalizeText(updates.display_name),
        handle: normalizeHandle(updates.handle),
        bio: normalizeText(updates.bio),
        avatar_url: updates.avatar_url ?? profile?.avatar_url ?? null,
        is_public: updates.is_public ?? profile?.is_public ?? false,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabase as any)
        .from("user_profiles")
        .upsert(payload, { onConflict: "user_id" })
        .select("user_id, handle, display_name, avatar_url, bio, is_public")
        .maybeSingle();

      if (error) {
        setError(error);
      } else {
        setError(null);
        setProfile(data ?? null);
      }
      setSaving(false);
      return { data: data ?? null, error };
    },
    [user?.id, profile?.avatar_url, profile?.is_public]
  );

  return { profile, loading, saving, error, refresh: load, saveProfile };
}
