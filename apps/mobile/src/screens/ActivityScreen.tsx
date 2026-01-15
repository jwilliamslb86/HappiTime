// src/screens/ActivityScreen.tsx
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SegmentedTabs } from "../components/SegmentedTabs";
import { useHappyHours, type HappyHourWindow } from "../hooks/useHappyHours";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type ActivityItem = {
  id: string;
  type: "follow" | "like" | "visit" | "save";
  actor: string;
  avatarUrl?: string;
  when: string; // e.g. "1d"
  message: string;
  thumbnailUrl?: string;
  unread?: boolean;
  windowId?: string;
};

const MOCK_FRIENDS: ActivityItem[] = [
  {
    id: "1",
    type: "follow",
    actor: "starryskies23",
    when: "1d",
    message: "Started following you",
    unread: true
  },
  {
    id: "2",
    type: "like",
    actor: "nebulanomad",
    when: "1d",
    message: "Liked one of your favorites...",
    unread: true
  },
  {
    id: "3",
    type: "visit",
    actor: "emberEcho",
    when: "4d",
    message: "Commented on your post",
    unread: false
  }
];

const MOCK_VENUES: ActivityItem[] = [
  {
    id: "11",
    type: "visit",
    actor: "Crossroads Hotel",
    when: "2d",
    message: "Trending in your favorites this week"
  },
  {
    id: "12",
    type: "save",
    actor: "The Peanut",
    when: "3d",
    message: "Added to 14 other lists near you"
  }
];

const MOCK_LISTS: ActivityItem[] = [
  {
    id: "21",
    type: "save",
    actor: "Sunday Brunch Crawl",
    when: "4d",
    message: "Saved your list",
    unread: true
  }
];

const formatWhen = (iso?: string | null) => {
  if (!iso) return "1d";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "1d";
  const diffMs = Date.now() - ts;
  if (diffMs <= 0) return "1d";
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return `${Math.max(1, diffDays)}d`;
};

const formatTagLabel = (tag: string) =>
  tag
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const normalizeTag = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();

const getWindowName = (window: HappyHourWindow) =>
  window.venue?.name ?? window.venue_name ?? "Venue";

const getWindowTags = (window: HappyHourWindow) =>
  (window.venue?.tags ?? []).map(normalizeTag).filter(Boolean);

