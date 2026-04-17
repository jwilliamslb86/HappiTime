import { useCallback, useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useCurrentUser } from "./useCurrentUser";

export type UserList = {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  item_count: number;
  created_at: string;
  updated_at: string;
};

type State = {
  lists: UserList[];
  loading: boolean;
  error: string | null;
};

export function useUserLists() {
  const { user } = useCurrentUser();
  const [state, setState] = useState<State>({
    lists: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!user?.id) {
      setState({ lists: [], loading: false, error: null });
      return;
    }

    const { data, error } = await supabase
      .from("user_lists")
      .select("id, name, description, visibility, created_at, updated_at, items:user_list_items(id)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      setState({ lists: [], loading: false, error: error.message });
      return;
    }

    const lists: UserList[] = (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      visibility: row.visibility,
      item_count: Array.isArray(row.items) ? row.items.length : 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    setState({ lists, loading: false, error: null });
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const createList = useCallback(
    async (name: string, description?: string): Promise<{ error: Error | null }> => {
      if (!user?.id) return { error: new Error("Not signed in") };

      const { error } = await supabase.from("user_lists").insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        visibility: "private",
      });

      if (error) return { error: new Error(error.message) };

      await load();
      return { error: null };
    },
    [user?.id, load]
  );

  const deleteList = useCallback(
    async (listId: string): Promise<{ error: Error | null }> => {
      if (!user?.id) return { error: new Error("Not signed in") };

      const { error } = await supabase
        .from("user_lists")
        .delete()
        .eq("id", listId)
        .eq("user_id", user.id);

      if (error) return { error: new Error(error.message) };

      await load();
      return { error: null };
    },
    [user?.id, load]
  );

  return {
    lists: state.lists,
    loading: state.loading,
    error: state.error,
    createList,
    deleteList,
  };
}