export const ActivityScreen: React.FC = () => {
  const [tab, setTab] = useState<"friends" | "venues" | "lists">("friends");
  const { data: windows } = useHappyHours();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [followState, setFollowState] = useState<Record<string, boolean>>({});

  const venuesData = useMemo<ActivityItem[]>(() => {
    if (!windows.length) return MOCK_VENUES;

    const getWindowTs = (window: HappyHourWindow) => {
      const raw =
        window.last_confirmed_at ??
        window.updated_at ??
        window.created_at ??
        window.venue?.updated_at ??
        window.venue?.created_at ??
        null;
      const ts = raw ? Date.parse(raw) : Number.NaN;
      return Number.isNaN(ts) ? 0 : ts;
    };

    const sorted = [...windows].sort(
      (a, b) => getWindowTs(b) - getWindowTs(a)
    );

    return sorted.map((window) => {
      const venueName = getWindowName(window);
      const message = window.label ? `${window.label} happy hour` : "Happy hour updated";
      const shortMessage =
        message.length > 72 ? `${message.slice(0, 72)}...` : message;

      return {
        id: `window-${window.id}`,
        type: "visit",
        actor: venueName,
        when: formatWhen(
          window.last_confirmed_at ?? window.updated_at ?? window.created_at
        ),
        message: shortMessage,
        windowId: window.id
      };
    });
  }, [windows]);

  const listsData = useMemo<ActivityItem[]>(() => {
    if (!windows.length) return MOCK_LISTS;

    const tagMeta = new Map<
      string,
      { count: number; latest: string | null }
    >();

    for (const window of windows) {
      const tags = getWindowTags(window);
      if (tags.length === 0) continue;

      for (const tag of tags) {
        const existing = tagMeta.get(tag) ?? { count: 0, latest: null };
        const candidate =
          window.updated_at ??
          window.last_confirmed_at ??
          window.created_at ??
          null;
        const currentTs = existing.latest
          ? Date.parse(existing.latest)
          : Number.NaN;
        const candidateTs = candidate ? Date.parse(candidate) : Number.NaN;

        existing.count += 1;
        if (
          candidate &&
          (Number.isNaN(currentTs) ||
            (!Number.isNaN(candidateTs) && candidateTs > currentTs))
        ) {
          existing.latest = candidate;
        }

        tagMeta.set(tag, existing);
      }
    }

    if (tagMeta.size === 0) return MOCK_LISTS;

    return Array.from(tagMeta.entries())
      .sort((a, b) => {
        const aTs = a[1].latest ? Date.parse(a[1].latest) : 0;
        const bTs = b[1].latest ? Date.parse(b[1].latest) : 0;
        return bTs - aTs;
      })
      .map(([tag, meta], index) => ({
        id: `list-${tag}-${index}`,
        type: "save",
        actor: formatTagLabel(tag),
        when: formatWhen(meta.latest),
        message: `${meta.count} venue${meta.count === 1 ? "" : "s"} in this list`
      }));
  }, [windows]);

  let data: ActivityItem[] = [];
  if (tab === "friends") data = MOCK_FRIENDS;
  if (tab === "venues") data = venuesData;
  if (tab === "lists") data = listsData;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Activity</Text>
      <SegmentedTabs
        tabs={[
          { key: "friends", label: "Friends" },
          { key: "venues", label: "Venues" },
          { key: "lists", label: "Lists" }
        ]}
        activeKey={tab}
        onChange={(key) => setTab(key as any)}
      />

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const onPress = item.windowId
            ? () =>
                navigation.navigate("HappyHourDetail", {
                  windowId: item.windowId as string
                })
            : undefined;
          const isUnread = item.unread === true;
          const isFollowItem = item.type === "follow";
          const isFollowing = followState[item.id] ?? false;

          const handleFollowToggle = () => {
            setFollowState((prev) => ({
              ...prev,
              [item.id]: !isFollowing
            }));
            // TODO: hook up to follow/unfollow API and handle loading/errors.
          };

          return (
            <Pressable
              onPress={onPress}
              disabled={!onPress}
              style={({ pressed }) => [
                styles.row,
                onPress && pressed && styles.rowPressed
              ]}
            >
              <View style={styles.avatarWrap}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {item.actor.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.statusDot,
                    !isUnread && styles.statusDotRead
                  ]}
                />
              </View>

              <View style={styles.textContainer}>
                <View style={styles.nameRow}>
                  <Text style={styles.actor}>{item.actor}</Text>
                  <Text style={styles.when}>{item.when}</Text>
                </View>
                <Text style={styles.message}>{item.message}</Text>
              </View>

              {(isFollowItem || item.thumbnailUrl) && (
                <View style={styles.trailing}>
                  {isFollowItem ? (
                    <Pressable
                      onPress={handleFollowToggle}
                      style={({ pressed }) => [
                        styles.followButton,
                        isFollowing && styles.followButtonActive,
                        pressed && styles.followButtonPressed
                      ]}
                    >
                      <Text
                        style={[
                          styles.followText,
                          isFollowing && styles.followTextActive
                        ]}
                      >
                        {isFollowing ? "Following" : "Follow"}
                      </Text>
                    </Pressable>
                  ) : (
                    <Image
                      source={{ uri: item.thumbnailUrl }}
                      style={styles.thumbnail}
                    />
                  )}
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xxl + spacing.md,
    paddingHorizontal: spacing.lg
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: spacing.md
  },
  listContent: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md
  },
  rowPressed: {
    opacity: 0.85
  },
  avatarWrap: {
    position: "relative",
    marginRight: spacing.md
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarInitial: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16
  },
  statusDot: {
    position: "absolute",
    left: -3,
    top: 18,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1,
    borderColor: colors.background
  },
  statusDotRead: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    opacity: 0
  },
  textContainer: {
    flex: 1
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 2
  },
  actor: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginRight: spacing.sm
  },
  when: {
    color: colors.textMuted,
    fontSize: 13
  },
  message: {
    color: colors.textMuted,
    fontSize: 14
  },
  trailing: {
    marginLeft: spacing.md
  },
  followButton: {
    backgroundColor: colors.pillActiveBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    minWidth: 72,
    alignItems: "center"
  },
  followButtonActive: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  followButtonPressed: {
    opacity: 0.85
  },
  followText: {
    color: colors.pillActiveText,
    fontSize: 13,
    fontWeight: "600"
  },
  followTextActive: {
    color: colors.text
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 10
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.6,
    marginLeft: 56
  }
});


